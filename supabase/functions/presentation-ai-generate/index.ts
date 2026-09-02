/**
 * presentation-ai-generate
 * Génère un deck structuré depuis un prompt (et éventuellement un doc source).
 * JSON: { slides: [{title, bullets:[..], notes}, ...] }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { callGpt5Mini } from '../_shared/azure-gpt5-mini.ts'

interface Body {
  prompt: string
  sourceText?: string
  slideCount?: number
  audience?: string
  documentId?: string | null
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const t0 = Date.now()
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

    const rl = checkRateLimit(`presentation-ai:${userId}`, { max: 20, windowSec: 60 })
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter: rl.retryAfterSec }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = (await req.json()) as Body
    if (!body.prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'prompt required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const count = Math.min(Math.max(body.slideCount ?? 10, 3), 25)
    const audience = body.audience?.trim() || 'professionnels de santé et cadres dirigeants'

    const systemPrompt =
      'Tu es un expert en storytelling exécutif. Tu produis des decks concis, orientés décision, en français. Renvoie STRICTEMENT du JSON: {"title":"...","slides":[{"title":"...","bullets":["..."],"notes":"..."}]}. Chaque slide a 3-6 bullets courts, notes = 2-3 phrases pour l\'orateur. Pas de HTML.'
    const userPrompt = [
      `Public: ${audience}`,
      `Objectif du deck: ${body.prompt}`,
      `Nombre de slides visé: ${count}`,
      body.sourceText
        ? `\nDocument source (à synthétiser):\n${body.sourceText.slice(0, 30000)}`
        : '',
      '\nStructure recommandée: intro/contexte, problème, solution, preuves/chiffres, plan, next steps.',
    ].join('\n')

    const aiResult = await callGpt5Mini(systemPrompt, userPrompt, {
      maxTokens: 4000,
      timeout: 90000,
      jsonOutput: true,
    })
    const content = aiResult.content || '{}'
    let parsed: { title?: string; slides?: unknown[] } = {}
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { slides: [] }
    }

    supabase
      .from('ai_editor_actions_log')
      .insert({
        user_id: userId,
        document_id: body.documentId ?? null,
        surface: 'presentation',
        action: 'generate_deck',
        input_chars: userPrompt.length,
        output_chars: content.length,
        latency_ms: Date.now() - t0,
        reasoning_effort: 'medium',
      })
      .then(
        () => {},
        () => {}
      )

    return new Response(JSON.stringify({ ...parsed, latency_ms: Date.now() - t0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('presentation-ai-generate error:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
