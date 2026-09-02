/**
 * Edge Function: reanalyze-all-bulletins
 * 
 * Réanalyse COMPLÈTEMENT tous les bulletins de salaire existants pour extraire et mettre à jour
 * TOUTES les données (brut, net, net payé, cotisations, primes, heures sup, etc.) 
 * dans rh_salaires_mensuels en utilisant Azure GPT-5.
 * 
 * Cette fonction force la réanalyse même si les bulletins ont déjà été traités.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIMEOUT_MS = 90000; // 90 secondes max par batch

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que l'utilisateur est admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les paramètres de pagination
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 3; // Réduit à 3 pour éviter WORKER_LIMIT
    const offset = body.offset || 0;

    console.log(`🚀 Starting reanalysis batch: offset=${offset}, batchSize=${batchSize}`);

    // 1. Compter le nombre total de bulletins
    const { count: totalCount, error: countError } = await supabase
      .from('rh_salaires_mensuels')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', 'auto_bulletin')
      .not('source_document_id', 'is', null);

    if (countError) {
      console.error('❌ Error counting salaires:', countError);
      throw new Error('Failed to count salaires');
    }

    console.log(`📊 Total bulletins: ${totalCount}, Processing batch ${offset}-${offset + batchSize}`);

    // 2. Récupérer le batch de bulletins avec leur document associé
    const { data: salaires, error: salairesError } = await supabase
      .from('rh_salaires_mensuels')
      .select(`
        id,
        profile_id,
        mois,
        source_document_id,
        net_paye,
        salaire_net,
        rh_documents_employes:source_document_id (
          id,
          storage_path,
          type_document
        )
      `)
      .eq('source_type', 'auto_bulletin')
      .not('source_document_id', 'is', null)
      .range(offset, offset + batchSize - 1)
      .order('mois', { ascending: false });

    if (salairesError) {
      console.error('❌ Error fetching salaires:', salairesError);
      throw new Error('Failed to fetch salaires');
    }

    console.log(`📊 Processing ${salaires?.length || 0} bulletins in this batch`);

    const results = {
      total: totalCount || 0,
      processed: salaires?.length || 0,
      offset: offset,
      batch_size: batchSize,
      updated: 0,
      failed: 0,
      skipped: 0,
      has_more: (offset + batchSize) < (totalCount || 0),
      errors: [] as string[]
    };

    // 3. Pour chaque bulletin, réanalyser et mettre à jour (avec timeout)
    for (const salaire of salaires || []) {
      // Vérifier le timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn('⏱️ Timeout approaching, stopping batch processing');
        results.errors.push('Batch timeout - traitement interrompu');
        break;
      }
      
      // Petit délai entre chaque bulletin pour libérer la mémoire (GC)
      if (results.updated > 0 || results.failed > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      try {
        // Skip si pas de document associé
        if (!salaire.rh_documents_employes || !salaire.rh_documents_employes.storage_path) {
          console.log(`⏭️ Skipping salaire ${salaire.id} - no document`);
          results.skipped++;
          continue;
        }

        console.log(`🔄 Reanalyzing salaire ${salaire.id} for ${salaire.mois} - FORCING FULL REANALYSIS`);

        // Télécharger le PDF
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('rh-documents')
          .download(salaire.rh_documents_employes.storage_path);

        if (downloadError || !fileData) {
          console.error(`❌ Error downloading file for salaire ${salaire.id}:`, downloadError);
          results.failed++;
          results.errors.push(`Salaire ${salaire.id}: Failed to download PDF`);
          continue;
        }

        // Extraire le texte du PDF
        const arrayBuffer = await fileData.arrayBuffer();
        const extractedText = await extractTextFromPDF(arrayBuffer);
        
        // Libérer explicitement la mémoire
        fileData = null as any;

        if (!extractedText || extractedText.length < 100) {
          console.error(`❌ Insufficient text extracted for salaire ${salaire.id}`);
          results.failed++;
          results.errors.push(`Salaire ${salaire.id}: Insufficient text extracted`);
          continue;
        }

        // Analyser avec GPT-5 pour extraire TOUTES les données
        const extractedData = await extractAllDataWithGPT(extractedText);

        if (!extractedData || extractedData.confidence === 0) {
          console.warn(`⚠️ Could not extract data for salaire ${salaire.id}`);
          results.failed++;
          results.errors.push(`Salaire ${salaire.id}: Extraction failed - confidence 0`);
          continue;
        }

        console.log(`📊 Extracted data with confidence ${extractedData.confidence}% for salaire ${salaire.id}`);

        // Préparer l'objet de mise à jour avec UNIQUEMENT les champs existants dans la table
        const updateData: Partial<{
          salaire_brut: number;
          salaire_net: number;
          net_paye: number;
          cotisations_salariales: number;
          cotisations_patronales: number;
          primes: number;
          heures_supplementaires: number;
        }> = {};
        
        if (extractedData.salaire_brut !== null && extractedData.salaire_brut !== undefined) {
          updateData.salaire_brut = extractedData.salaire_brut;
        }
        if (extractedData.salaire_net !== null && extractedData.salaire_net !== undefined) {
          updateData.salaire_net = extractedData.salaire_net;
        }
        if (extractedData.salaire_net_a_payer !== null && extractedData.salaire_net_a_payer !== undefined) {
          updateData.net_paye = extractedData.salaire_net_a_payer;
        }
        if (extractedData.cotisations_salariales !== null && extractedData.cotisations_salariales !== undefined) {
          updateData.cotisations_salariales = extractedData.cotisations_salariales;
        }
        if (extractedData.cotisations_patronales !== null && extractedData.cotisations_patronales !== undefined) {
          updateData.cotisations_patronales = extractedData.cotisations_patronales;
        }
        if (extractedData.primes !== null && extractedData.primes !== undefined) {
          updateData.primes = extractedData.primes;
        }
        if (extractedData.heures_supplementaires !== null && extractedData.heures_supplementaires !== undefined) {
          updateData.heures_supplementaires = extractedData.heures_supplementaires;
        }
        // NOTE: heures_travaillees et taux_horaire n'existent pas dans rh_salaires_mensuels

        // Mettre à jour le salaire avec TOUTES les données extraites
        const { error: updateError } = await supabase
          .from('rh_salaires_mensuels')
          .update(updateData)
          .eq('id', salaire.id);

        if (updateError) {
          console.error(`❌ Error updating salaire ${salaire.id}:`, updateError);
          results.failed++;
          results.errors.push(`Salaire ${salaire.id}: Update failed - ${updateError.message}`);
          continue;
        }

        // Logger dans rh_bulletins_parsing_log pour traçabilité
        await supabase.from('rh_bulletins_parsing_log').insert({
          document_id: salaire.source_document_id,
          profile_id: salaire.profile_id,
          status: extractedData.confidence >= 80 ? 'success' : (extractedData.confidence >= 50 ? 'partial' : 'failed'),
          extracted_data: extractedData,
          confidence_score: extractedData.confidence,
          processing_duration_ms: Date.now() - startTime
        });

        console.log(`✅ Updated salaire ${salaire.id}:`, updateData);
        results.updated++;

      } catch (error: any) {
        console.error(`❌ Error processing salaire ${salaire.id}:`, error);
        results.failed++;
        results.errors.push(`Salaire ${salaire.id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log('✅ Reanalysis completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        processing_duration_ms: duration
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    return buildErrorResponse('reanalyze-all-bulletins', error, corsHeaders, 500);
  }

});

// Helper function to extract text from PDF
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const { getDocument } = await import('https://esm.sh/pdfjs-serverless@0.3.2');
    
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await getDocument(uint8Array).promise;
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

// Helper function to extract ALL data using GPT-5 (same as parse-bulletin-salaire)
async function extractAllDataWithGPT(pdfText: string): Promise<any> {
  const systemPrompt = `Tu es un expert en analyse de bulletins de salaire français. 
Ta mission est d'extraire TOUTES les informations d'un bulletin de salaire au format JSON strict.

RÈGLES IMPORTANTES:
- Si une information n'est pas présente, utilise null (pas de string vide)
- Les montants doivent être en euros (nombres décimaux sans symbole)
- Le mois doit être au format YYYY-MM-01
- Sois très précis sur les chiffres
- Calcule un score de confiance (0-100) basé sur la clarté des informations
- Si le texte est illisible ou incomplet, mets confidence à 0 et tous les champs à null

IMPORTANT : Réponds TOUJOURS avec un JSON valide, même si tu ne trouves aucune information.
Si aucune information n'est trouvée, retourne EXACTEMENT cette structure :
{
  "mois": null,
  "salaire_brut": null,
  "salaire_net": null,
  "salaire_net_a_payer": null,
  "cotisations_salariales": null,
  "cotisations_patronales": null,
  "primes": null,
  "heures_supplementaires": null,
  "heures_travaillees": null,
  "taux_horaire": null,
  "employe": {
    "nom": null,
    "prenom": null,
    "numero_securite_sociale": null
  },
  "entreprise": {
    "nom": null,
    "siret": null
  },
  "periode": {
    "debut": null,
    "fin": null
  },
  "confidence": 0
}

Réponds UNIQUEMENT en JSON valide, sans texte additionnel.`;

  const userPrompt = `Analyse ce bulletin de salaire et extrait les informations suivantes au format JSON:

{
  "mois": "YYYY-MM-01",
  "salaire_brut": nombre,
  "salaire_net": nombre,
  "salaire_net_a_payer": nombre,
  "cotisations_salariales": nombre,
  "cotisations_patronales": nombre,
  "primes": nombre | null,
  "heures_supplementaires": nombre | null,
  "heures_travaillees": nombre | null,
  "taux_horaire": nombre | null,
  "employe": {
    "nom": "string",
    "prenom": "string",
    "numero_securite_sociale": "string | null"
  },
  "entreprise": {
    "nom": "string",
    "siret": "string | null"
  },
  "periode": {
    "debut": "YYYY-MM-DD",
    "fin": "YYYY-MM-DD"
  },
  "confidence": 0-100
}

Texte du bulletin:
---
${pdfText}
---`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout réduit à 30s par appel GPT

    let response = await fetch(AZURE_OPENAI_ENDPOINT!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY!,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_completion_tokens: 4000,
        reasoning_effort: "low",
        verbosity: "low",
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Retry once on 429
    if (response.status === 429) {
      console.warn('⚠️ Azure rate limited, backing off 1s...');
      await new Promise(r => setTimeout(r, 1000));
      response = await fetch(AZURE_OPENAI_ENDPOINT!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_completion_tokens: 4000,
          reasoning_effort: "low",
          verbosity: "low",
          response_format: { type: "json_object" }
        }),
      });
    }

    if (!response.ok) {
      console.error('Azure API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('❌ Unexpected response format');
      return null;
    }

    // Parser le JSON
    try {
      const extractedData = JSON.parse(content);
      
      // Validation basique : s'assurer que confidence existe
      if (!extractedData.hasOwnProperty('confidence')) {
        extractedData.confidence = 0;
      }
      
      return extractedData;
      
    } catch (e) {
      console.error('❌ Failed to parse JSON:', content);
      
      // Créer un objet par défaut avec tous les champs à null
      return {
        mois: null,
        salaire_brut: null,
        salaire_net: null,
        salaire_net_a_payer: null,
        cotisations_salariales: null,
        cotisations_patronales: null,
        primes: null,
        heures_supplementaires: null,
        heures_travaillees: null,
        taux_horaire: null,
        employe: {
          nom: null,
          prenom: null,
          numero_securite_sociale: null
        },
        entreprise: {
          nom: null,
          siret: null
        },
        periode: {
          debut: null,
          fin: null
        },
        confidence: 0
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ Azure request timeout');
    } else {
      console.error('GPT extraction error:', error);
    }
    return null;
  }
}
