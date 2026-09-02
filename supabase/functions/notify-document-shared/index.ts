/**
 * notify-document-shared - Envoie un email de notification lors du partage d'un document ou dossier
 *
 * Appelé depuis le frontend après un partage réussi.
 * Utilise Resend pour l'envoi.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface NotifyPayload {
  type: 'document' | 'folder'
  resourceName: string
  resourceId: string
  recipientUserIds?: string[] // auth user IDs for direct user shares
  recipientGroupId?: string // group ID for group shares
  permissionLevel: string
  sharedByUserId: string // auth user ID of the person sharing
}

const PERMISSION_LABELS: Record<string, string> = {
  view: 'Lecture',
  comment: 'Commentaire',
  edit: 'Édition',
  admin: 'Admin',
}

function buildEmailHtml(params: {
  recipientName: string
  sharedByName: string
  resourceType: string
  resourceName: string
  permissionLevel: string
  appUrl: string
}): string {
  const { recipientName, sharedByName, resourceType, resourceName, permissionLevel, appUrl } =
    params
  const typeLabel = resourceType === 'document' ? 'un document' : 'un dossier'
  const permLabel = PERMISSION_LABELS[permissionLevel] || permissionLevel

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }
    .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: none; }
    .header { background: #211A17; color: white; padding: 28px 30px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 28px 30px; }
    .resource-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .resource-name { font-weight: 600; font-size: 16px; color: #111827; }
    .resource-meta { font-size: 13px; color: #6b7280; margin-top: 6px; }
    .badge { display: inline-block; background: #eef2ff; color: #4f46e5; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 12px; }
    .cta { display: inline-block; background: #4f46e5; color: white !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 16px; }
    .cta:hover { background: #4338ca; }
    .footer { background: #f9fafb; padding: 18px 30px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Nouveau partage</h1>
    </div>
    <div class="content">
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p><strong>${sharedByName}</strong> a partagé ${typeLabel} avec vous :</p>
      
      <div class="resource-card">
        <div class="resource-name">${resourceName}</div>
        <div class="resource-meta">
          Permission : <span class="badge">${permLabel}</span>
        </div>
      </div>
      
      <a href="${appUrl}/documents" class="cta">Ouvrir mes documents</a>
    </div>
    <div class="footer">
      <p>Ce message a été envoyé automatiquement par OpenPulse</p>
    </div>
  </div>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!resendApiKey) {
      console.warn('[notify-document-shared] RESEND_API_KEY not configured, skipping email')
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_resend_key' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const payload: NotifyPayload = await req.json()
    const {
      type,
      resourceName,
      recipientUserIds,
      recipientGroupId,
      permissionLevel,
      sharedByUserId,
    } = payload

    // Get sharer profile
    const { data: sharerProfile } = await supabase
      .from('profiles')
      .select('nom, prenom')
      .eq('user_id', sharedByUserId)
      .single()

    const sharedByName = sharerProfile
      ? `${sharerProfile.prenom || ''} ${sharerProfile.nom || ''}`.trim()
      : 'Un collègue'

    // Collect recipient emails
    const recipients: { email: string; name: string }[] = []

    // Direct user shares
    if (recipientUserIds && recipientUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, nom, prenom')
        .in('user_id', recipientUserIds)

      if (profiles) {
        for (const p of profiles) {
          if (p.email && p.user_id !== sharedByUserId) {
            recipients.push({
              email: p.email,
              name: `${p.prenom || ''} ${p.nom || ''}`.trim() || p.email,
            })
          }
        }
      }
    }

    // Group shares — get all group members
    if (recipientGroupId) {
      const { data: members } = await supabase
        .from('user_group_members')
        .select(
          'user_id, profile:profiles!user_group_members_user_id_fkey(user_id, email, nom, prenom)'
        )
        .eq('group_id', recipientGroupId)

      if (members) {
        for (const m of members) {
          const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
          if (profile?.email && profile.user_id !== sharedByUserId) {
            // Avoid duplicates
            if (!recipients.some((r) => r.email === profile.email)) {
              recipients.push({
                email: profile.email,
                name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email,
              })
            }
          }
        }
      }
    }

    if (recipients.length === 0) {
      console.log('[notify-document-shared] No recipients to notify')
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get sender config
    const { getEmailSenderConfig } = await import('../_shared/email-sender-config.ts')
    const senderConfig = await getEmailSenderConfig()

    // Get app URL for CTA link
    const appUrl = Deno.env.get('APP_URL')

    let sent = 0
    let errors = 0

    // Send individual emails
    for (const recipient of recipients) {
      try {
        const html = buildEmailHtml({
          recipientName: recipient.name,
          sharedByName,
          resourceType: type,
          resourceName,
          permissionLevel,
          appUrl,
        })

        const subject =
          type === 'document'
            ? `📄 ${sharedByName} a partagé un document avec vous`
            : `📁 ${sharedByName} a partagé un dossier avec vous`

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: senderConfig.notifications_from,
            to: [recipient.email],
            subject,
            html,
          }),
        })

        if (res.ok) {
          sent++
          console.log(`[notify-document-shared] ✅ Sent to ${recipient.email}`)
        } else {
          const errText = await res.text()
          console.error(`[notify-document-shared] ❌ Failed for ${recipient.email}:`, errText)
          errors++
        }
      } catch (err: unknown) {
        console.error(`[notify-document-shared] ❌ Error sending to ${recipient.email}:`, err)
        errors++
      }
    }

    console.log(`[notify-document-shared] Done: ${sent} sent, ${errors} errors`)

    return new Response(JSON.stringify({ success: true, sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return buildErrorResponse('notify-document-shared', error, corsHeaders, 500)
  }
})
