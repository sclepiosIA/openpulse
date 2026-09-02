import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sanitizeForAI, wrapUserContent } from '../_shared/security-utils.ts'
import { logAICall, extractUsage } from '../_shared/ai-logging.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'
import { validateServiceOrUser } from '../_shared/auth-helpers.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-internal-secret

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  const auth = await validateServiceOrUser(req)
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { subject, messages, participants } = await req.json()

    if (!messages || messages.trim().length === 0) {
      return new Response(
        JSON.stringify({
          summary: '',
          suggestedTitle: null,
          suggestedDate: null,
          suggestedTime: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      console.error('Azure OpenAI credentials not configured')
      return new Response(
        JSON.stringify({
          summary: '',
          suggestedTitle: null,
          suggestedDate: null,
          suggestedTime: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const systemPrompt = `Tu es un assistant qui analyse les échanges email pour préparer une visioconférence.

Analyse les échanges et retourne un objet JSON avec exactement ces 4 clés:
- "summary": Résumé des points clés des échanges et objectif de la réunion (2-3 phrases max)
- "suggestedTitle": Titre court et clair pour la visio (max 50 caractères, sans "Visio:" devant)
- "suggestedDate": Date mentionnée dans les échanges au format YYYY-MM-DD, ou null si aucune date n'est explicitement mentionnée
- "suggestedTime": Heure mentionnée dans les échanges au format HH:mm (ex: "14:00"), ou null si aucune heure n'est mentionnée

IMPORTANT: 
- Si aucune date/heure n'est explicitement mentionnée dans les emails, mettre null.
- Le titre doit être descriptif et professionnel, pas juste répéter le sujet.
- Le résumé doit expliquer le contexte et pourquoi cette réunion est nécessaire.
- Réponds UNIQUEMENT avec un objet JSON valide.

Langue: Français`

    // Sanitize inputs for security
    const sanitizedSubject = sanitizeForAI(subject || 'Non spécifié', {
      maxLength: 200,
      functionName: 'generate-visio-summary',
    })
    const sanitizedMessages = sanitizeForAI(messages, {
      maxLength: 8000,
      functionName: 'generate-visio-summary',
    })

    const userPrompt = `Voici les échanges email à analyser:

Sujet original: ${wrapUserContent(sanitizedSubject, 'SUJET')}
Participants: ${participants || 'Non spécifiés'}

Échanges:
${wrapUserContent(sanitizedMessages, 'MESSAGES')}`

    // Setup timeout 90s (standard GPT-5)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

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
          max_completion_tokens: 500,
          reasoning_effort: 'low',
          verbosity: 'low',
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // Retry on rate limit
      if (azureResponse.status === 429) {
        console.log('Rate limited, retrying after 1s...')
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
            max_completion_tokens: 500,
            reasoning_effort: 'low',
            verbosity: 'low',
            response_format: { type: 'json_object' },
          }),
        })
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Azure request timeout (90s)')
        return new Response(
          JSON.stringify({
            summary: '',
            suggestedTitle: null,
            suggestedDate: null,
            suggestedTime: null,
            error: 'Timeout',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text()
      console.error('Azure API error:', azureResponse.status, errorText)
      return new Response(
        JSON.stringify({
          summary: '',
          suggestedTitle: null,
          suggestedDate: null,
          suggestedTime: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const azureData = await azureResponse.json()
    const content = azureData.choices?.[0]?.message?.content?.trim() || ''
    const usage = extractUsage(azureData)

    console.log('Azure response content:', content)

    // Parse JSON response
    let result = {
      summary: '',
      suggestedTitle: null as string | null,
      suggestedDate: null as string | null,
      suggestedTime: null as string | null,
    }
    try {
      const parsed = JSON.parse(content)
      result = {
        summary: parsed.summary || '',
        suggestedTitle: parsed.suggestedTitle || null,
        suggestedDate: parsed.suggestedDate || null,
        suggestedTime: parsed.suggestedTime || null,
      }
    } catch (parseError) {
      console.error('Error parsing AI response as JSON:', parseError, 'Content:', content)
      // Fallback: use raw content as summary if it's not JSON
      result.summary = content.length > 200 ? content.substring(0, 200) + '...' : content
    }

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'visio_summary',
      model_used: 'gpt-5',
      ...usage,
      success: true,
      result: { has_date: !!result.suggestedDate, has_time: !!result.suggestedTime },
    })

    console.log('Returning result:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error generating visio summary:', error)
    return buildErrorResponse('generate-visio-summary', error, corsHeaders, 500)
  }
})
