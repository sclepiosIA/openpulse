import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeErrorLog } from '../_shared/error-sanitizer.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // SECURITY: RGPD export requires admin authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required for RGPD export' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate user token
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseAuth = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check admin role using service role client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })

    if (!hasAdminRole) {
      // Log unauthorized attempt (best-effort, never throw)
      try {
        await supabase.from('rgpd_audit_logs').insert({
          action: 'unauthorized_export_attempt',
          user_id: user.id,
          details: { ip: req.headers.get('x-forwarded-for') || 'unknown' },
        })
      } catch (logErr) {
        console.error(
          'Failed to log unauthorized RGPD export attempt:',
          safeErrorLog('rgpd-export-data', logErr)
        )
      }

      console.error('RGPD export attempt by non-admin:', user.email)
      return new Response(JSON.stringify({ error: 'Admin role required for RGPD exports' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('RGPD export initiated by admin:', user.email)

    const { personEmail, personName, requestId, format = 'json' } = await req.json()

    if (!personEmail && !personName) {
      return new Response(JSON.stringify({ error: 'Email or name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Collect all personal data from various tables
    const exportData: Record<string, any> = {
      export_date: new Date().toISOString(),
      request_id: requestId,
      person: {
        email: personEmail,
        name: personName,
      },
      data: {},
    }

    // 1. Contacts data
    if (personEmail) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', personEmail)

      if (contacts && contacts.length > 0) {
        exportData.data.contacts = contacts
      }
    }

    // 2. Search by name in contacts
    if (personName) {
      const { data: contactsByName } = await supabase
        .from('contacts')
        .select('*')
        .or(`nom.ilike.%${personName}%,prenom.ilike.%${personName}%`)

      if (contactsByName && contactsByName.length > 0) {
        exportData.data.contacts_by_name = contactsByName
      }
    }

    // 3. Booking records
    if (personEmail) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select(
          'id, start_time, end_time, status, guest_name, guest_email, guest_phone, guest_company, guest_notes, created_at'
        )
        .eq('guest_email', personEmail)

      if (bookings && bookings.length > 0) {
        exportData.data.bookings = bookings
      }
    }

    // 4. Live chat conversations
    if (personEmail) {
      const { data: chatConversations } = await supabase
        .from('live_chat_conversations')
        .select('id, visitor_name, visitor_email, status, created_at, resolved_at')
        .eq('visitor_email', personEmail)

      if (chatConversations && chatConversations.length > 0) {
        // Get messages for each conversation
        for (const conv of chatConversations) {
          const { data: messages } = await supabase
            .from('live_chat_messages')
            .select('content, sender_type, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })

          ;(conv as any).messages = messages || []
        }
        exportData.data.chat_conversations = chatConversations
      }
    }

    // 5. Support tickets
    if (personEmail) {
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('id, sujet, description, statut, priorite, created_at, resolved_at')
        .eq('email_expediteur', personEmail)

      if (tickets && tickets.length > 0) {
        exportData.data.support_tickets = tickets
      }
    }

    // 6. Formation attendance (emargement)
    if (personEmail) {
      const { data: emargements } = await supabase
        .from('formation_emargements')
        .select('id, nom_prenom, email, signed_at, signature_data')
        .eq('email', personEmail)

      if (emargements && emargements.length > 0) {
        // Remove actual signature data for privacy, just indicate it exists
        exportData.data.formation_attendance = emargements.map((e: any) => ({
          ...e,
          signature_data: e.signature_data ? '[SIGNATURE_EXISTS]' : null,
        }))
      }
    }

    // 7. Satisfaction survey responses
    if (personEmail) {
      const { data: surveys } = await supabase
        .from('enquetes_satisfaction')
        .select('id, email, type, rating, responses, created_at')
        .eq('email', personEmail)

      if (surveys && surveys.length > 0) {
        exportData.data.satisfaction_surveys = surveys
      }
    }

    // 8. RGPD consents
    if (personEmail) {
      const { data: consents } = await supabase
        .from('rgpd_consentements')
        .select('*')
        .eq('email_personne', personEmail)

      if (consents && consents.length > 0) {
        exportData.data.consents = consents
      }
    }

    // 9. Email messages (from/to) — base légale conservation commerciale
    if (personEmail) {
      const { data: emailsFrom } = await supabase
        .from('email_messages')
        .select('id, subject, from_address, to_addresses, sent_at, received_at, created_at')
        .eq('from_address', personEmail)
        .limit(500)
      if (emailsFrom && emailsFrom.length > 0) {
        exportData.data.email_messages_sent = emailsFrom
      }
      // to_addresses est JSON — recherche textuelle
      const { data: emailsTo } = await supabase
        .from('email_messages')
        .select('id, subject, from_address, to_addresses, sent_at, received_at, created_at')
        .textSearch('to_addresses', personEmail, { type: 'plain' })
        .limit(500)
      if (emailsTo && emailsTo.length > 0) {
        exportData.data.email_messages_received = emailsTo
      }
    }

    // Calculate totals
    const dataSummary = {
      total_records: 0,
      categories: [] as string[],
    }

    Object.keys(exportData.data).forEach((key) => {
      const records = exportData.data[key]
      if (Array.isArray(records)) {
        dataSummary.total_records += records.length
        dataSummary.categories.push(key)
      }
    })

    exportData.summary = dataSummary

    // Update RGPD request status if requestId provided
    // Fix audit 2026-06-02 (CONF-02): la table 'rgpd_demandes' n'existe pas
    // (seule 'rgpd_demandes_droits' est créée en migration), 'traite' n'est pas
    // une valeur de l'enum rgpd_demande_statut (valide: 'completee'), et la
    // colonne 'donnees_exportees' n'existe pas. On contrôle aussi l'erreur.
    // (aligné sur supabase/functions/rgpd-anonymize/index.ts)
    if (requestId) {
      const { error: updateError } = await supabase
        .from('rgpd_demandes_droits')
        .update({
          statut: 'completee',
          date_traitement: new Date().toISOString(),
        })
        .eq('id', requestId)
      if (updateError) {
        console.error('rgpd-export-data: échec mise à jour du statut de la demande', updateError)
      }
    }

    // Format output
    if (format === 'csv') {
      // Convert to CSV format
      let csvContent = ''
      Object.keys(exportData.data).forEach((category) => {
        const records = exportData.data[category]
        if (Array.isArray(records) && records.length > 0) {
          csvContent += `\n\n=== ${category.toUpperCase()} ===\n`
          const headers = Object.keys(records[0])
          csvContent += headers.join(';') + '\n'
          records.forEach((record: any) => {
            csvContent +=
              headers
                .map((h) => {
                  const val = record[h]
                  if (val === null || val === undefined) return ''
                  if (typeof val === 'object') return JSON.stringify(val).replace(/;/g, ',')
                  return String(val).replace(/;/g, ',')
                })
                .join(';') + '\n'
          })
        }
      })

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="rgpd_export_${personEmail || personName}_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="rgpd_export_${personEmail || personName}_${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    console.error('Error exporting RGPD data:', safeErrorLog('rgpd-export-data', error))
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        error_code: 'RGPD_EXPORT_FAILED',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
