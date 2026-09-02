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
    if (!user) return j({ error: 'Unauthorized' }, 401)

    // check role
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const allowed = (roles ?? []).some((r: { role: string }) =>
      ['admin', 'direction', 'manager'].includes(r.role)
    )
    if (!allowed) return j({ error: 'Forbidden' }, 403)

    const { submission_id, action, reason } = await req.json()
    if (!submission_id || !['approve', 'reject'].includes(action)) {
      return j({ error: 'submission_id + action(approve|reject) requis' }, 400)
    }

    const { data: sub, error: eSub } = await supabase
      .from('time_weekly_submissions')
      .select('id, user_id, week_iso')
      .eq('id', submission_id)
      .single()
    if (eSub || !sub) return j({ error: 'Submission introuvable' }, 404)

    const nowIso = new Date().toISOString()
    if (action === 'approve') {
      await supabase
        .from('time_weekly_submissions')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: nowIso,
        })
        .eq('id', sub.id)

      await supabase
        .from('time_imputations')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: nowIso,
        })
        .eq('user_id', sub.user_id)
        .eq('week_iso', sub.week_iso)
        .eq('status', 'submitted')
    } else {
      await supabase
        .from('time_weekly_submissions')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: nowIso,
          rejection_reason: reason ?? null,
        })
        .eq('id', sub.id)

      await supabase
        .from('time_imputations')
        .update({
          status: 'rejected',
          rejection_reason: reason ?? null,
        })
        .eq('user_id', sub.user_id)
        .eq('week_iso', sub.week_iso)
        .eq('status', 'submitted')
    }

    return j({ success: true })
  } catch (e) {
    console.error('time-approve-week error:', e)
    return j({ error: (e as Error).message }, 500)
  }
})
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
