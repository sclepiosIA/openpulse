import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const in15min = new Date(now.getTime() + 15 * 60 * 1000)

    let totalSent = 0

    // ===== 1. CALENDAR REMINDERS (events starting in next 15 min) =====
    console.log(
      `[calendar-push-reminders] Checking events between ${now.toISOString()} and ${in15min.toISOString()}`
    )

    const { data: upcomingEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, created_by, location')
      .gte('start_time', now.toISOString())
      .lte('start_time', in15min.toISOString())
      .is('push_reminder_sent_at', null)
      .neq('status', 'cancelled')
      .limit(50)

    if (eventsError) {
      console.error('[calendar-push-reminders] Events query error:', eventsError.message)
    } else if (upcomingEvents && upcomingEvents.length > 0) {
      console.log(
        `[calendar-push-reminders] Found ${upcomingEvents.length} events needing reminders`
      )

      for (const event of upcomingEvents) {
        if (!event.created_by) continue

        const startTime = new Date(event.start_time)
        const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / 60000)

        try {
          // Send push notification via the existing edge function
          const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: event.created_by,
              title: `📅 Dans ${minutesUntil} min`,
              body: event.title + (event.location ? ` — ${event.location}` : ''),
              url: '/calendrier',
              type: 'calendar',
              tag: `cal-${event.id}`,
              related_id: event.id,
            }),
          })

          const pushResult = await pushResponse.json()
          console.log(`[calendar-push-reminders] Event ${event.id}: sent=${pushResult.sent || 0}`)
          totalSent += pushResult.sent || 0

          // Mark as sent
          await supabase
            .from('calendar_events')
            .update({ push_reminder_sent_at: now.toISOString() })
            .eq('id', event.id)
        } catch (err) {
          console.error(`[calendar-push-reminders] Error sending for event ${event.id}:`, err)
        }
      }
    } else {
      console.log('[calendar-push-reminders] No upcoming events needing reminders')
    }

    // ===== 2. DAILY TODO REMINDERS (todos due today, sent between 7:30-8:00 UTC) =====
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()

    // Only send todo reminders in the 7:30-8:00 UTC window (approx 8:30-9:00 CET)
    if (currentHour === 7 && currentMinute >= 30 && currentMinute < 35) {
      const today = now.toISOString().split('T')[0] // YYYY-MM-DD

      console.log(`[calendar-push-reminders] Checking todos due today: ${today}`)

      const { data: dueTodos, error: todosError } = await supabase
        .from('personal_todos')
        .select('id, title, user_id, due_date, priority')
        .eq('due_date', today)
        .eq('is_done', false)
        .is('push_reminder_sent_at', null)
        .limit(100)

      if (todosError) {
        console.error('[calendar-push-reminders] Todos query error:', todosError.message)
      } else if (dueTodos && dueTodos.length > 0) {
        console.log(`[calendar-push-reminders] Found ${dueTodos.length} todos due today`)

        // Group by user
        const todosByUser = new Map<string, typeof dueTodos>()
        for (const todo of dueTodos) {
          if (!todo.user_id) continue
          const existing = todosByUser.get(todo.user_id) || []
          existing.push(todo)
          todosByUser.set(todo.user_id, existing)
        }

        for (const [userId, userTodos] of todosByUser) {
          const count = userTodos.length
          const firstTitle = userTodos[0].title
          const body =
            count === 1 ? firstTitle : `${firstTitle} et ${count - 1} autre${count > 2 ? 's' : ''}`

          try {
            const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                title: `✅ ${count} tâche${count > 1 ? 's' : ''} à faire aujourd'hui`,
                body,
                url: '/m/todos',
                type: 'task',
                tag: `todos-daily-${today}`,
              }),
            })

            const pushResult = await pushResponse.json()
            console.log(
              `[calendar-push-reminders] Todos for user ${userId}: sent=${pushResult.sent || 0}`
            )
            totalSent += pushResult.sent || 0
          } catch (err) {
            console.error(`[calendar-push-reminders] Error sending todos for user ${userId}:`, err)
          }

          // Mark all as sent
          const todoIds = userTodos.map((t) => t.id)
          await supabase
            .from('personal_todos')
            .update({ push_reminder_sent_at: now.toISOString() })
            .in('id', todoIds)
        }
      } else {
        console.log('[calendar-push-reminders] No todos due today needing reminders')
      }
    }

    // ===== 3. MULTI-REMINDERS (event_reminders table, per-user custom offsets) =====
    // Fire any reminder whose (event.start_time - minutes_before) is now-past
    // but the event hasn't started yet, and reminder not yet sent.
    const in5min = new Date(now.getTime() + 5 * 60 * 1000)
    const { data: dueReminders, error: remErr } = await supabase
      .from('event_reminders')
      .select(
        `
        id, event_id, user_id, minutes_before, type,
        event:calendar_events(id, title, start_time, location, status)
      `
      )
      .eq('is_sent', false)
      .limit(500)

    if (remErr) {
      console.error('[calendar-push-reminders] event_reminders query error:', remErr.message)
    } else if (dueReminders && dueReminders.length > 0) {
      const toFire = dueReminders.filter((r: any) => {
        if (!r.event?.start_time || r.event.status === 'cancelled') return false
        const fireAt = new Date(new Date(r.event.start_time).getTime() - r.minutes_before * 60_000)
        // Fire if the scheduled fire time is in the past OR within the next 5 min,
        // and the event itself has not yet started.
        return fireAt <= in5min && new Date(r.event.start_time) > now
      })

      console.log(
        `[calendar-push-reminders] Firing ${toFire.length}/${dueReminders.length} event_reminders`
      )

      for (const r of toFire as any[]) {
        const startTime = new Date(r.event.start_time)
        const minutesUntil = Math.max(0, Math.round((startTime.getTime() - now.getTime()) / 60000))
        const timeLabel =
          minutesUntil >= 60 ? `dans ${Math.round(minutesUntil / 60)}h` : `dans ${minutesUntil} min`

        try {
          if (r.type === 'email') {
            // Fetch user email
            const { data: prof } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', r.user_id)
              .maybeSingle()
            if (prof?.email) {
              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  to: prof.email,
                  subject: `Rappel : ${r.event.title} (${timeLabel})`,
                  html: `<p>Bonjour ${prof.full_name || ''},</p>
                    <p>Rappel de votre événement <strong>${r.event.title}</strong> ${timeLabel}.</p>
                    ${r.event.location ? `<p>Lieu : ${r.event.location}</p>` : ''}
                    <p>Début : ${startTime.toLocaleString('fr-FR')}</p>`,
                }),
              }).catch((e) => console.error('[calendar-push-reminders] send-email error', e))
            }
          } else {
            // push (default)
            const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                user_id: r.user_id,
                title: `📅 ${r.event.title}`,
                body: `${timeLabel}${r.event.location ? ` — ${r.event.location}` : ''}`,
                url: '/calendrier',
                type: 'calendar',
                tag: `rem-${r.id}`,
                related_id: r.event_id,
              }),
            })
            const pr = await pushResponse.json().catch(() => ({}))
            totalSent += pr.sent || 0
          }

          await supabase
            .from('event_reminders')
            .update({ is_sent: true, sent_at: now.toISOString() })
            .eq('id', r.id)
        } catch (err) {
          console.error(`[calendar-push-reminders] reminder ${r.id} error:`, err)
        }
      }
    }

    console.log(`[calendar-push-reminders] Done. Total push sent: ${totalSent}`)

    return new Response(
      JSON.stringify({
        success: true,
        total_sent: totalSent,
        timestamp: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    return buildErrorResponse('calendar-push-reminders', error, corsHeaders, 500)
  }
})
