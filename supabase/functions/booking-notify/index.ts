import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { generateBookingICS } from '../_shared/booking-ics.ts'
import { getEmailSenderConfig } from '../_shared/email-sender-config.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

type Action = 'confirmed' | 'rescheduled' | 'cancelled' | 'updated'

interface NotifyPayload {
  bookingId: string
  action: Action
  oldStartTime?: string
  oldEndTime?: string
  reason?: string
}

const TZ = 'Europe/Paris'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  })

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })

interface BookingRow {
  id: string
  guest_name: string
  guest_email: string
  guest_phone: string | null
  guest_notes: string | null
  start_time: string
  end_time: string
  location: string | null
  video_conference_url: string | null
  status: string
  cancellation_reason: string | null
  booking_type: {
    id: string
    name: string
    description: string | null
    duration_minutes: number
    location_type: string | null
  } | null
  host: {
    id: string
    nom: string | null
    prenom: string | null
    email: string | null
  } | null
}

function buildHtml(
  action: Action,
  booking: BookingRow,
  hostName: string,
  reason?: string,
  oldStartTime?: string
): { subject: string; html: string } {
  const typeName = booking.booking_type?.name || 'Rendez-vous'
  const dateStr = fmtDate(booking.start_time)
  const timeStr = `${fmtTime(booking.start_time)} – ${fmtTime(booking.end_time)}`
  const visio = booking.video_conference_url
  const isPhone = booking.booking_type?.location_type === 'phone'
  const isInPerson = booking.booking_type?.location_type === 'in_person'

  const baseStyles = `
    body{margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
    .wrap{max-width:600px;margin:24px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:none}
    .header{padding:28px 32px;color:#fff;text-align:center}
    .content{padding:28px 32px;color:#1f2937;font-size:15px;line-height:1.6}
    .card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin:16px 0}
    .row{display:flex;gap:8px;padding:6px 0;font-size:14px}
    .label{color:#6b7280;min-width:90px}
    .val{color:#111827;font-weight:500}
    .visio{background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:14px;margin:16px 0}
    .visio a{color:#059669;font-weight:600;word-break:break-all}
    .reason{background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:14px;margin:16px 0}
    .strike{text-decoration:line-through;color:#9ca3af}
    .footer{background:#f9fafb;padding:18px;text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb}
    .btn{display:inline-block;background:#4f46e5;color:#fff!important;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px}
  `

  const headerByAction: Record<Action, { color: string; emoji: string; title: string }> = {
    confirmed: { color: '#10b981', emoji: '✅', title: 'Rendez-vous confirmé' },
    rescheduled: { color: '#3b82f6', emoji: '🔄', title: 'Rendez-vous reprogrammé' },
    cancelled: { color: '#ef4444', emoji: '❌', title: 'Rendez-vous annulé' },
    updated: { color: '#6366f1', emoji: '✏️', title: 'Rendez-vous mis à jour' },
  }

  const subjectByAction: Record<Action, string> = {
    confirmed: `✅ RDV confirmé : ${typeName} – ${dateStr}`,
    rescheduled: `🔄 RDV reprogrammé : ${typeName} – ${dateStr}`,
    cancelled: `❌ RDV annulé : ${typeName}`,
    updated: `✏️ RDV mis à jour : ${typeName} – ${dateStr}`,
  }

  const head = headerByAction[action]

  const dateBlock =
    action === 'rescheduled' && oldStartTime
      ? `
        <div class="row"><span class="label">📆 Date</span><span class="val">
          <span class="strike">${fmtDate(oldStartTime)} à ${fmtTime(oldStartTime)}</span><br/>
          <strong>${dateStr}</strong> à <strong>${timeStr}</strong>
        </span></div>`
      : `
        <div class="row"><span class="label">📆 Date</span><span class="val">${dateStr}</span></div>
        <div class="row"><span class="label">🕐 Horaire</span><span class="val">${timeStr}</span></div>`

  const locationBlock =
    action !== 'cancelled'
      ? isPhone && booking.guest_phone
        ? `<div class="row"><span class="label">📞 Téléphone</span><span class="val">${booking.guest_phone}</span></div>`
        : isInPerson && booking.location
          ? `<div class="row"><span class="label">📍 Adresse</span><span class="val">${booking.location}</span></div>`
          : ''
      : ''

  const visioBlock =
    action !== 'cancelled' && visio && !isPhone && !isInPerson
      ? `<div class="visio"><strong>🎥 Lien visioconférence</strong><br/><a href="${visio}" target="_blank">${visio}</a></div>`
      : ''

  const reasonBlock = reason
    ? `<div class="reason"><strong>📝 Motif :</strong><br/>${reason}</div>`
    : ''

  const intro: Record<Action, string> = {
    confirmed: `Votre rendez-vous est <strong>confirmé</strong>. Vous trouverez tous les détails ci-dessous, ainsi qu'une invitation calendrier en pièce jointe.`,
    rescheduled: `Votre rendez-vous a été <strong>reprogrammé</strong>. La nouvelle invitation calendrier est en pièce jointe et remplacera l'ancienne.`,
    cancelled: `Votre rendez-vous a malheureusement été <strong>annulé</strong>. N'hésitez pas à reprendre un nouveau créneau si vous le souhaitez.`,
    updated: `Vos informations de rendez-vous ont été <strong>mises à jour</strong>.`,
  }

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${baseStyles}</style></head>
<body>
  <div class="wrap">
    <div class="header" style="background:${head.color}">
      <h1 style="margin:0;font-size:22px">${head.emoji} ${head.title}</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${booking.guest_name}</strong>,</p>
      <p>${intro[action]}</p>
      <div class="card">
        <h3 style="margin:0 0 10px;color:#4f46e5">${typeName}</h3>
        ${dateBlock}
        <div class="row"><span class="label">⏱️ Durée</span><span class="val">${booking.booking_type?.duration_minutes || 30} min</span></div>
        <div class="row"><span class="label">👤 Avec</span><span class="val">${hostName}</span></div>
        ${locationBlock}
      </div>
      ${visioBlock}
      ${reasonBlock}
      <p style="margin-top:24px">À bientôt,<br/><strong>L'équipe OpenPulse</strong></p>
    </div>
    <div class="footer">Message envoyé automatiquement par OpenPulse</div>
  </div>
</body></html>`

  return { subject: subjectByAction[action], html }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = (await req.json()) as NotifyPayload
    if (!payload?.bookingId || !payload?.action) {
      throw new Error('bookingId and action are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `
        id, guest_name, guest_email, guest_phone, guest_notes,
        start_time, end_time, location, video_conference_url,
        status, cancellation_reason,
        booking_type:booking_types(id, name, description, duration_minutes, location_type),
        host:profiles!bookings_host_user_id_fkey(id, nom, prenom, email)
      `
      )
      .eq('id', payload.bookingId)
      .single()

    if (error) throw error
    if (!booking) throw new Error('Booking not found')

    const b = booking as unknown as BookingRow
    const hostName = [b.host?.prenom, b.host?.nom].filter(Boolean).join(' ') || 'OpenPulse'
    const hostEmail = b.host?.email || 'noreply@exploitant.example.org'

    const { subject, html } = buildHtml(
      payload.action,
      b,
      hostName,
      payload.reason ?? b.cancellation_reason ?? undefined,
      payload.oldStartTime
    )

    const ics = generateBookingICS(
      {
        id: b.id,
        start_time: b.start_time,
        end_time: b.end_time,
        guest_name: b.guest_name,
        guest_email: b.guest_email,
        location: b.location,
        video_conference_url: b.video_conference_url,
        description: b.booking_type?.description ?? null,
      },
      { name: hostName, email: hostEmail },
      {
        method: payload.action === 'cancelled' ? 'CANCEL' : 'REQUEST',
        sequence: payload.action === 'rescheduled' ? 2 : payload.action === 'updated' ? 1 : 0,
        summary: `${b.booking_type?.name || 'Rendez-vous'} avec ${hostName}`,
        status: payload.action === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
      }
    )

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.warn('[booking-notify] RESEND_API_KEY missing, skipping send')
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_resend_key' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sender = await getEmailSenderConfig()
    const icsB64 = btoa(unescape(encodeURIComponent(ics)))

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender.notifications_from || sender.default_from,
        to: [b.guest_email],
        cc: hostEmail && hostEmail !== 'noreply@exploitant.example.org' ? [hostEmail] : [],
        subject,
        html,
        attachments: [
          {
            filename: payload.action === 'cancelled' ? 'cancel.ics' : 'invitation.ics',
            content: icsB64,
          },
        ],
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      console.error('[booking-notify] Resend error:', txt)
      throw new Error(`Resend error: ${txt}`)
    }

    return new Response(JSON.stringify({ success: true, action: payload.action }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return buildErrorResponse('booking-notify', e, corsHeaders, 500)
  }
})
