/**
 * JARVIS Brain Stream - V3 Hardened SSE
 * 
 * Changes from V2:
 * - Phase-specific SSE events at every critical step
 * - Timeout kept until body is fully consumed (not just fetch response)
 * - Guaranteed done/error on ALL paths
 * - Broader Azure stream parser (content OR text)
 * - Detailed logging for each phase
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { getJarvisStreamingPrompt } from "../_shared/jarvis-system-prompt.ts";
import { buildOptimizedContext, getSystemHealthStatus } from "../_shared/optimized-context-builder.ts";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
const TIMEOUT_MS = 90000;

interface StreamRequest {
  user_id: string;
  message: string;
  conversation_id?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  enable_tools?: boolean;
  page_context?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const request: StreamRequest = await req.json();

    if (!request.message) {
      throw new Error('Missing required field: message');
    }

    // Override user_id from JWT for non-service callers (prevent IDOR)
    if (!auth.isServiceCall && auth.userId) {
      request.user_id = auth.userId;
    }
    if (!request.user_id) {
      throw new Error('Missing required field: user_id');
    }

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI credentials not configured');
    }

    const enableTools = request.enable_tools !== false;
    console.log(`[JARVIS Stream] START user=${request.user_id} tools=${enableTools} msg="${request.message.slice(0, 80)}"`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    const userClient = (!auth.isServiceCall && authHeader)
      ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
      : serviceClient;

    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('id, prenom, nom, email, fonction')
      .eq('user_id', request.user_id)
      .single();

    const profile = profileData || (await serviceClient
      .from('profiles')
      .select('id, prenom, nom, email, fonction')
      .eq('id', request.user_id)
      .single()).data;

    const profileId = profile?.id || request.user_id;

    const [memoriesResult, healthStatus, richContext] = await Promise.all([
      serviceClient
        .from('jarvis_user_memory')
        .select('category, key, value')
        .eq('user_id', request.user_id)
        .order('importance', { ascending: false })
        .limit(10),
      getSystemHealthStatus(serviceClient),
      buildOptimizedContext(userClient, profileId),
    ]);

    const userMemories = memoriesResult.data;
    const memoryContext = userMemories?.length 
      ? `\nMÉMOIRE: ${userMemories.slice(0, 5).map(m => `${m.key}=${m.value}`).join('; ')}`
      : '';

    const pageContextStr = request.page_context ? `\nPAGE CONTEXT:\n${request.page_context}` : '';
    const userContext = profile 
      ? `\nUSER: ${profile.prenom || ''} ${profile.nom || ''} <${profile.email || ''}>${profile.fonction ? ` (${profile.fonction})` : ''}` + memoryContext + richContext + pageContextStr
      : memoryContext + richContext + pageContextStr;

    console.log(`[JARVIS Stream] Context built: profile=${!!profile}, memories=${userMemories?.length || 0}, richCtx=${richContext.length}ch`);

    const systemPrompt = getJarvisStreamingPrompt();
    const messages = [
      { role: "system", content: systemPrompt + userContext },
      ...(request.conversation_history || []).slice(-6),
      { role: "user", content: request.message }
    ];

    const encoder = new TextEncoder();
    
    // Helper to safely enqueue SSE data
    const sseEvent = (controller: ReadableStreamDefaultController, payload: Record<string, unknown>) => {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      } catch { /* stream closed */ }
    };

    const stream = new ReadableStream({
      async start(controller) {
        const abortController = new AbortController();
        // NOTE: timeout is NOT cleared until the entire body is consumed
        const timeoutId = setTimeout(() => {
          console.warn('[JARVIS Stream] Global timeout after 90s');
          abortController.abort();
        }, TIMEOUT_MS);

        let doneEmitted = false;

        // Ensure done or error is always emitted
        const emitDone = (content: string) => {
          if (doneEmitted) return;
          doneEmitted = true;
          sseEvent(controller, { type: 'done', content });
          try { controller.close(); } catch { /* already closed */ }
        };

        const emitError = (msg: string) => {
          if (doneEmitted) return;
          doneEmitted = true;
          sseEvent(controller, { error: msg });
          sseEvent(controller, { type: 'done', content: '' });
          try { controller.close(); } catch { /* already closed */ }
        };

        try {
          // Phase 1: Analyse
          sseEvent(controller, { type: 'reasoning', step: 1, phase: 'analyze', label: 'Analyse de la demande...', status: 'active' });

          const needsAction = enableTools && detectActionIntent(request.message);
          console.log(`[JARVIS Stream] Intent: needsAction=${needsAction}`);

          sseEvent(controller, { type: 'reasoning', step: 1, phase: 'analyze', label: 'Analyse terminée', status: 'completed' });

          if (needsAction) {
            // === DELEGATION PATH ===
            sseEvent(controller, { type: 'reasoning', step: 2, phase: 'tools', label: 'Exécution d\'actions...', status: 'active' });

            // Keepalive + informative deltas during delegation to keep SSE alive
            // and inform the user that processing is still underway.
            let elapsed = 0;
            const progressMessages = [
              { at: 15, text: 'Préparation des outils...' },
              { at: 30, text: 'Analyse approfondie en cours...' },
              { at: 45, text: 'Synthèse des résultats...' },
              { at: 60, text: 'Finalisation de la réponse...' },
            ];
            const keepaliveInterval = setInterval(() => {
              elapsed += 5;
              try { controller.enqueue(encoder.encode(`: keepalive\n\n`)); } catch { /* closed */ }
              const msg = progressMessages.find(m => m.at === elapsed);
              if (msg) {
                sseEvent(controller, { type: 'reasoning', step: 2, phase: 'tools', label: msg.text, status: 'active' });
              }
            }, 5000);

            // Internal timeout: 75s — gives jarvis-brain time but stays under
            // the 90s global timeout so we can degrade gracefully.
            const brainAbort = new AbortController();
            const brainTimeoutId = setTimeout(() => {
              console.warn('[JARVIS Stream] Brain delegation timeout (75s) — aborting');
              brainAbort.abort();
            }, 75000);

            let brainResponse: Response | null = null;
            let brainTimedOut = false;
            try {
              console.log('[JARVIS Stream] Delegating to jarvis-brain...');
              brainResponse = await fetch(`${supabaseUrl}/functions/v1/jarvis-brain`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': authHeader || `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  user_id: request.user_id,
                  message: request.message,
                  conversation_id: request.conversation_id,
                  conversation_history: request.conversation_history,
                  autonomous_mode: true,
                  // Hints for jarvis-brain to reduce latency
                  reasoning_hint: 'low',
                  max_iterations_hint: 5,
                }),
                signal: brainAbort.signal,
              });
            } catch (fetchErr: unknown) {
              clearInterval(keepaliveInterval);
              clearTimeout(brainTimeoutId);
              if (fetchErr?.name === 'AbortError') {
                brainTimedOut = true;
                console.warn('[JARVIS Stream] Brain delegation timed out gracefully');
              } else {
                clearTimeout(timeoutId);
                console.error('[JARVIS Stream] jarvis-brain fetch failed:', fetchErr);
                emitError('Impossible de contacter le service d\'actions. Réessayez.');
                return;
              }
            } finally {
              clearInterval(keepaliveInterval);
              clearTimeout(brainTimeoutId);
            }

            // Graceful degradation if brain timed out
            if (brainTimedOut || !brainResponse) {
              sseEvent(controller, { type: 'reasoning', step: 2, phase: 'tools', label: 'Délai dépassé', status: 'completed' });
              clearTimeout(timeoutId);
              emitDone(
                "⏱️ La synthèse a pris trop de temps à se terminer.\n\n" +
                "Vos actions ont peut-être été exécutées en arrière-plan. " +
                "Reformulez votre question de manière plus précise (par exemple, demandez **une** action à la fois) " +
                "pour obtenir une réponse plus rapide."
              );
              return;
            }

            if (!brainResponse.ok) {
              const errText = await brainResponse.text().catch(() => '');
              console.error('[JARVIS Stream] jarvis-brain error:', brainResponse.status, errText.slice(0, 200));
              clearTimeout(timeoutId);
              const errorMsg = brainResponse.status === 429 
                ? 'Trop de requêtes, réessayez dans quelques instants.'
                : 'Erreur lors du traitement. Réessayez votre question.';
              sseEvent(controller, { type: 'reasoning', step: 2, phase: 'tools', label: 'Erreur', status: 'completed' });
              emitDone(`⚠️ ${errorMsg}`);
              return;
            }

            const brainData = await brainResponse.json();
            let fullContent = brainData.content || brainData.response || brainData.message || '';
            
            if (!fullContent && brainData.success !== false) {
              const toolNames = brainData.tools_used?.map((t: any) => t.name || t).join(', ') || 'action';
              fullContent = `✅ Action exécutée avec succès (${toolNames}). Vérifiez le résultat dans l'interface.`;
            }
            
            // Emit tool info
            if (brainData.tools_used?.length > 0) {
              for (const tool of brainData.tools_used) {
                sseEvent(controller, { type: 'tool_start', tool: tool.name || tool, args: [], round: 1 });
                sseEvent(controller, { type: 'tool_result', tool: tool.name || tool, success: tool.success !== false, summary: tool.message || 'Exécuté', round: 1 });
              }
            }

            sseEvent(controller, { type: 'reasoning', step: 2, phase: 'tools', label: 'Actions terminées', status: 'completed' });
            sseEvent(controller, { type: 'reasoning', step: 3, phase: 'generate', label: 'Réponse...', status: 'active' });

            // Simulate streaming of delegated response
            const chunkSize = 12;
            for (let i = 0; i < fullContent.length; i += chunkSize) {
              const chunk = fullContent.slice(i, i + chunkSize);
              sseEvent(controller, { type: 'delta', content: chunk });
              if (i + chunkSize < fullContent.length) {
                await new Promise(r => setTimeout(r, 6));
              }
            }

            sseEvent(controller, { type: 'reasoning', step: 3, phase: 'generate', label: 'Terminé', status: 'completed' });
            clearTimeout(timeoutId);
            emitDone(fullContent);
            return;
          }

          // === STANDARD STREAMING PATH ===
          sseEvent(controller, { type: 'reasoning', step: 2, phase: 'generate', label: 'Génération en cours...', status: 'active' });

          // Keepalive while waiting for Azure first token
          const azureKeepaliveInterval = setInterval(() => {
            try { controller.enqueue(encoder.encode(`: keepalive\n\n`)); } catch { /* closed */ }
          }, 8000);

          let response: Response;
          try {
            response = await fetch(AZURE_OPENAI_ENDPOINT!, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "api-key": AZURE_OPENAI_API_KEY!,
              },
              body: JSON.stringify({
                messages,
                stream: true,
                max_completion_tokens: 3000,
                reasoning_effort: "medium",
                verbosity: "medium",
              }),
              signal: abortController.signal,
            });
          } catch (fetchErr) {
            clearInterval(azureKeepaliveInterval);
            clearTimeout(timeoutId);
            console.error('[JARVIS Stream] Azure fetch failed:', fetchErr);
            emitError('Impossible de contacter Azure OpenAI. Réessayez.');
            return;
          } finally {
            clearInterval(azureKeepaliveInterval);
          }

          if (!response.ok) {
            if (response.status === 429) {
              await new Promise(r => setTimeout(r, 1000));
              const retryResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
                method: "POST",
                headers: { "Content-Type": "application/json", "api-key": AZURE_OPENAI_API_KEY! },
                body: JSON.stringify({ messages, stream: true, max_completion_tokens: 3000, reasoning_effort: "medium", verbosity: "medium" }),
                signal: abortController.signal,
              });
              if (retryResponse.ok) {
                const content = await processStream(retryResponse, controller, encoder, sseEvent, request, serviceClient, abortController);
                clearTimeout(timeoutId);
                emitDone(content);
                return;
              }
            }
            const errorText = await response.text().catch(() => '');
            console.error('[JARVIS Stream] Azure error:', response.status, errorText.slice(0, 200));
            clearTimeout(timeoutId);
            emitError(`Erreur Azure (${response.status}). Réessayez.`);
            return;
          }

          console.log('[JARVIS Stream] Azure streaming started');
          const content = await processStream(response, controller, encoder, sseEvent, request, serviceClient, abortController);
          sseEvent(controller, { type: 'reasoning', step: 2, phase: 'generate', label: 'Terminé', status: 'completed' });
          clearTimeout(timeoutId);
          emitDone(content);

        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('[JARVIS Stream] Aborted (timeout or cancel)');
            emitError('Délai d\'attente dépassé (90s).');
          } else {
            console.error('[JARVIS Stream] Unhandled error:', error);
            emitError(error instanceof Error ? error.message : 'Erreur interne');
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[JARVIS Stream] Top-level error:', errorMessage);
    return buildErrorResponse('jarvis-brain-stream', fetchErr, corsHeaders, 500);
  }
});

/**
 * STRICT detection — only true MUTATIONS (create/update/delete/send/schedule)
 * trigger the slow brain delegation path.
 *
 * Informational queries ("aide-moi à préparer", "résume", "combien", "quels sont",
 * "liste", "montre", etc.) go through the FAST direct Azure streaming path.
 */
function detectActionIntent(message: string): boolean {
  const mutationPatterns = [
    // Création explicite d'entités
    /\bcr[ée]+[res]?\s+(une?\s+|le\s+|la\s+|les\s+|un\s+nouveau\s+|une\s+nouvelle\s+)?(tâche|tache|task|réunion|reunion|meeting|facture|devis|avoir|absence|ticket|événement|evenement|session|sprint|epic|contrat|offre|prospect|établissement|etablissement|partenaire|groupe|fiche|note|rappel)/i,
    // Envoi (email, message, notification)
    /\benvoi[ey]?[ers]?\s+(un\s+|une\s+|le\s+|la\s+|ce\s+|cette\s+)?(email|mail|courriel|message|notification|pulse|sms|réponse|reponse)/i,
    // Modification / suppression / archivage
    /\b(modifi[ey]?[ers]?|met[ts]?\s+[àa]\s+jour|chang[ey]?[ers]?|supprim[ey]?[ers]?|archiv[ey]?[ers]?|marqu[ey]?[ers]?|assign[ey]?[ers]?|déplac[ey]?[ers]?|termin[ey]?[ers]?|valid[ey]?[ers]?|annul[ey]?[ers]?|clôtur[ey]?[ers]?|cloturer|résoudre|resoudre)\s+(la|le|les|cette|ce|ces|une|un|ma|mon|mes)\b/i,
    // Planification
    /\b(planifi[ey]?[ers]?|programme|programm[ey]?[ers]?|réserv[ey]?[ers]?|book|bloque\s+(un|une|du))\b.*(rendez-vous|rdv|réunion|meeting|créneau|creneau|appel|call)/i,
    // Synchronisation
    /\b(synchronis[ey]?[ers]?|sync)\s+(les?|la|mes?|mon)/i,
    // Génération / export d'artéfacts
    /\b(génèr?[ey]?[ers]?|generer|export[ey]?[ers]?)\s+(un|une|le|la|ce|cette)\s+(rapport|pdf|excel|csv|facture|contrat|bulletin|devis|avoir)/i,
    // Mémoire explicite
    /\b(retiens|mémoris[ey]?[ers]?|memorise[rz]?|souviens[- ]?toi|n'oublie\s+pas|note\s+que)\b/i,
    // Confirmation explicite (réponse OUI à une action en attente)
    /^(oui|ok|vas-y|go|envoie|envoyer|confirme|confirmer|d'accord|fais[-\s]?le|valide|valider|exécute|execute|lance|lancer|fonce|yes|yep|ouais|c'est\s+parti|allons-y)\b/i,
  ];
  return mutationPatterns.some(pattern => pattern.test(message));
}

/**
 * Process Azure streaming response - broader parser
 */
async function processStream(
  response: Response,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  sseEvent: (ctrl: ReadableStreamDefaultController, payload: Record<string, unknown>) => void,
  request: StreamRequest,
  supabase: ReturnType<typeof createClient>,
  abortController: AbortController,
) {
  const timer = createTimer();
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let usageData: any = null;

  // Keepalive during stream consumption (Azure may pause between tokens)
  const streamKeepalive = setInterval(() => {
    try { controller.enqueue(encoder.encode(`: keepalive\n\n`)); } catch { /* closed */ }
  }, 10000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            // Broad extraction: support multiple Azure response formats
            const delta = parsed.choices?.[0]?.delta?.content
              ?? parsed.choices?.[0]?.text
              ?? parsed.choices?.[0]?.delta?.text;
            if (delta) {
              fullContent += delta;
              sseEvent(controller, { type: 'delta', content: delta });
            }
            if (parsed.usage) {
              usageData = parsed;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } finally {
    clearInterval(streamKeepalive);
  }

  // Log AI call
  const durationMs = timer.stop();
  const usage = extractUsage(usageData);
  await logAICall({
    processing_type: 'jarvis_stream',
    model_used: 'gpt-5',
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    processing_duration_ms: durationMs,
    success: fullContent.length > 0,
    processed_by: request.user_id,
    context_type: 'jarvis_conversation',
    context_id: request.conversation_id,
  });

  // Save conversation
  if (request.conversation_id) {
    try {
      await supabase
        .from('jarvis_conversations')
        .update({
          messages: [
            ...(request.conversation_history || []),
            { role: 'user', content: request.message },
            { role: 'assistant', content: fullContent }
          ],
          updated_at: new Date().toISOString()
        })
        .eq('id', request.conversation_id);
    } catch (e) {
      console.warn('[JARVIS Stream] Save failed:', e);
    }
  }

  console.log(`[JARVIS Stream] Stream consumed: ${fullContent.length} chars in ${durationMs}ms`);
  return fullContent;
}
