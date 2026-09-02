import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const PayloadSchema = z.object({
  event_id: z.string().uuid(),
  action: z.enum(['updated', 'deleted', 'invited', 'uninvited']).default('updated'),
  changes: z.array(z.string().min(1).max(80)).max(20).default([]),
  // Optional explicit user targets (for "invited"/"uninvited") — otherwise all current attendees are notified
  target_user_ids: z.array(z.string().uuid()).max(200).optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Identify caller via anon client with user JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const actorId = userData.user.id

    const body = await req.json()
    const parsed = PayloadSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { event_id, action, changes, target_user_ids } = parsed.data

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Load event
    const { data: event, error: eventErr } = await admin
      .from('calendar_events')
      .select('id, title, start_time, end_time, created_by, calendar_id')
      .eq('id', event_id)
      .maybeSingle()

    if (eventErr) throw eventErr
    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine recipients
    let recipients: string[] = []
    if (target_user_ids && target_user_ids.length > 0) {
      recipients = target_user_ids.filter((u) => u !== actorId)
    } else {
      const { data: attendees, error: attErr } = await admin
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', event_id)
        .not('user_id', 'is', null)
      if (attErr) throw attErr
      recipients = Array.from(
        new Set(
          (attendees || [])
            .map((a: { user_id: string | null }) => a.user_id)
            .filter((id): id is string => !!id && id !== actorId)
        )
      )
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build message
    const dateStr = (() => {
      try {
        return new Date(event.start_time).toLocaleString('fr-FR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      } catch {
        return ''
      }
    })()

    const titleMap: Record<string, string> = {
      updated: `Événement modifié : ${event.title}`,
      deleted: `Événement supprimé : ${event.title}`,
      invited: `Invitation à un événement : ${event.title}`,
      uninvited: `Retiré d'un événement : ${event.title}`,
    }

    const changeLabel = changes.length > 0 ? ` (${changes.join(', ')})` : ''
    const messageMap: Record<string, string> = {
      updated: `L'événement du ${dateStr} a été modifié${changeLabel}.`,
      deleted: `L'événement prévu le ${dateStr} a été annulé.`,
      invited: `Vous êtes invité à l'événement du ${dateStr}.`,
      uninvited: `Vous avez été retiré de l'événement du ${dateStr}.`,
    }

    const rows = recipients.map((uid) => ({
      user_id: uid,
      title: titleMap[action],
      message: messageMap[action],
      type: 'establishment_update' as const,
      related_id: event.id,
      related_type: null,
      is_read: false,
    }))

    const { error: insertErr } = await admin.from('in_app_notifications').insert(rows)

    if (insertErr) throw insertErr

    return new Response(JSON.stringify({ success: true, notified: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return buildErrorResponse('notify-event-update', error, corsHeaders, 500)
  }
})
