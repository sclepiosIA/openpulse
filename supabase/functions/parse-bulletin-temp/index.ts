/**
 * Edge Function: parse-bulletin-temp
 * 
 * Parse un bulletin de salaire PDF sans créer d'enregistrement en base.
 * Retourne uniquement les données extraites pour traitement ultérieur.
 * Utilisé pour l'upload en masse de bulletins.
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

    const { storage_path } = await req.json();

    if (!storage_path) {
      return new Response(
        JSON.stringify({ error: 'Missing storage_path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Starting temp bulletin parsing:', { storage_path });

    // 1. Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('rh-documents')
      .download(storage_path);

    if (downloadError) {
      console.error('❌ Error downloading file:', downloadError);
      throw new Error('Failed to download PDF file');
    }

    console.log('✅ File downloaded, size:', fileData.size);

    // 2. Convertir le Blob en ArrayBuffer pour extraction de texte
    const arrayBuffer = await fileData.arrayBuffer();

    // 3. Extract text from PDF
    let extractedText = '';
    try {
      extractedText = await extractTextFromPDF(arrayBuffer);
      console.log('✅ PDF text extracted, length:', extractedText.length);

      if (!extractedText || extractedText.length < 100) {
        throw new Error('PDF text extraction failed - content too short');
      }
    } catch (e) {
      console.error('❌ PDF text extraction failed:', e);
      throw new Error('Unable to extract text from PDF');
    }

    // 4. Préparer le prompt GPT-5
    const systemPrompt = `Tu es un expert en analyse de bulletins de salaire français. 
Ta mission est d'extraire TOUTES les informations d'un bulletin de salaire au format JSON strict.

RÈGLES IMPORTANTES:
- Si une information n'est pas présente, utilise null (pas de string vide)
- Les montants doivent être en euros (nombres décimaux sans symbole)
- Le mois doit être au format YYYY-MM-01
- Sois très précis sur les chiffres
- Calcule un score de confiance (0-100) basé sur la clarté des informations
- Si le texte est illisible ou incomplet, mets confidence à 0 et tous les champs à null

⚠️ RÈGLES STRICTES POUR LES NOMS ET PRÉNOMS:
- Le nom doit être le NOM DE FAMILLE uniquement (ex: "Durand", "Martin", "Dubois")
- Le prénom doit être le PRÉNOM uniquement (ex: "Camille", "Marie", "Pierre")
- Ne mets JAMAIS le nom complet dans un seul champ
- Supprime tous les titres (M., Mme, Mlle, Dr, Pr, etc.)
- Supprime les particules isolées (de, du, des, etc.) SAUF si elles font partie intégrante du nom (ex: "De Gaulle", "Van Gogh")
- Si le nom est en MAJUSCULES dans le PDF, convertis en Capitales normales (ex: "MARTIN" → "Martin", "COVIAUX" → "Durand")
- Si tu vois "COVIAUX Camille", extrais nom="Durand" et prenom="Camille"
- Si tu vois "Camille COVIAUX", extrais prenom="Camille" et nom="Durand"
- Ne garde PAS les espaces multiples dans les noms
- Exemples corrects:
  * "M. MARTIN Pierre" → nom="Martin", prenom="Pierre"
  * "DUPONT-DURAND Marie" → nom="Dupont-Durand", prenom="Marie"
  * "Dr. Jean DE LA FONTAINE" → nom="De La Fontaine", prenom="Jean"

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
${extractedText}
---`;

    // 5. Appel Azure GPT-5 avec retry limité
    console.log('🤖 Calling Azure GPT-5...');
    const GLOBAL_TIMEOUT = 120000; // 2 minutes max
    const REQUEST_TIMEOUT = 45000; // 45s par requête
    const MAX_RETRIES = 2; // Maximum 2 retry (3 tentatives au total)

    const globalController = new AbortController();
    const globalTimeoutId = setTimeout(() => globalController.abort(), GLOBAL_TIMEOUT);

    let azureResponse: Response | null = null;
    let retryCount = 0;

    try {
      while (!azureResponse && retryCount <= MAX_RETRIES) {
        const requestController = new AbortController();
        const requestTimeoutId = setTimeout(() => requestController.abort(), REQUEST_TIMEOUT);

        try {
          const response = await fetch(AZURE_OPENAI_ENDPOINT!, {
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
            signal: requestController.signal,
          });

          clearTimeout(requestTimeoutId);

          if (response.status === 429 && retryCount < MAX_RETRIES) {
            console.warn(`⚠️ Azure rate limited (attempt ${retryCount + 1}), backing off ${(retryCount + 1) * 1000}ms...`);
            await new Promise(r => setTimeout(r, (retryCount + 1) * 1000));
            retryCount++;
            continue;
          }

          azureResponse = response;
          break;

        } catch (error: any) {
          clearTimeout(requestTimeoutId);
          if (error.name === 'AbortError' && retryCount < MAX_RETRIES) {
            console.warn(`⚠️ Request timeout (attempt ${retryCount + 1}), retrying...`);
            retryCount++;
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw error;
        }
      }

      clearTimeout(globalTimeoutId);

      if (!azureResponse) {
        throw new Error(`Azure API failed after ${MAX_RETRIES + 1} attempts`);
      }

    } catch (error: any) {
      clearTimeout(globalTimeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ Global timeout exceeded');
        throw new Error('Global timeout exceeded (2 minutes)');
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('❌ Azure OpenAI error:', azureResponse.status, errorText);
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('❌ Unexpected response format');
      throw new Error('No content in Azure response');
    }

    console.log('✅ GPT-5 response received');

    // 6. Parser le JSON
    let extractedData;
    try {
      extractedData = JSON.parse(content);
      
      if (!extractedData.hasOwnProperty('confidence')) {
        extractedData.confidence = 0;
      }
      
      console.log('✅ JSON parsed, confidence:', extractedData.confidence);
      
    } catch (e) {
      console.error('❌ Failed to parse JSON');
      
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
    }

    // 7. Retourner le résultat
    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        processing_duration_ms: Date.now() - startTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    return buildErrorResponse('parse-bulletin-temp', error, corsHeaders, 500);
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
