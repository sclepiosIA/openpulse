import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { assertEtablissementAccess } from "../_shared/etablissement-authz.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate authenticated user
    const { validateUserAuth } = await import("../_shared/auth-helpers.ts");
    const authResult = await validateUserAuth(req);
    if (authResult.error) {
      console.error('[analyze-medical-economic-study] Unauthorized:', authResult.error);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { document_id, file_path, etablissement_id } = await req.json();

    if (!etablissement_id || !file_path) {
      return new Response(
        JSON.stringify({ error: 'etablissement_id and file_path required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: authorize caller for this etablissement
    const access = await assertEtablissementAccess(authResult.userId, etablissement_id);
    if (!access.allowed) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: ensure file_path actually belongs to this etablissement (no arbitrary bucket reads)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: docMatch, error: docMatchError } = await supabaseClient
      .from('taches_documents')
      .select('id, tache_id, taches!inner(etablissement_id)')
      .eq('chemin_fichier', file_path)
      .maybeSingle();

    if (
      docMatchError ||
      !docMatch ||
      (docMatch as any).taches?.etablissement_id !== etablissement_id
    ) {
      return new Response(
        JSON.stringify({ error: 'Document not found for this etablissement' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Starting medical-economic study analysis:', {
      document_id,
      file_path,
      etablissement_id
    });

    // 2. Download PDF from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('taches-documents')
      .download(file_path);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    console.log('✅ File downloaded successfully');
    
    // 3. Convert PDF to text using pdfjs-dist
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfText = await extractTextFromPDF(arrayBuffer);
    
    console.log('✅ PDF text extracted, length:', pdfText.length);
    
    if (!pdfText || pdfText.length < 100) {
      throw new Error('PDF text extraction failed or content too short');
    }
    
    // 4. Call Azure GPT-5 for structured extraction
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
            { 
              role: "system", 
              content: `Tu es un expert en extraction de données financières d'études médico-économiques pour le système de santé français.

IMPORTANT : Retourne UNIQUEMENT un JSON valide, sans texte avant ou après.

Format JSON attendu :
{
  "modele_statique": nombre ou null,
  "modele_au_succes": {
    "frais_acces": nombre ou null,
    "palliers": [
      {
        "numero": 1,
        "nom": "Pallier 1" ou "Moins de 7%",
        "seuil_min": 0,
        "seuil_max": 7 ou null,
        "tarif": 25847
      }
    ]
  }
}

Règles d'extraction :
- Extrait les montants en euros (retire les espaces, virgules, symboles €)
- Pour le modèle statique : cherche "Coût total", "Coût OpenPulse par an", "Tarif annuel fixe" ou toute formulation similaire
- Pour le modèle au succès :
  * "frais_acces" : cherche "Frais d'accès", "Frais d'accès au service", "Tarif fixe", "Coût fixe", "Montant fixe initial", "Frais de mise en service" ou toute mention d'un coût unique/ponctuel facturé une seule fois (pas annuel, pas récurrent)
  * "palliers" : extrait TOUS les palliers avec leurs seuils et tarifs annuels basés sur le taux de cotation
- Les seuils sont des pourcentages de taux de cotation (ex: "Moins de 7%" → seuil_max: 7, "7% à 10%" → seuil_min: 7, seuil_max: 10)
- Sois précis avec les montants décimaux (ex: 25847.50)
- IMPORTANT : Distingue bien le frais d'accès unique des tarifs annuels récurrents des palliers
- Si une donnée n'existe pas, retourne null

Retourne uniquement du JSON valide.`
            },
            { 
              role: "user", 
              content: `Analyse cette étude médico-économique et extrait les données financières :\n\n${wrapUserContent(sanitizeForAI(pdfText, { maxLength: 15000, functionName: 'analyze-medical-economic-study' }), "ETUDE_CONTENT")}` 
            }
          ],
          max_completion_tokens: 3000,
          reasoning_effort: "low",
          verbosity: "low",
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error("Azure request timeout (90s)");
      }
      throw error;
    }
    
    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('Azure error:', azureResponse.status, errorText);
      throw new Error(`Azure API error: ${azureResponse.status} - ${errorText}`);
    }
    
    // 5. Parse response
    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in Azure response');
    }
    
    console.log('✅ Azure response received:', content.substring(0, 200));
    
    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Azure response as JSON:', content);
      throw new Error('Invalid JSON response from Azure GPT-5');
    }
    
    // 6. Validate and normalize data - STORE BOTH MODELS
    const updates: any = {};
    
    // ALWAYS store static model if present
    if (extractedData.modele_statique) {
      updates.modele_statique_succes = String(extractedData.modele_statique);
      console.log('📊 Static model detected:', extractedData.modele_statique);
    }
    
    // ALWAYS store success-based model if present
    if (extractedData.modele_au_succes?.palliers?.length > 0) {
      // Build tarifs_palliers and seuils_palliers
      const tarifsData: any = {};
      const seuilsData: any = {};
      
      if (extractedData.modele_au_succes.frais_acces) {
        tarifsData.fixe = extractedData.modele_au_succes.frais_acces;
        console.log('💰 Access fee:', extractedData.modele_au_succes.frais_acces);
      }
      
      extractedData.modele_au_succes.palliers.forEach((pallier: any) => {
        const key = `palier${pallier.numero}`;
        tarifsData[key] = pallier.tarif;
        seuilsData[key] = pallier.seuil_max || pallier.seuil_min;
        console.log(`📈 Pallier ${pallier.numero}: ${pallier.tarif}€ (seuil: ${pallier.seuil_max || pallier.seuil_min}%)`);
      });
      
      updates.tarifs_palliers = tarifsData;
      updates.seuils_palliers = seuilsData;
      
      // Suggest middle tier as target
      const middlePallier = Math.ceil(extractedData.modele_au_succes.palliers.length / 2);
      updates.pallier_vise = `Pallier ${middlePallier}`;
      console.log(`🎯 Suggested target tier: Pallier ${middlePallier}`);
    }
    
    // Only set type_offre if exactly ONE model is detected
    // If both exist, let user choose via UI
    if (extractedData.modele_statique && !extractedData.modele_au_succes?.palliers?.length) {
      updates.type_offre = 'Statique';
      console.log('✅ Auto-set type_offre to: Statique (only static model found)');
    } else if (!extractedData.modele_statique && extractedData.modele_au_succes?.palliers?.length > 0) {
      updates.type_offre = 'Au succès';
      console.log('✅ Auto-set type_offre to: Au succès (only success model found)');
    } else if (extractedData.modele_statique && extractedData.modele_au_succes?.palliers?.length > 0) {
      console.log('⚠️ Both models detected - type_offre unchanged, user will choose');
    }
    
    console.log('📝 Updates to apply:', JSON.stringify(updates, null, 2));
    
    // 7. Update establishment
    const { error: updateError } = await supabaseClient
      .from('etablissements')
      .update(updates)
      .eq('id', etablissement_id);
    
    if (updateError) {
      console.error('Error updating etablissement:', updateError);
      throw new Error(`Failed to update etablissement: ${updateError.message}`);
    }
    
    console.log('✅ Establishment updated successfully');
    
    // 8. Log in ai_processing_log
    await supabaseClient
      .from('ai_processing_log')
      .insert({
        email_thread_id: document_id,
        processing_type: 'medical_economic_study_analysis',
        model_used: 'azure-gpt-5',
        success: true,
        result: extractedData,
        confidence_score: 0.95,
        prompt_tokens: azureData.usage?.prompt_tokens,
        completion_tokens: azureData.usage?.completion_tokens,
        total_tokens: azureData.usage?.total_tokens
      });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        extracted_data: extractedData,
        updates_applied: updates
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("❌ Error in analyze-medical-economic-study:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: sanitizeErrorForClient(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
