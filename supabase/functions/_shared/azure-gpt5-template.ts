/**
 * 🔒 TEMPLATE SANCTUARISÉ AZURE GPT-5
 * 
 * Ce template est basé sur la configuration validée en production.
 * Copier ce fichier pour créer une nouvelle fonction GPT-5.
 * 
 * IMPORTANT: Lire supabase/functions/_shared/azure-gpt5-config.md avant de modifier.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ 1. AUTHENTICATION (optionnel selon fonction)
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

    // ✅ 2. RÉCUPÉRATION DES DONNÉES
    const { input_text } = await req.json();

    if (!input_text) {
      return new Response(
        JSON.stringify({ error: 'Input text required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing request for user:', user.id);

    // ✅ 3. PRÉPARATION DES PROMPTS
    const systemPrompt = `Tu es un assistant IA expert.
Ton rôle est de [DÉCRIRE LE RÔLE ICI].

RÈGLES:
- [RÈGLE 1]
- [RÈGLE 2]
- [RÈGLE 3]

Réponds [FORMAT ATTENDU: texte brut OU JSON].`;

    const userPrompt = `[PRÉPARER LE CONTEXTE POUR L'IA]

Texte à traiter:
${input_text}`;

    // ✅ 4. APPEL AZURE GPT-5 (PATTERN OBLIGATOIRE)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    let azureResponse: Response;
    try {
      console.log('🚀 Starting Azure GPT-5 call...');
      const startTime = Date.now();
      
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
          // ✅ PARAMÈTRES GPT-5 (AU PREMIER NIVEAU)
          max_completion_tokens: 3000,        // Ajuster selon besoin
          reasoning_effort: "low",         // "low" | "medium" | "high"
          verbosity: "low",                   // "low" | "medium" | "high"
          
          // ✅ Optional: response_format pour JSON
          // response_format: { type: "json_object" }  // Décommenter si besoin
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`✅ Azure response received in ${Date.now() - startTime}ms`);

      // ✅ Retry simple sur rate limit
      if (azureResponse.status === 429) {
        console.warn('⚠️ Azure rate limited, backing off 1s and retrying once...');
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
            max_completion_tokens: 3000,
            reasoning_effort: "low",
            verbosity: "low",
          }),
        });
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ Azure request timeout (90s)');
        return new Response(
          JSON.stringify({ error: 'Request timeout - Azure took too long to respond' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // ✅ 5. VALIDATION DE LA RÉPONSE
    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('❌ Azure OpenAI error:', azureResponse.status, errorText);
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
    }

    // ✅ 6. EXTRACTION DU CONTENU (SIMPLE)
    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('❌ Unexpected response format:', JSON.stringify(azureData, null, 2));
      throw new Error('No content in Azure response');
    }

    console.log('✅ Content extracted, length:', content.length);

    // ✅ 7. TRAITEMENT DU RÉSULTAT
    
    // Option A: Réponse texte brut
    const result = content.trim();

    // Option B: Réponse JSON (si response_format: json_object utilisé)
    // let result;
    // try {
    //   result = JSON.parse(content);
    // } catch (e) {
    //   console.error('❌ Failed to parse JSON:', content);
    //   throw new Error('Invalid JSON returned by Azure model');
    // }

    // ✅ 8. LOG USAGE (optionnel mais recommandé)
    const usage = azureData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    console.log('📊 Token usage:', usage);

    // ✅ 9. RÉPONSE SUCCÈS
    return new Response(
      JSON.stringify({
        success: true,
        result: result,
        usage: usage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in function:', error);
    // NOTE: import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts" in your function.
    const { sanitizeErrorForClient } = await import("./error-sanitizer.ts");
    return new Response(
      JSON.stringify({ 
        error: sanitizeErrorForClient(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * NOTES D'IMPLÉMENTATION:
 * 
 * 1. PARAMÈTRES GPT-5:
 *    - reasoning_effort: Ajuster selon complexité ("low" pour simple, "high" pour complexe)
 *    - verbosity: Ajuster selon longueur désirée ("low" pour concis, "high" pour détaillé)
 *    - max_completion_tokens: Ajuster selon taille attendue (1000-4000 typique)
 * 
 * 2. TIMEOUT:
 *    - 90s est le standard
 *    - GPT-5 peut prendre 30-90s selon reasoning_effort
 * 
 * 3. RETRY:
 *    - Un seul retry sur 429 (rate limit)
 *    - Backoff de 1s suffisant
 * 
 * 4. LOGS:
 *    - Logger tous les appels, réponses, erreurs
 *    - Essentiel pour le débogage
 * 
 * 5. RESPONSE_FORMAT:
 *    - Utiliser { type: "json_object" } seulement si nécessaire
 *    - Ajouter "Réponds en JSON valide" dans le system prompt
 * 
 * 6. ERREURS COURANTES À ÉVITER:
 *    - ❌ Paramètres imbriqués (reasoning: { effort })
 *    - ❌ Parsing JSON complexe avec fallbacks
 *    - ❌ Wrapper de fonction complexe
 *    - ❌ Pas de timeout
 *    - ❌ Pas de logs d'erreur
 * 
 * Pour plus de détails, voir: supabase/functions/_shared/azure-gpt5-config.md
 */
