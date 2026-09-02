import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { logAICall, extractUsage, createTimer } from '../_shared/ai-logging.ts'
import { sanitizeForAI, wrapUserContent } from '../_shared/security-utils.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')
const FUNCTION_NAME = 'generate-thread-summary'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ✅ Validation JWT réelle (rejette anon JWT et tokens forgés)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const token = authHeader.replace('Bearer ', '').trim()

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'Unauthorized: authenticated user required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claimsData.claims.sub as string

    const { threadId } = await req.json()

    if (!threadId) {
      return new Response(JSON.stringify({ error: 'threadId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[generate-thread-summary] User ${userId} processing thread: ${threadId}`)

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ✅ Vérifier l'accès : compte perso (via profile) OU compte partagé
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const { data: threadRow, error: threadRowError } = await supabase
      .from('email_threads')
      .select(
        'id, user_email_account_id, user_email_accounts:user_email_account_id(profile_id, is_shared)'
      )
      .eq('id', threadId)
      .maybeSingle()

    const acct: any = (threadRow as any)?.user_email_accounts
    const hasAccess =
      !!threadRow && (acct?.is_shared === true || (profile?.id && acct?.profile_id === profile.id))

    if (threadRowError || !hasAccess) {
      console.warn('[generate-thread-summary] Access denied', {
        threadId,
        userId,
        hasProfile: !!profile?.id,
      })
      return new Response(JSON.stringify({ error: 'Forbidden: thread not accessible' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch thread with messages
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .select(
        `
        id,
        subject,
        ai_summary,
        ai_generated_title,
        email_messages (
          id,
          from_name,
          from_address,
          body_text,
          sent_date
        )
      `
      )
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      console.error('[generate-thread-summary] Thread not found:', threadError)
      return new Response(JSON.stringify({ error: 'Thread not found', summary: null }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If we already have an AI summary AND cleanTitle, return them
    if (thread.ai_summary && thread.ai_generated_title) {
      console.log('[generate-thread-summary] Using existing summary and cleanTitle')
      return new Response(
        JSON.stringify({
          summary: thread.ai_summary,
          cleanTitle: thread.ai_generated_title,
          source: 'cached',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if Azure credentials are available
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      console.error('[generate-thread-summary] Azure credentials not configured')
      return new Response(
        JSON.stringify({
          summary: null,
          cleanTitle: null,
          error: 'AI service not configured',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare conversation content for GPT-5
    const messages = (thread.email_messages || [])
      .sort((a: any, b: any) => new Date(a.sent_date).getTime() - new Date(b.sent_date).getTime())
      .slice(-10) // Last 10 messages max
      .map(
        (m: any) => `De: ${m.from_name || m.from_address}\n${m.body_text?.substring(0, 500) || ''}`
      )
      .join('\n\n---\n\n')

    const systemPrompt = `Tu es un assistant qui génère des résumés concis de conversations email pour préparer une réunion visio.

Tu dois générer DEUX choses:
1. Un RÉSUMÉ de la conversation (2-3 phrases, 60-100 mots) qui:
   - Mentionne les points clés discutés
   - Identifie les décisions prises ou questions en suspens
   - Est utile pour quelqu'un qui doit rejoindre une visio sur ce sujet

2. Un TITRE PROPRE pour l'événement calendrier (max 50 caractères) qui:
   - Retire les préfixes [SPAM], RE:, TR:, FW:, FWD:
   - Retire les dates, heures et fuseaux horaires (UTC, etc.)
   - Retire les adresses email entre parenthèses
   - Garde uniquement le sujet principal
   - Est concis et professionnel

Réponds UNIQUEMENT en JSON avec ce format exact:
{"summary": "...", "cleanTitle": "..."}`

    // SECURITY: Sanitize email content before AI processing
    const sanitizedSubject = sanitizeForAI(thread.subject || '', {
      maxLength: 500,
      functionName: FUNCTION_NAME,
    })
    const sanitizedMessages = sanitizeForAI(messages, {
      maxLength: 5000,
      functionName: FUNCTION_NAME,
    })

    const userPrompt = `Sujet original: ${sanitizedSubject}

Échanges:
${wrapUserContent(sanitizedMessages, 'EMAIL_EXCHANGES')}

Génère le résumé et le titre propre en JSON.`

    // Call Azure GPT-5 with proper parameters
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for summary

    let azureResponse: Response
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_completion_tokens: 300,
          reasoning_effort: 'low',
          verbosity: 'low',
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // Retry on rate limit
      if (azureResponse.status === 429) {
        console.log('[generate-thread-summary] Rate limited, retrying...')
        await new Promise((r) => setTimeout(r, 1000))
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': AZURE_OPENAI_API_KEY!,
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 300,
            reasoning_effort: 'low',
            verbosity: 'low',
            response_format: { type: 'json_object' },
          }),
        })
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error?.name === 'AbortError') {
        console.error('[generate-thread-summary] Request timeout')
        return buildErrorResponse('generate-thread-summary', error, corsHeaders, 500)
      }
      throw error
    }

    if (!azureResponse.ok) {
      const errText = await azureResponse.text()
      console.error('[generate-thread-summary] Azure error', azureResponse.status, errText)
      return new Response(
        JSON.stringify({ summary: null, cleanTitle: null, error: 'AI service error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const azureData = await azureResponse.json()
    const content = azureData.choices?.[0]?.message?.content
    let summary: string | null = null
    let cleanTitle: string | null = null
    try {
      const parsed = JSON.parse(content || '{}')
      summary = parsed.summary || null
      cleanTitle = parsed.cleanTitle || null
    } catch (e) {
      console.error('[generate-thread-summary] JSON parse failed', e)
    }

    if (summary || cleanTitle) {
      await supabase
        .from('email_threads')
        .update({
          ...(summary ? { ai_summary: summary } : {}),
          ...(cleanTitle ? { ai_generated_title: cleanTitle } : {}),
        })
        .eq('id', threadId)
    }

    return new Response(JSON.stringify({ summary, cleanTitle, source: 'generated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[generate-thread-summary] Error:', error)
    return buildErrorResponse('generate-thread-summary', error, corsHeaders, 500)
  }
})
