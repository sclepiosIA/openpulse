/**
 * jarvis-vision - Analyse d'images avec GPT-5 Vision
 * 
 * Supporte OCR, analyse documentaire, extraction de données
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { logAICall, createTimer, extractUsage } from "../_shared/ai-logging.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const timer = createTimer();

  try {
    // Authentification OBLIGATOIRE - prévient l'abus de l'API Vision
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;

    if (authError || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { image_base64, image_url, prompt, task } = await req.json();

    if (!image_base64 && !image_url) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Image required (base64 or URL)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Azure OpenAI not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build vision message
    const imageContent = image_base64 
      ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : { type: 'image_url', image_url: { url: image_url } };

    // Task-specific system prompts
    const systemPrompts: Record<string, string> = {
      'ocr': `Tu es un expert en OCR pour OpenPulse. 
Extrais tout le texte visible de cette image, préserve la structure et la mise en forme.
Utilise des retours à la ligne et de l'indentation pour représenter la mise en page originale.
Si le document contient des tableaux, représente-les clairement.`,
      
      'analyze': `Tu es un expert en analyse documentaire pour OpenPulse.
Analyse cette image et décris son contenu de manière détaillée et structurée.
Identifie le type de document, les éléments clés, et toute information pertinente.`,
      
      'extract_data': `Tu es un expert en extraction de données pour OpenPulse.
Identifie et structure toutes les données clés de ce document.
Retourne les données au format JSON avec les champs suivants si présents:
- noms, prénoms, identités
- dates (formats ISO)
- montants (en nombres)
- adresses
- numéros de téléphone
- emails
- références et numéros de document
- toute autre donnée structurée pertinente`,
      
      'summarize': `Tu es un assistant OpenPulse.
Résume le contenu de cette image en quelques phrases claires et concises.
Focus sur les informations les plus importantes et actionnables.`,
    };

    const systemPrompt = systemPrompts[task] || systemPrompts['analyze'];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let response: Response;
    try {
      response = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                imageContent,
                { type: 'text', text: prompt || 'Analyse cette image.' }
              ]
            }
          ],
          max_completion_tokens: 4000,
          reasoning_effort: 'medium',
          verbosity: 'medium',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry sur rate limit
      if (response.status === 429) {
        console.warn('[jarvis-vision] Rate limited, retrying in 1s...');
        await new Promise(r => setTimeout(r, 1000));
        response = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  imageContent,
                  { type: 'text', text: prompt || 'Analyse cette image.' }
                ]
              }
            ],
            max_completion_tokens: 4000,
            reasoning_effort: 'medium',
            verbosity: 'medium',
          }),
        });
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Azure request timeout (90s)');
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[jarvis-vision] Azure error: ${response.status}`, errorText);
      throw new Error(`Azure Vision error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const usage = extractUsage(data);
    const duration = timer.stop();

    // Log AI call
    await logAICall({
      processing_type: `jarvis-vision-${task}`,
      model_used: 'gpt-5-vision',
      ...usage,
      processing_duration_ms: duration,
      success: true,
      result: { task, content_length: content?.length || 0 },
      processed_by: userId,
    });

    console.log(`[jarvis-vision] Analysis completed (${task}) in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      content,
      task,
      usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[jarvis-vision] Error:', error);
    
    await logAICall({
      processing_type: 'jarvis-vision',
      model_used: 'gpt-5-vision',
      processing_duration_ms: timer.stop(),
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return buildErrorResponse('jarvis-vision', error, corsHeaders, 500);
  }
});
