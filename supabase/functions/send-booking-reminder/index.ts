import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { checkRateLimit, extractClientIp, rateLimitedResponse } from '../_shared/rate-limit.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Anti-abus : CRON appelé 1×/h. 6 invocations / 10 min par IP suffisent largement.
  const rl = checkRateLimit(`send-booking-reminder:${extractClientIp(req)}`, {
    limit: 6,
    windowSec: 600,
  })
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSec ?? 60, corsHeaders)

  try {
    const { reminderType } = await req.json() // '24h' or '1h'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const now = new Date()
    let targetStart: Date
    let targetEnd: Date
    let reminderField: string

    if (reminderType === '24h') {
      // Bookings starting in 23-25 hours
      targetStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
      targetEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000)
      reminderField = 'reminder_sent_24h'
    } else {
      // Bookings starting in 55-65 minutes
      targetStart = new Date(now.getTime() + 55 * 60 * 1000)
      targetEnd = new Date(now.getTime() + 65 * 60 * 1000)
      reminderField = 'reminder_sent_1h'
    }

    // Fetch upcoming bookings that haven't received this reminder
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select(
        `
        *,
        booking_type:booking_types(id, name, duration_minutes, location_type),
        host:profiles!bookings_host_user_id_fkey(id, first_name, last_name, email)
      `
      )
      .eq('status', 'confirmed')
      .eq(reminderField, false)
      .gte('start_time', targetStart.toISOString())
      .lte('start_time', targetEnd.toISOString())

    if (fetchError) throw fetchError

    const results: { bookingId: string; sent: boolean; error?: string }[] = []

    for (const booking of bookings || []) {
      try {
        if (!resendApiKey || !booking.guest_email) {
          results.push({ bookingId: booking.id, sent: false, error: 'No API key or email' })
          continue
        }

        const startDate = new Date(booking.start_time)
        const formatDate = (d: Date) =>
          d.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
        const formatTime = (d: Date) =>
          d.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })

        const isOneHour = reminderType === '1h'
        const emoji = isOneHour ? '⏰' : '📅'
        const timeText = isOneHour ? 'dans 1 heure' : 'demain'

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
    .header { background: ${isOneHour ? '#dc2626' : '#4f46e5'}; color: white; padding: 25px; text-align: center; }
    .content { padding: 25px; }
    .info-card { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .visio-button { display: inline-block; background: #4f46e5; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; }
    .footer { background: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} Rappel : RDV ${timeText}</h1>
    </div>
    
    <div class="content">
      <p>Bonjour <strong>${booking.guest_name}</strong>,</p>
      <p>${isOneHour ? 'Votre rendez-vous commence dans 1 heure !' : 'Nous vous rappelons votre rendez-vous de demain.'}</p>
      
      <div class="info-card">
        <h3 style="margin: 0 0 15px 0;">${booking.booking_type?.name || 'Rendez-vous'}</h3>
        <p><strong>📆</strong> ${formatDate(startDate)}</p>
        <p><strong>🕐</strong> ${formatTime(startDate)}</p>
        <p><strong>👤</strong> Avec ${booking.host?.first_name || ''} ${booking.host?.last_name || ''}</p>
        ${booking.location ? `<p><strong>📍</strong> ${booking.location}</p>` : ''}
      </div>

      ${
        booking.video_conference_url
          ? `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${booking.video_conference_url}" class="visio-button">
          🎥 Rejoindre la visioconférence
        </a>
      </div>
      `
          : ''
      }

      <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        En cas d'empêchement, merci de nous prévenir au plus vite.
      </p>
    </div>
    
    <div class="footer">
      <p>OpenPulse - Système de réservation</p>
    </div>
  </div>
</body>
</html>
        `

        const { getEmailSenderConfig } = await import('../_shared/email-sender-config.ts')
        const senderConfig = await getEmailSenderConfig()

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: senderConfig.default_from,
            to: [booking.guest_email],
            subject: `${emoji} Rappel : ${booking.booking_type?.name || 'RDV'} ${timeText} - ${formatTime(startDate)}`,
            html: emailHtml,
          }),
        })

        if (resendResponse.ok) {
          // Mark reminder as sent
          await supabase
            .from('bookings')
            .update({ [reminderField]: true })
            .eq('id', booking.id)

          results.push({ bookingId: booking.id, sent: true })
        } else {
          const error = await resendResponse.text()
          results.push({ bookingId: booking.id, sent: false, error })
        }
      } catch (err: any) {
        results.push({ bookingId: booking.id, sent: false, error: err.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminderType,
        processedCount: bookings?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error sending booking reminders:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

if (import.meta.main) serve(handler)
