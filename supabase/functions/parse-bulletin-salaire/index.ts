/**
 * Edge Function: parse-bulletin-salaire
 * 
 * Parse automatiquement un bulletin de salaire PDF uploadé en utilisant :
 * 1. Document parsing de Supabase pour extraire le texte
 * 2. Azure GPT-5 avec reasoning medium pour structurer les données
 * 3. Création automatique du salaire si confiance élevée
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";
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

    const { document_id, storage_path, profile_id } = await req.json();

    if (!document_id || !storage_path || !profile_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Starting bulletin parsing:', { document_id, profile_id });

    // Créer un log de parsing
    const { data: logEntry, error: logError } = await supabase
      .from('rh_bulletins_parsing_log')
      .insert({
        document_id,
        profile_id,
        status: 'pending'
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Error creating log entry:', logError);
      throw new Error('Failed to create parsing log');
    }

    // 1. Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('rh-documents')
      .download(storage_path);

    if (downloadError) {
      console.error('❌ Error downloading file:', downloadError);
      await supabase.from('rh_bulletins_parsing_log').update({
        status: 'failed',
        error_message: 'Failed to download PDF file',
        processing_duration_ms: Date.now() - startTime
      }).eq('id', logEntry.id);
      
      throw new Error('Failed to download PDF file');
    }

    console.log('✅ File downloaded, size:', fileData.size);

    // 2. Convertir le Blob en ArrayBuffer pour extraction de texte
    const arrayBuffer = await fileData.arrayBuffer();

    // 3. Convert PDF to text using pdfjs-serverless (same as analyze-medical-economic-study)
    let extractedText = '';
    try {
      extractedText = await extractTextFromPDF(arrayBuffer);
      console.log('✅ PDF text extracted successfully, length:', extractedText.length);
      console.log('📄 Text sample:', extractedText.substring(0, 500));

      if (!extractedText || extractedText.length < 100) {
        throw new Error('PDF text extraction failed - content too short');
      }
    } catch (e) {
      console.error('❌ PDF text extraction failed:', e);
      
      await supabase.from('rh_bulletins_parsing_log').update({
        status: 'failed',
        error_message: `PDF text extraction failed - ${e.message}`,
        processing_duration_ms: Date.now() - startTime
      }).eq('id', logEntry.id);
      
      throw new Error('Unable to extract text from PDF');
    }

    console.log('📄 Text sample:', extractedText.substring(0, 200));

    // 4. Préparer le prompt GPT-5 renforcé
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

    // Sanitize extracted text for security
    const sanitizedText = sanitizeForAI(extractedText, { 
      maxLength: 15000, 
      functionName: 'parse-bulletin-salaire',
      strictMode: false 
    });

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
${wrapUserContent(sanitizedText, "BULLETIN_CONTENT")}
---`;

    // 5. Appel Azure GPT-5
    console.log('🤖 Calling Azure GPT-5...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
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

      if (azureResponse.status === 429) {
        console.warn('⚠️ Azure rate limited, backing off 1s...');
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
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

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ Azure request timeout');
        await supabase.from('rh_bulletins_parsing_log').update({
          status: 'failed',
          error_message: 'Azure request timeout (90s)',
          processing_duration_ms: Date.now() - startTime
        }).eq('id', logEntry.id);
        
        throw new Error('Azure request timeout');
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('❌ Azure OpenAI error:', azureResponse.status, errorText);
      await supabase.from('rh_bulletins_parsing_log').update({
        status: 'failed',
        error_message: `Azure API error: ${azureResponse.status}`,
        processing_duration_ms: Date.now() - startTime
      }).eq('id', logEntry.id);
      
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;
    const usage = extractUsage(azureData);

    if (!content || typeof content !== 'string') {
      console.error('❌ Unexpected response format:', JSON.stringify(azureData, null, 2));
      await supabase.from('rh_bulletins_parsing_log').update({
        status: 'failed',
        error_message: 'No content in Azure response',
        gpt_raw_response: azureData,
        processing_duration_ms: Date.now() - startTime
      }).eq('id', logEntry.id);
      
      throw new Error('No content in Azure response');
    }

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'rh_bulletin_parsing',
      model_used: 'gpt-5',
      ...usage,
      processing_duration_ms: Date.now() - startTime,
      success: true,
      context_type: 'document',
      context_id: document_id,
    });

    console.log('✅ GPT-5 response received');

    // 6. Parser le JSON avec gestion robuste des erreurs
    let extractedData;
    try {
      extractedData = JSON.parse(content);
      
      // Validation basique : s'assurer que confidence existe
      if (!extractedData.hasOwnProperty('confidence')) {
        extractedData.confidence = 0;
      }
      
      console.log('✅ JSON parsed successfully, confidence:', extractedData.confidence);
      
    } catch (e) {
      console.error('❌ Failed to parse JSON:', content);
      
      // Créer un objet par défaut avec tous les champs à null
      extractedData = {
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
      
      await supabase.from('rh_bulletins_parsing_log').update({
        status: 'failed',
        error_message: 'Invalid JSON from GPT-5',
        gpt_raw_response: { raw_content: content },
        processing_duration_ms: Date.now() - startTime
      }).eq('id', logEntry.id);
      
      console.log('⚠️ Using default structure with confidence 0');
    }

    const confidence = extractedData.confidence || 0;
    console.log('📊 Confidence score:', confidence);

    // 7. Déterminer le statut
    let status = 'failed';
    if (confidence >= 80) {
      status = 'success';
    } else if (confidence >= 50) {
      status = 'partial';
    }

    // 8. Mettre à jour le log
    await supabase.from('rh_bulletins_parsing_log').update({
      status,
      extracted_data: extractedData,
      confidence_score: confidence,
      gpt_raw_response: azureData,
      processing_duration_ms: Date.now() - startTime
    }).eq('id', logEntry.id);

    console.log('✅ Parsing completed:', status);

    // 9. Retourner le résultat
    return new Response(
      JSON.stringify({
        success: true,
        log_id: logEntry.id,
        status,
        confidence,
        data: extractedData,
        processing_duration_ms: Date.now() - startTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    return buildErrorResponse('parse-bulletin-salaire', error, corsHeaders, 500);
  }

});

// Helper function to extract text from PDF
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Import pdfjs-serverless for Deno (no worker needed)
    const { getDocument } = await import('https://esm.sh/pdfjs-serverless@0.3.2');
    
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await getDocument(uint8Array).promise;
    
    let fullText = '';
    
    // Extract text from all pages
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