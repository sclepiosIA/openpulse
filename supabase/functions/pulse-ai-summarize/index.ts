import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

interface SummarizePayload {
  conversation_id: string;
  action: 'summarize' | 'suggest_response' | 'extract_actions';
  message_ids?: string[];
}

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

    // Get the profile ID from auth user ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.error('[Pulse AI] Profile not found for user:', user.id);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: SummarizePayload = await req.json();
    console.log('[Pulse AI] Action:', payload.action, 'Conversation:', payload.conversation_id, 'Profile:', profile.id);

    // Verify user is member of conversation using profile.id
    const { data: membership } = await supabase
      .from('pulse_conversation_members')
      .select('id')
      .eq('conversation_id', payload.conversation_id)
      .eq('user_id', profile.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this conversation' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent messages
    let messagesQuery = supabase
      .from('pulse_messages')
      .select(`
        id,
        content,
        created_at,
        user:profiles!pulse_messages_user_id_fkey(nom, prenom)
      `)
      .eq('conversation_id', payload.conversation_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (payload.message_ids && payload.message_ids.length > 0) {
      messagesQuery = messagesQuery.in('id', payload.message_ids);
    }

    const { data: messages, error: msgError } = await messagesQuery;

    if (msgError) {
      console.error('[Pulse AI] Failed to fetch messages:', msgError);
      throw new Error('Failed to fetch messages');
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ 
        result: 'Aucun message à analyser dans cette conversation.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format messages for AI (with sanitization)
    const formattedMessages = messages
      .reverse()
      .map((m: any) => {
        const userName = m.user ? `${m.user.prenom} ${m.user.nom}` : 'Inconnu';
        const sanitizedContent = sanitizeForAI(m.content, { maxLength: 500, functionName: 'pulse-ai-summarize' });
        return `[${new Date(m.created_at).toLocaleString('fr-FR')}] ${userName}: ${sanitizedContent}`;
      })
      .join('\n');

    // Build prompt based on action
    let systemPrompt = '';
    let userPrompt = '';

    switch (payload.action) {
      case 'summarize':
        systemPrompt = `Tu es un assistant qui résume des conversations d'équipe de manière concise et professionnelle.
Produis un résumé structuré qui inclut:
- Les points clés discutés
- Les décisions prises
- Les questions en suspens

Réponds en JSON avec cette structure:
{
  "summary": "Résumé général en 2-3 phrases",
  "key_points": ["point 1", "point 2"],
  "decisions": ["décision 1"],
  "open_questions": ["question 1"]
}`;
        userPrompt = `Voici la conversation à résumer:\n\n${formattedMessages}`;
        break;

      case 'suggest_response':
        systemPrompt = `Tu es un assistant qui suggère des réponses pertinentes dans le contexte d'une conversation d'équipe professionnelle.
Propose 3 réponses possibles de tons différents (formel, amical, concis).

Réponds en JSON:
{
  "suggestions": [
    {"tone": "formel", "text": "..."},
    {"tone": "amical", "text": "..."},
    {"tone": "concis", "text": "..."}
  ]
}`;
        userPrompt = `Voici la conversation récente. Suggère des réponses appropriées au dernier message:\n\n${formattedMessages}`;
        break;

      case 'extract_actions':
        systemPrompt = `Tu es un assistant qui extrait les actions et tâches mentionnées dans une conversation d'équipe.
Identifie les tâches à faire, qui devrait les faire, et leur urgence.

Réponds en JSON:
{
  "actions": [
    {
      "description": "Description de la tâche",
      "assignee_hint": "Indice sur qui devrait la faire (nom mentionné ou 'non assigné')",
      "priority": "haute|moyenne|basse",
      "deadline_hint": "Indice de deadline si mentionné"
    }
  ]
}`;
        userPrompt = `Voici la conversation. Extrait les actions et tâches mentionnées:\n\n${formattedMessages}`;
        break;
    }

    // Call Azure GPT-5
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Azure OpenAI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_completion_tokens: 2000,
          reasoning_effort: "low",
          verbosity: "low",
          response_format: { type: "json_object" }
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (azureResponse.status === 429) {
        console.warn('[Pulse AI] Rate limited, retrying...');
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_completion_tokens: 2000,
            reasoning_effort: "low",
            verbosity: "low",
            response_format: { type: "json_object" }
          }),
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('[Pulse AI] Azure request timeout');
        throw new Error('Azure request timeout (90s)');
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('[Pulse AI] Azure error:', azureResponse.status, errorText);
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Pulse AI] No content in response');
      throw new Error('No content in Azure response');
    }

    const result = JSON.parse(content);
    const usage = extractUsage(azureData);

    // Log AI response using profile.id
    await supabase.from('pulse_ai_responses').insert({
      conversation_id: payload.conversation_id,
      user_id: profile.id,
      prompt: payload.action,
      response_text: content,
      model: 'gpt-5',
      tokens_input: usage.prompt_tokens,
      tokens_output: usage.completion_tokens,
    });

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'pulse_summarize',
      model_used: 'gpt-5',
      ...usage,
      success: true,
      context_type: 'conversation',
      context_id: payload.conversation_id,
      processed_by: profile.id,
    });

    console.log('[Pulse AI] Success for action:', payload.action);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    return buildErrorResponse('pulse-ai-summarize', error, corsHeaders, 500);
  }
});
