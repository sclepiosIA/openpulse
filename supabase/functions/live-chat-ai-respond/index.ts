import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-internal-secret, x-session-token;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔒 SECURITY: this endpoint uses a service_role client to read/write live
  // chat conversations. It must only be invoked by trusted internal callers
  // (other Edge Functions, CRON, server-side jobs) — not by browser visitors.
  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;

  // V2d hardening — per-IP rate limit (defense-in-depth)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = checkRateLimit(`live-chat-ai-respond:${ip}`, { limit: 15, windowSec: 60 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Trop de requêtes, veuillez patienter.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec ?? 60) }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversation_id, message } = await req.json();

    if (!conversation_id || !message) {
      return new Response(
        JSON.stringify({ error: 'conversation_id et message sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 SECURITY: Sanitize user message before AI processing
    const sanitizedMessage = sanitizeForAI(message, {
      maxLength: 2000,
      strictMode: false,
      functionName: 'live-chat-ai-respond'
    });

    // Get conversation context
    const { data: conversation, error: convError } = await supabase
      .from('live_chat_conversations')
      .select('*, etablissement:etablissements(id, nom)')
      .eq('id', conversation_id)
      .single();

    if (convError) throw convError;

    // Get recent messages for context
    const { data: recentMessages, error: msgError } = await supabase
      .from('live_chat_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (msgError) throw msgError;

    // Search knowledge base for relevant articles
    const { data: articles, error: kbError } = await supabase
      .from('knowledge_base_articles')
      .select('id, title, content, category')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .textSearch('title', message.split(' ').join(' | '), { type: 'websearch' })
      .limit(3);

    // If no results from title search, try content
    let relevantArticles = articles || [];
    if (relevantArticles.length === 0) {
      const { data: contentArticles } = await supabase
        .from('knowledge_base_articles')
        .select('id, title, content, category')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .limit(5);
      relevantArticles = contentArticles || [];
    }

    // Build context from knowledge base
    const kbContext = relevantArticles.length > 0
      ? `Articles de la base de connaissances pertinents:\n${relevantArticles.map(a => 
          `- ${a.title}: ${a.content?.substring(0, 500)}...`
        ).join('\n')}`
      : 'Aucun article pertinent trouvé dans la base de connaissances.';

    // Build conversation history
    const conversationHistory = (recentMessages || [])
      .reverse()
      .map(m => `${m.sender_type === 'visitor' ? 'Client' : 'Support'}: ${m.content}`)
      .join('\n');

    // Prepare prompts
    const systemPrompt = `Tu es un assistant de support client intelligent pour OpenPulse, une plateforme de gestion pour le secteur de la santé.

Tu dois:
1. Répondre de manière professionnelle et empathique
2. Utiliser les informations de la base de connaissances quand disponibles
3. Si tu ne peux pas répondre, suggérer d'escalader vers un agent humain
4. Garder tes réponses concises mais complètes (max 3-4 phrases)

${kbContext}

Établissement client: ${conversation.etablissement?.nom || 'Non identifié'}`;

    // 🔒 SECURITY: Wrap user content with XML delimiters
    const wrappedMessage = wrapUserContent(sanitizedMessage, 'VISITOR_MESSAGE');
    
    const userPrompt = `Historique de la conversation:
${conversationHistory}

Nouveau message du client: ${wrappedMessage}

Génère une réponse appropriée. Si tu proposes d'escalader, réponds avec le format JSON: {"escalate": true, "reason": "raison", "response": "message au client"}. Sinon réponds en texte simple.`;

    // Call Azure GPT-5
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI credentials not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 500,
          reasoning_effort: 'low',
          verbosity: 'low',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (azureResponse.status === 429) {
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_completion_tokens: 500,
            reasoning_effort: 'low',
            verbosity: 'low',
          }),
        });
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Azure request timeout (60s)');
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('Azure API error:', azureResponse.status, errorText);
      throw new Error(`Azure API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const aiContent = azureData.choices?.[0]?.message?.content || '';

    // Parse response
    let shouldEscalate = false;
    let escalateReason = '';
    let responseText = aiContent;

    try {
      if (aiContent.includes('"escalate"')) {
        const jsonMatch = aiContent.match(/\{[\s\S]*"escalate"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          shouldEscalate = parsed.escalate === true;
          escalateReason = parsed.reason || '';
          responseText = parsed.response || aiContent;
        }
      }
    } catch {
      // Keep aiContent as response if JSON parsing fails
    }

    // Save bot message
    const { error: insertError } = await supabase
      .from('live_chat_messages')
      .insert({
        conversation_id,
        content: responseText,
        content_type: 'text',
        sender_type: 'bot',
        sender_id: null,
        is_internal: false,
      });

    if (insertError) throw insertError;

    // Update conversation
    await supabase
      .from('live_chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    // If escalation needed, update status
    if (shouldEscalate) {
      await supabase
        .from('live_chat_conversations')
        .update({
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          escalated_reason: escalateReason || 'Demande client complexe',
        })
        .eq('id', conversation_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        escalated: shouldEscalate,
        escalate_reason: escalateReason,
        used_kb_articles: relevantArticles.map(a => a.id),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in live-chat-ai-respond:', error);
    return buildErrorResponse('live-chat-ai-respond', error, corsHeaders, 500);
  }
});
