// BI Studio — Explication IA d'un résultat de question (Azure GPT-5).
// Reçoit un aperçu du résultat (rows tronquées) + le nom/definition de la question,
// renvoie des insights synthétiques et anomalies détectées.
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return json({ error: 'Azure OpenAI not configured' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing authorization' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const { question_name, rows, viz_type, context } = body as {
      question_name?: string
      rows?: unknown[]
      viz_type?: string
      context?: string
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ error: 'rows required' }, 400)
    }

    // On borne à 500 lignes pour ne pas dépasser le contexte.
    const sample = rows.slice(0, 500)

    const systemPrompt = [
      'Tu es un analyste data pour une entreprise SaaS santé (OpenPulse).',
      'Ton rôle : lire des jeux de résultats BI et fournir 3 à 6 insights concrets et actionnables.',
      'Sois factuel, chiffré, court. Format Markdown avec des puces.',
      "Structure : **Résumé** (1-2 phrases), **Insights** (puces), **Points d'attention** (puces), **Suggestions** (puces).",
      'Ne réinvente pas les chiffres, ne fais que synthétiser ce qui est dans les données.',
    ].join(' ')

    const userPrompt = [
      `Question: ${question_name ?? '(sans nom)'}`,
      viz_type ? `Type de viz: ${viz_type}` : '',
      context ? `Contexte utilisateur: ${context}` : '',
      `Nombre de lignes: ${rows.length} (échantillon de ${sample.length} lignes)`,
      `Données (JSON):\n${JSON.stringify(sample)}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const controller = new AbortController()
    const to = setTimeout(() => controller.abort(), 90_000)

    let azureRes: Response
    try {
      azureRes = await fetch(AZURE_OPENAI_ENDPOINT!, {
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
          max_completion_tokens: 3000,
          reasoning_effort: 'medium',
          verbosity: 'medium',
        }),
        signal: controller.signal,
      })
      clearTimeout(to)
      if (azureRes.status === 429) {
        await new Promise((r) => setTimeout(r, 1000))
        azureRes = await fetch(AZURE_OPENAI_ENDPOINT!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': AZURE_OPENAI_API_KEY! },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: 3000,
            reasoning_effort: 'medium',
            verbosity: 'medium',
          }),
        })
      }
    } catch (e) {
      clearTimeout(to)
      const msg = e instanceof Error && e.name === 'AbortError' ? 'Azure timeout (90s)' : String(e)
      return json({ error: msg }, 504)
    }

    if (!azureRes.ok) {
      const t = await azureRes.text().catch(() => '')
      console.error('[bi-explain-with-ai] Azure error', azureRes.status, t.slice(0, 500))
      return json({ error: `Azure error ${azureRes.status}` }, 502)
    }
    const azureData = await azureRes.json()
    const content = azureData.choices?.[0]?.message?.content ?? ''
    return json({ analysis: content })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown'
    console.error('[bi-explain-with-ai]', msg)
    return json({ error: msg }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
