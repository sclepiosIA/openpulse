import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { week_iso, note } = await req.json()
    if (!week_iso || typeof week_iso !== 'string') return json({ error: 'week_iso requis' }, 400)

    const { data: imps, error: eImp } = await supabase
      .from('time_imputations')
      .select('id, duration_minutes, is_billable, status')
      .eq('user_id', user.id)
      .eq('week_iso', week_iso)
    if (eImp) throw eImp

    const total = (imps ?? []).reduce((s, i) => s + (i.duration_minutes ?? 0), 0)
    const billable = (imps ?? [])
      .filter((i) => i.is_billable)
      .reduce((s, i) => s + (i.duration_minutes ?? 0), 0)

    // Upsert weekly submission
    const { data: sub, error: eSub } = await supabase
      .from('time_weekly_submissions')
      .upsert(
        {
          user_id: user.id,
          week_iso,
          status: 'submitted',
          total_minutes: total,
          billable_minutes: billable,
          submitted_at: new Date().toISOString(),
          note: note ?? null,
        },
        { onConflict: 'user_id,week_iso' }
      )
      .select()
      .single()
    if (eSub) throw eSub

    // Move all draft imputations of the week to submitted
    await supabase
      .from('time_imputations')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('week_iso', week_iso)
      .in('status', ['draft', 'rejected'])

    return json({ success: true, submission: sub })
  } catch (e) {
    console.error('time-submit-week error:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
