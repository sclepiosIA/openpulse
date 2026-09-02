/**
 * doc-ai-copilot
 * Chat streamé ancré au document. SSE. Grounding minimal via champs fournis par le front:
 *  - documentTitle, documentHtml (le doc courant)
 *  - contextSummary (résumé optionnel du contexte projet: établissement, contact, RH, tréso)
 *
 * Renvoie du texte SSE: `data: {"delta":"..."}\n\n` puis `data: [DONE]\n\n`.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { callGpt5Mini } from '../_shared/azure-gpt5-mini.ts'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Body {
  messages: ChatMessage[]
  documentTitle?: string
  documentHtml?: string
  contextSummary?: string
  documentId?: string | null
  surface?: 'document' | 'presentation' | 'spreadsheet'
}

const MAX_DOC_CHARS = 40000

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    const rl = checkRateLimit(`doc-ai-copilot:${userId}`, { max: 40, windowSec: 60 })
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter: rl.retryAfterSec }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfterSec ?? 30),
          },
        }
      )
    }

    const body = (await req.json()) as Body
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const docText = body.documentHtml ? stripHtml(body.documentHtml).slice(0, MAX_DOC_CHARS) : ''
    const systemPrompt = [
      'Tu es Copilot OpenPulse, un assistant intégré à un éditeur de documents professionnel du secteur santé.',
      "Tu réponds en français, style clair, structuré, avec puces ou sections quand c'est utile.",
      "Tu peux référencer le document courant fourni ci-dessous. N'invente pas de données absentes.",
      "Si l'utilisateur demande une action (créer tâche, brouillon, etc.), décris ce que tu ferais mais dis-lui d'utiliser le bouton correspondant.",
      body.documentTitle ? `Titre du document : ${body.documentTitle}` : '',
      docText ? `\n--- CONTENU DU DOCUMENT (extrait) ---\n${docText}\n--- FIN ---` : '',
      body.contextSummary
        ? `\n--- CONTEXTE PROJET ---\n${body.contextSummary.slice(0, 8000)}\n--- FIN ---`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const messages = [
      { role: 'system', content: systemPrompt },
      ...body.messages.slice(-20).map((m) => ({
        role: m.role,
        content: String(m.content ?? '').slice(0, 8000),
      })),
    ]

    const lastUserMessage =
      messages.filter((message) => message.role === 'user').at(-1)?.content ?? ''

    const conversationContext = messages
      .slice(1, -1)
      .map(
        (message) =>
          `${message.role === 'assistant' ? 'Assistant' : 'Utilisateur'}: ${message.content}`
      )
      .join('\n')

    const aiResult = await callGpt5Mini(
      systemPrompt,
      [
        conversationContext ? `Historique récent:\n${conversationContext}` : '',
        `Question utilisateur:\n${lastUserMessage}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      { maxTokens: 3000, timeout: 90000 }
    )

    // Best-effort audit
    supabase
      .from('ai_editor_actions_log')
      .insert({
        user_id: userId,
        document_id: body.documentId ?? null,
        surface: body.surface ?? 'document',
        action: 'chat',
        input_chars: JSON.stringify(messages).length,
        output_chars: 0,
        reasoning_effort: 'low',
      })
      .then(
        () => {},
        () => {}
      )

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const content = aiResult.content
          for (let index = 0; index < content.length; index += 320) {
            const delta = content.slice(index, index + 320)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (err) {
          console.error('stream error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: sanitizeErrorForClient(err) })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('doc-ai-copilot error:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
