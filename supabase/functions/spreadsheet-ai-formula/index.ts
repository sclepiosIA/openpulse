/**
 * spreadsheet-ai-formula
 * Assistant formule tableur en langage naturel. Renvoie JSON: {formula, explanation, examples[]}.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { callGpt5Mini } from '../_shared/azure-gpt5-mini.ts'

interface Body {
  mode: 'from_nl' | 'explain' | 'fix'
  prompt?: string
  formula?: string
  headers?: string[]
  sampleRows?: unknown[][]
  locale?: 'fr' | 'en'
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

    const rl = checkRateLimit(`sheet-ai:${userId}`, { max: 60, windowSec: 60 })
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter: rl.retryAfterSec }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = (await req.json()) as Body
    const locale = body.locale ?? 'fr'
    const headers = (body.headers ?? []).slice(0, 40)
    const sample = (body.sampleRows ?? []).slice(0, 8)
    const ctxTable = headers.length
      ? `Colonnes: ${headers.join(' | ')}\nExemple:\n${sample
          .map((r) => (r as unknown[]).slice(0, headers.length).join(' | '))
          .join('\n')}`
      : ''

    const modeConfig: Record<Body['mode'], { system: string; user: string }> = {
      from_nl: {
        system:
          'Tu es expert formules de tableur (compatibles Excel/Google Sheets). Réponds STRICTEMENT en JSON: {"formula":"=...","explanation":"...","examples":["..."]}. Utilise les fonctions ' +
          (locale === 'fr'
            ? 'en français (SOMME, MOYENNE, SI, RECHERCHEV, INDEX, EQUIV)'
            : 'en anglais (SUM, AVERAGE, IF, VLOOKUP, INDEX, MATCH)') +
          '. Pas de commentaire hors JSON.',
        user: `Demande: ${body.prompt ?? ''}\n${ctxTable}`,
      },
      explain: {
        system:
          'Tu expliques une formule tableur en 3-5 phrases claires en français. JSON strict: {"explanation":"..."}.',
        user: `Formule: ${body.formula ?? ''}\n${ctxTable}`,
      },
      fix: {
        system:
          'Tu corriges une formule tableur qui ne fonctionne pas. JSON strict: {"formula":"=...","explanation":"pourquoi elle échouait et ce qui a été corrigé"}.',
        user: `Formule à corriger: ${body.formula ?? ''}\nObjectif: ${body.prompt ?? ''}\n${ctxTable}`,
      },
    }
    const cfg = modeConfig[body.mode]
    if (!cfg) {
      return new Response(JSON.stringify({ error: `Unknown mode: ${body.mode}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiResult = await callGpt5Mini(cfg.system, cfg.user, {
      maxTokens: 1000,
      timeout: 90000,
      jsonOutput: true,
    })
    const content = aiResult.content || '{}'
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { raw: content }
    }

    supabase
      .from('ai_editor_actions_log')
      .insert({
        user_id: userId,
        document_id: body.documentId ?? null,
        surface: 'spreadsheet',
        action: `formula_${body.mode}`,
        input_chars: cfg.user.length,
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
    console.error('spreadsheet-ai-formula error:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
