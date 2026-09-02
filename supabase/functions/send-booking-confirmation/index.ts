import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { checkRateLimit, extractClientIp, rateLimitedResponse } from '../_shared/rate-limit.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Anti-spam : 30 envois / 10 min par IP (best-effort).
  const rl = checkRateLimit(`send-booking-confirmation:${extractClientIp(req)}`, {
    limit: 30,
    windowSec: 600,
  })
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSec ?? 60, corsHeaders)

  try {
    const { bookingId } = await req.json()

    if (!bookingId) {
      throw new Error('bookingId is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch booking with related data
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(
        `
        *,
        booking_type:booking_types(id, name, duration_minutes, description, location_type),
        host:profiles!bookings_host_user_id_fkey(id, first_name, last_name, email),
        etablissement:etablissements(id, nom)
      `
      )
      .eq('id', bookingId)
      .single()

    if (fetchError) throw fetchError
    if (!booking) throw new Error('Booking not found')

    const startDate = new Date(booking.start_time)
    const endDate = new Date(booking.end_time)

    const formatDate = (d: Date) =>
      d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

    const formatTime = (d: Date) =>
      d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })

    // Generate ICS file content
    const icsContent = generateICS(booking, startDate, endDate)

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: none; }
    .header { background: #211A17; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-card { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; margin: 10px 0; }
    .info-label { color: #6b7280; width: 120px; }
    .info-value { color: #1f2937; font-weight: 500; }
    .cta-button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
    .visio-link { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .visio-link a { color: #059669; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Rendez-vous confirmé</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Votre réservation a bien été enregistrée</p>
    </div>
    
    <div class="content">
      <p>Bonjour <strong>${booking.guest_name}</strong>,</p>
      <p>Votre rendez-vous a été confirmé. Voici les détails :</p>
      
      <div class="info-card">
        <h3 style="margin: 0 0 15px 0; color: #4f46e5;">📅 ${booking.booking_type?.name || 'Rendez-vous'}</h3>
        <div class="info-row">
          <span class="info-label">📆 Date</span>
          <span class="info-value">${formatDate(startDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">🕐 Horaire</span>
          <span class="info-value">${formatTime(startDate)} - ${formatTime(endDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">⏱️ Durée</span>
          <span class="info-value">${booking.booking_type?.duration_minutes || 30} minutes</span>
        </div>
        ${
          booking.location
            ? `
        <div class="info-row">
          <span class="info-label">📍 Lieu</span>
          <span class="info-value">${booking.location}</span>
        </div>
        `
            : ''
        }
        <div class="info-row">
          <span class="info-label">👤 Avec</span>
          <span class="info-value">${booking.host?.first_name || ''} ${booking.host?.last_name || ''}</span>
        </div>
      </div>

      ${
        booking.video_conference_url
          ? `
      <div class="visio-link">
        <strong>🎥 Lien visioconférence</strong><br>
        <a href="${booking.video_conference_url}" target="_blank">${booking.video_conference_url}</a>
      </div>
      `
          : ''
      }

      ${
        booking.guest_notes
          ? `
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>📝 Vos notes :</strong><br>
        ${booking.guest_notes}
      </div>
      `
          : ''
      }

      <p style="color: #6b7280; font-size: 14px;">
        Un fichier .ics est joint à cet email pour ajouter ce rendez-vous à votre calendrier.
      </p>

      <p style="margin-top: 30px;">À bientôt !<br><strong>L'équipe OpenPulse</strong></p>
    </div>
    
    <div class="footer">
      <p>Ce message a été envoyé automatiquement par OpenPulse</p>
      <p>Pour annuler ou modifier votre rendez-vous, veuillez nous contacter.</p>
    </div>
  </div>
</body>
</html>
    `

    // Send email via Resend if API key is configured
    const { getEmailSenderConfig } = await import('../_shared/email-sender-config.ts')
    const senderConfig = await getEmailSenderConfig()

    if (resendApiKey && booking.guest_email) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderConfig.default_from,
          to: [booking.guest_email],
          cc: booking.host?.email ? [booking.host.email] : [],
          subject: `✅ RDV confirmé : ${booking.booking_type?.name || 'Rendez-vous'} - ${formatDate(startDate)}`,
          html: emailHtml,
          attachments: [
            {
              filename: 'invitation.ics',
              content: Buffer.from(icsContent).toString('base64'),
            },
          ],
        }),
      })

      if (!resendResponse.ok) {
        const resendError = await resendResponse.text()
        console.error('Resend error:', resendError)
        throw new Error(`Failed to send email: ${resendError}`)
      }

      // Update booking to mark confirmation sent
      await supabase
        .from('bookings')
        .update({ confirmed_at: new Date().toISOString() })
        .eq('id', bookingId)

      console.log(`Confirmation email sent to ${booking.guest_email}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: !!resendApiKey,
        booking: {
          id: booking.id,
          guest_email: booking.guest_email,
          start_time: booking.start_time,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error sending booking confirmation:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function generateICS(booking: any, startDate: Date, endDate: Date): string {
  const formatICSDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const uid = `${booking.id}@exploitant.example.org`
  const now = new Date()

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OpenPulse//Booking//FR
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatICSDate(now)}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${booking.booking_type?.name || 'Rendez-vous'} avec ${booking.host?.first_name || 'OpenPulse'}
DESCRIPTION:${booking.booking_type?.description || ''}${booking.video_conference_url ? `\\n\\nLien visio: ${booking.video_conference_url}` : ''}
LOCATION:${booking.location || booking.video_conference_url || 'À confirmer'}
ORGANIZER;CN=${booking.host?.first_name || 'OpenPulse'}:mailto:${booking.host?.email || 'noreply@exploitant.example.org'}
ATTENDEE;RSVP=TRUE;PARTSTAT=ACCEPTED:mailto:${booking.guest_email}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`
}
