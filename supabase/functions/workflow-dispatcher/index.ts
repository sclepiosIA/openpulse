// Edge Function: workflow-dispatcher
// Lit workflow_trigger_queue, matche les workflows actifs, déclenche workflow-engine.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function matchesEmailFilter(payload: any, cfg: any): boolean {
  if (!cfg?.keywords?.length) return true
  const text = `${payload.subject || ''} ${payload.sender_email || ''}`.toLowerCase()
  return cfg.keywords.some((k: string) => text.includes(String(k).toLowerCase()))
}

function matchesEtablissementFilter(payload: any, cfg: any): boolean {
  if (!cfg?.statut_target) return true
  return String(payload.statut_new).toLowerCase() === String(cfg.statut_target).toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
    const providedSecret = req.headers.get('x-function-secret')
    const authHeader = req.headers.get('authorization') || ''
    const isInternal = !!internalSecret && providedSecret === internalSecret
    const isServiceRole = !!SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`
    if (!isInternal && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: queue, error: qErr } = await supabase
      .from('workflow_trigger_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)
    if (qErr) throw qErr

    let dispatched = 0
    for (const item of queue || []) {
      try {
        await supabase
          .from('workflow_trigger_queue')
          .update({ status: 'processing', attempts: (item.attempts || 0) + 1 })
          .eq('id', item.id)

        const { data: workflows } = await supabase
          .from('workflows')
          .select('*')
          .eq('trigger_type', item.trigger_type)
          .eq('is_active', true)
          .eq('is_template', false)

        for (const wf of workflows || []) {
          // Filtres par type
          if (
            item.trigger_type === 'email.received' &&
            !matchesEmailFilter(item.payload, wf.trigger_config)
          )
            continue
          if (
            item.trigger_type === 'etablissement.statut_changed' &&
            !matchesEtablissementFilter(item.payload, wf.trigger_config)
          )
            continue

          await supabase.functions.invoke('workflow-engine', {
            body: { workflow_id: wf.id, trigger_payload: item.payload },
          })
          dispatched++
        }

        await supabase
          .from('workflow_trigger_queue')
          .update({ status: 'done', processed_at: new Date().toISOString() })
          .eq('id', item.id)
      } catch (itemErr: any) {
        console.error('[dispatcher item]', itemErr)
        await supabase
          .from('workflow_trigger_queue')
          .update({ status: 'failed', error: sanitizeErrorForClient(itemErr) })
          .eq('id', item.id)
      }
    }

    return new Response(JSON.stringify({ processed: queue?.length || 0, dispatched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[workflow-dispatcher]', err)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
