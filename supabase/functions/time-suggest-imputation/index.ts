import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return j({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const { date, week_start } = body ?? {}

    // Détermine la plage : semaine complète si week_start fourni, sinon un jour
    let dates: string[] = []
    let mode: 'day' | 'week' = 'day'
    if (typeof week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      mode = 'week'
      dates = Array.from({ length: 7 }, (_, i) => addDays(week_start, i))
    } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dates = [date]
    } else {
      return j({ error: 'date (YYYY-MM-DD) ou week_start (YYYY-MM-DD) requis' }, 400)
    }

    const rangeStart = `${dates[0]}T00:00:00Z`
    const rangeEnd = `${dates[dates.length - 1]}T23:59:59Z`

    // Collecte des signaux sur la plage : calendrier + tâches + emails
    const [calRes, tachesRes, emailsRes, typesRes, etabsRes, projetsRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, description')
        .eq('owner_id', user.id)
        .gte('start_at', rangeStart)
        .lte('start_at', rangeEnd)
        .limit(150),
      supabase
        .from('taches')
        .select('id, titre, etablissement_id, statut, updated_at')
        .eq('responsable_id', user.id)
        .gte('updated_at', rangeStart)
        .lte('updated_at', rangeEnd)
        .limit(150),
      supabase
        .from('email_messages')
        .select('id, subject, from_address, received_at')
        .eq('user_id', user.id)
        .gte('received_at', rangeStart)
        .lte('received_at', rangeEnd)
        .limit(150),
      supabase.from('time_activity_types').select('id, code, label').eq('active', true),
      supabase.from('etablissements').select('id, nom').limit(200),
      supabase.from('rd_projets').select('id, nom').limit(50),
    ])

    const context = {
      mode,
      dates,
      calendar: (calRes.data ?? []).map((c) => ({
        title: c.title,
        start_at: c.start_at,
        end_at: c.end_at,
        description: c.description,
      })),
      tasks: (tachesRes.data ?? []).map((t) => ({
        titre: t.titre,
        etablissement_id: t.etablissement_id,
        statut: t.statut,
        updated_at: t.updated_at,
      })),
      emails: (emailsRes.data ?? []).map((e) => ({
        subject: e.subject,
        from: e.from_address,
        received_at: e.received_at,
      })),
      activity_types: typesRes.data ?? [],
      etablissements: (etabsRes.data ?? []).slice(0, 100).map((e) => ({ id: e.id, nom: e.nom })),
      projets_rd: projetsRes.data ?? [],
    }

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      return j({ suggestions: [], reason: 'Azure GPT-5 non configuré' })
    }

    const systemPrompt =
      mode === 'week'
        ? `Tu es un assistant qui suggère la ventilation du temps d'un collaborateur OpenPulse sur une SEMAINE ENTIÈRE (lundi à vendredi principalement).
À partir du calendrier, des tâches et des emails de la semaine, propose pour CHAQUE jour ouvré des imputations réalistes.
Objectifs : ~7h/jour ouvré (weekend seulement si signaux clairs), total semaine ≤ 2400min.
Chaque suggestion doit contenir un champ "date" (YYYY-MM-DD, obligatoirement dans la liste ${JSON.stringify(dates)}), un activity_type_code parmi ceux fournis, et optionnellement un etablissement_id ou projet_rd_id (uuid exact depuis la liste fournie, sinon null).
Réponds STRICTEMENT en JSON : {"suggestions":[{"date":"YYYY-MM-DD","activity_type_code":"...","duration_minutes":60,"etablissement_id":null,"projet_rd_id":null,"note":"..."}]}.`
        : `Tu es un assistant qui suggère la ventilation du temps d'un collaborateur OpenPulse sur une journée.
À partir du calendrier, des tâches et des emails, propose 2 à 6 imputations (durée en minutes, total ≤ 480min).
Chaque suggestion doit référencer un activity_type_code parmi ceux fournis, et optionnellement un etablissement_id ou projet_rd_id (uuid exact depuis la liste fournie, sinon null).
Réponds STRICTEMENT en JSON : {"suggestions":[{"date":"${dates[0]}","activity_type_code":"...","duration_minutes":60,"etablissement_id":null,"projet_rd_id":null,"note":"..."}]}.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    const resp = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': AZURE_OPENAI_API_KEY },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(context) },
        ],
        max_completion_tokens: mode === 'week' ? 4000 : 2000,
        reasoning_effort: mode === 'week' ? 'medium' : 'low',
        verbosity: 'low',
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      const text = await resp.text()
      console.error('Azure error:', resp.status, text)
      return j({ suggestions: [], error: `Azure error ${resp.status}` })
    }
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: { suggestions?: Array<Record<string, unknown>> } = {}
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { suggestions: [] }
    }

    // Normalisation : garantit un champ "date" et filtre les dates hors plage
    const validDates = new Set(dates)
    const suggestions = (parsed.suggestions ?? [])
      .map((s) => ({
        date: typeof s.date === 'string' ? s.date : dates[0],
        activity_type_code: String(s.activity_type_code ?? ''),
        duration_minutes: Number(s.duration_minutes ?? 0),
        etablissement_id: (s.etablissement_id as string | null) ?? null,
        projet_rd_id: (s.projet_rd_id as string | null) ?? null,
        note: (s.note as string | null) ?? null,
      }))
      .filter((s) => validDates.has(s.date) && s.duration_minutes > 0 && s.activity_type_code)

    return j({ suggestions })
  } catch (e) {
    console.error('time-suggest-imputation error:', e)
    return j({ error: (e as Error).message, suggestions: [] }, 500)
  }
})

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
