import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent } from "../_shared/security-utils.ts";
import { logAICall } from "../_shared/ai-logging.ts";
import { callGpt5Mini } from "../_shared/azure-gpt5-mini.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const STRUCTURE_PROMPT = `Tu es un assistant de prise de notes professionnelles.
L'utilisateur te donne une note brute qu'il souhaite STRUCTURER pour la rendre plus lisible.

Ta tâche : Restructure le contenu pour le rendre :
- Plus clair et organisé avec une hiérarchie logique
- Avec des titres en gras pour les sections principales
- Des listes à puces (ul/li) pour les points clés
- Des checklists (utilise la syntaxe HTML: <ul data-type="taskList"><li data-type="taskItem" data-checked="false">...</li></ul>) pour les actions/tâches à faire
- Correction orthographique et grammaticale

RÈGLES STRICTES :
- Retourne UNIQUEMENT du HTML valide compatible avec TipTap
- Utilise <p>, <strong>, <ul>, <ol>, <li> pour la structure
- Pour les checklists/tâches, utilise: <ul data-type="taskList"><li data-type="taskItem" data-checked="false">Action à faire</li></ul>
- Ne modifie pas le sens du contenu original
- Ne réponds JAMAIS comme un chatbot - restructure simplement le texte
- Pas de markdown, uniquement HTML`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content } = await req.json();

    console.log('[Structure Note] User:', user.id, 'Content length:', content?.length);

    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Contenu vide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (content.length > 10000) {
      return new Response(JSON.stringify({ error: 'Contenu trop long (max 10000 caractères)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize and wrap content
    const sanitizedContent = sanitizeForAI(content);
    const wrappedContent = wrapUserContent(sanitizedContent);

    const startTime = Date.now();

    // Call GPT-5 Mini for fast restructuring
    const response = await callGpt5Mini(STRUCTURE_PROMPT, wrappedContent, {
      maxTokens: 3000,
      timeout: 45000,
    });

    const processingTime = Date.now() - startTime;
    console.log('[Structure Note] Success in', processingTime, 'ms');

    // Log the AI call
    await logAICall({
      processing_type: 'note_structuring',
      model_used: response.model,
      success: true,
      processing_duration_ms: processingTime,
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
      result: { original_length: content.length, structured_length: response.content.length },
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        structured_content: response.content,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {

    const errMsg = error instanceof Error ? error.message : 'unknown';
    await logAICall({
      processing_type: 'note_structuring',
      model_used: 'gpt-5-mini',
      success: false,
      error_message: errMsg,
    }).catch(() => {});

    return buildErrorResponse('structure-note', error, corsHeaders, 500);
  }

});
