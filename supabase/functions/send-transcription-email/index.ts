import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sessionId, emails } = await req.json()

    if (!sessionId || !emails || emails.length === 0) {
      throw new Error('Missing sessionId or emails')
    }

    console.log(
      `[send-transcription-email] Sending to ${emails.length} recipients for session ${sessionId}`
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch session with summary
    const { data: session, error: sessionError } = await supabase
      .from('visio_transcription_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      console.error('Error fetching session:', sessionError)
      throw new Error('Session not found')
    }

    if (!session.summary) {
      throw new Error('Session summary not yet available')
    }

    // Get document from storage if exists
    const { data: doc } = await supabase
      .from('documents')
      .select('storage_path, storage_bucket, id')
      .eq('source_type', 'transcription')
      .eq('source_id', sessionId)
      .maybeSingle()

    let documentUrl = null
    if (doc) {
      const { data: signedUrl } = await supabase.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7) // 7 days

      if (signedUrl) documentUrl = signedUrl.signedUrl
    }

    // Get participants for the email
    const { data: participants } = await supabase
      .from('visio_transcription_participants')
      .select('display_name')
      .eq('session_id', sessionId)

    const participantNames =
      (participants || []).map((p) => p.display_name).join(', ') || 'Non disponible'

    // Format decisions and next steps
    const decisions =
      (session.decisions || [])
        .map((d: any, i: number) => `${i + 1}. ${d.decision}${d.owner ? ` (${d.owner})` : ''}`)
        .join('\n') || 'Aucune décision enregistrée'

    const nextSteps =
      (session.next_steps || [])
        .map((s: any, i: number) => {
          let line = `${i + 1}. ${s.task}`
          if (s.assignee) line += ` → ${s.assignee}`
          if (s.deadline) line += ` (${s.deadline})`
          return line
        })
        .join('\n') || 'Aucune prochaine étape'

    // Build email content (HTML)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #211A17; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 16px; font-weight: bold; color: #667eea; margin-bottom: 10px; }
    .summary { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
    .list { background: white; padding: 15px; border-radius: 8px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📝 Compte-rendu de réunion</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${session.title}</p>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">👥 Participants</div>
        <p>${participantNames}</p>
      </div>

      <div class="section">
        <div class="section-title">📋 Résumé</div>
        <div class="summary">
          ${session.summary.replace(/\n/g, '<br>')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">✅ Décisions prises</div>
        <div class="list">
          ${decisions.replace(/\n/g, '<br>')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">⏭️ Prochaines étapes</div>
        <div class="list">
          ${nextSteps.replace(/\n/g, '<br>')}
        </div>
      </div>

      ${
        documentUrl
          ? `
      <div style="text-align: center; margin-top: 20px;">
        <a href="${documentUrl}" class="btn">📄 Télécharger le compte-rendu complet</a>
      </div>
      `
          : ''
      }
    </div>

    <div class="footer">
      <p>Ce compte-rendu a été généré automatiquement par <strong>OpenPulse</strong></p>
      <p>© ${new Date().getFullYear()} OpenPulse - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
`

    // Check if Resend is configured
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!RESEND_API_KEY) {
      console.log(
        '[send-transcription-email] RESEND_API_KEY not configured, logging email content instead'
      )

      // Log what would be sent (for development/debugging)
      for (const email of emails) {
        console.log(`[send-transcription-email] Would send to ${email}:`, {
          subject: `📝 Compte-rendu : ${session.title}`,
          hasDocument: !!documentUrl,
        })
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Email simulé pour ${emails.length} destinataire(s) (RESEND_API_KEY non configuré)`,
          simulated: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Send emails via Resend
    const { Resend } = await import('npm:resend@2.0.0')
    const resend = new Resend(RESEND_API_KEY)

    const results = []
    for (const email of emails) {
      try {
        const { getEmailSenderConfig } = await import('../_shared/email-sender-config.ts')
        const senderConfig = await getEmailSenderConfig()

        const result = await resend.emails.send({
          from: senderConfig.default_from,
          to: [email],
          subject: `📝 Compte-rendu : ${session.title}`,
          html: emailHtml,
        })
        results.push({ email, success: true, id: result.data?.id })
        console.log(`[send-transcription-email] Sent to ${email}, id: ${result.data?.id}`)
      } catch (err: any) {
        console.error(`[send-transcription-email] Failed to send to ${email}:`, err)
        results.push({ email, success: false, error: err.message })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email envoyé à ${successCount}/${emails.length} destinataire(s)`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    return buildErrorResponse('send-transcription-email', error, corsHeaders, 500)
  }
})
