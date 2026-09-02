import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth: only allow service_role bearer or INTERNAL_FUNCTION_SECRET
  const auth = req.headers.get('Authorization') || ''
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  const providedSecret = req.headers.get('x-internal-secret')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const isServiceRole = !!serviceRoleKey && auth === `Bearer ${serviceRoleKey}`
  const isInternal = !!internalSecret && providedSecret === internalSecret
  if (!isServiceRole && !isInternal) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Récupérer les connexions actives avec alertes activées
    const { data: connections, error: connError } = await supabaseClient
      .from('tresorerie_qonto_connections')
      .select('*')
      .eq('is_active', true)
      .eq('alert_enabled', true)

    if (connError) {
      throw new Error(`Erreur récupération connexions: ${connError.message}`)
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Aucune connexion avec alertes activées',
          alerts_sent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let alertsSent = 0

    for (const connection of connections) {
      try {
        // Récupérer le solde actuel depuis Qonto
        const accountsResponse = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
          headers: {
            Authorization: `Bearer ${connection.access_token_encrypted}`,
          },
        })

        if (!accountsResponse.ok) {
          console.error(`Erreur API Qonto pour ${connection.organization_id}`)
          continue
        }

        const accountsData = await accountsResponse.json()
        const accounts = accountsData.bank_accounts || []
        const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)

        // Vérifier les seuils
        if (totalBalance < connection.alert_threshold_critical) {
          await sendAlert(
            supabaseClient,
            connection,
            totalBalance,
            'CRITICAL',
            `🚨 ALERTE CRITIQUE - Solde bancaire très faible: ${formatCurrency(totalBalance)}`
          )
          alertsSent++
        } else if (totalBalance < connection.alert_threshold_low) {
          await sendAlert(
            supabaseClient,
            connection,
            totalBalance,
            'WARNING',
            `⚠️ ALERTE - Solde bancaire faible: ${formatCurrency(totalBalance)}`
          )
          alertsSent++
        }
      } catch (error) {
        console.error(`Erreur vérification alerte pour ${connection.organization_id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_sent: alertsSent,
        message: `${alertsSent} alerte(s) envoyée(s)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erreur qonto-check-alerts:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: sanitizeErrorForClient(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

Deno.serve(handler)

async function sendAlert(
  supabase: any,
  connection: any,
  balance: number,
  level: 'WARNING' | 'CRITICAL',
  message: string
) {
  try {
    // Créer une notification in-app
    const { data: profiles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', profile.user_id)
          .single()

        if (userProfile) {
          await supabase.from('notifications').insert({
            profile_id: userProfile.id,
            type: 'alerte_tresorerie',
            title: level === 'CRITICAL' ? 'Alerte Critique - Trésorerie' : 'Alerte Trésorerie',
            message: message,
            priority: level === 'CRITICAL' ? 'urgent' : 'haute',
            metadata: {
              balance,
              threshold:
                level === 'CRITICAL'
                  ? connection.alert_threshold_critical
                  : connection.alert_threshold_low,
              organization_id: connection.organization_id,
            },
          })
        }
      }
    }

    // Envoi email aux destinataires configurés
    if (connection.alert_emails && connection.alert_emails.length > 0) {
      const subject =
        level === 'CRITICAL'
          ? `🚨 Alerte CRITIQUE Trésorerie - Solde ${formatCurrency(balance)}`
          : `⚠️ Alerte Trésorerie - Solde ${formatCurrency(balance)}`

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: ${level === 'CRITICAL' ? '#dc2626' : '#f59e0b'};">${subject}</h2>
          <p>${message}</p>
          <table style="border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Solde actuel</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatCurrency(balance)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Seuil déclenché</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatCurrency(level === 'CRITICAL' ? connection.alert_threshold_critical : connection.alert_threshold_low)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Niveau</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${level}</td></tr>
          </table>
          <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Notification automatique OpenPulse — Trésorerie Qonto</p>
        </div>
      `

      try {
        const { error: sendErr } = await supabase.functions.invoke('send-email', {
          body: {
            to: connection.alert_emails,
            subject,
            html: htmlBody,
          },
        })
        if (sendErr) {
          console.error('Erreur envoi email alerte:', sendErr)
        } else {
          console.log(
            `📧 Email alerte ${level} envoyé à ${connection.alert_emails.length} destinataire(s)`
          )
        }
      } catch (mailErr) {
        console.error('Exception envoi email alerte:', mailErr)
      }
    }

    console.log(`✅ Alerte ${level} envoyée pour solde: ${formatCurrency(balance)}`)
  } catch (error) {
    console.error('Erreur envoi alerte:', error)
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}
