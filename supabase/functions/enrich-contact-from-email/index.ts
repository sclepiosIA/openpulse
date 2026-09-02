import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

// Edge Functions are short-lived, server-side requests. Session persistence and
// token-refresh timers are browser concerns and would otherwise outlive a request.
const edgeClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

interface EnrichmentRequest {
  contact_id: string
  new_data: {
    nom?: string
    prenom?: string
    fonction?: string
    email?: string
    telephone?: string
    type_contact?: string
  }
  source: string // 'email', 'fhf_api', 'linkedin_api', 'manual'
  source_reference?: string // thread_id, user_id, etc.
  confidence?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validate service role authentication
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('apikey')

    if (
      (!authHeader || !authHeader.includes(supabaseServiceKey)) &&
      apiKey !== supabaseServiceKey
    ) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Service role key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, edgeClientOptions)

    const {
      contact_id,
      new_data,
      source,
      source_reference,
      confidence = 1.0,
    } = (await req.json()) as EnrichmentRequest

    // 1. Fetch existing contact
    const { data: existingContact, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single()

    if (fetchError || !existingContact) {
      console.error('Contact not found:', fetchError)
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Determine which fields should be updated
    const updates: any = {}
    const changedFields: string[] = []
    const oldValues: any = {}
    const newValues: any = {}

    // Helper: Check if new value is more complete or precise
    const shouldUpdate = (
      fieldName: string,
      oldValue: any,
      newValue: any,
      minConfidence = 0.7
    ): boolean => {
      if (confidence < minConfidence) return false
      if (!newValue || newValue === '' || newValue === 'Non spécifié') return false
      if (!oldValue || oldValue === '' || oldValue === 'Non spécifié') return true

      // Special logic for "fonction": check if new is more precise
      if (fieldName === 'fonction') {
        const oldTokens = oldValue.toLowerCase().split(/\s+/)
        const newTokens = newValue.toLowerCase().split(/\s+/)

        // New is more precise if it contains all old tokens + more
        const isMorePrecise =
          newTokens.length > oldTokens.length &&
          oldTokens.every((t: string) => newTokens.includes(t))

        return isMorePrecise
      }

      // For other fields, only update if old is empty
      return false
    }

    // Check each field
    const fieldsToCheck = ['nom', 'prenom', 'fonction', 'email', 'telephone', 'type_contact']

    for (const field of fieldsToCheck) {
      if (new_data[field as keyof typeof new_data] !== undefined) {
        if (shouldUpdate(field, existingContact[field], new_data[field as keyof typeof new_data])) {
          oldValues[field] = existingContact[field]
          newValues[field] = new_data[field as keyof typeof new_data]
          updates[field] = new_data[field as keyof typeof new_data]
          changedFields.push(field)
        }
      }
    }

    // 3. If no changes, return early
    if (changedFields.length === 0) {
      return new Response(
        JSON.stringify({
          updated: false,
          message: 'No fields require update',
          contact_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Create history entry BEFORE updating
    const { error: historyError } = await supabaseAdmin.from('contacts_history').insert({
      contact_id,
      old_values: oldValues,
      new_values: newValues,
      changed_fields: changedFields,
      change_source: source,
      source_reference,
      confidence_score: confidence,
    })

    if (historyError) {
      console.error('Error creating history entry:', historyError)
      // Continue anyway, history is not critical
    }

    // 5. Update the contact
    updates.updated_at = new Date().toISOString()

    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updates)
      .eq('id', contact_id)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update contact', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Contact enriched: ${contact_id}`, {
      changed_fields: changedFields,
      source,
      confidence,
    })

    return new Response(
      JSON.stringify({
        updated: true,
        contact_id,
        changed_fields: changedFields,
        old_values: oldValues,
        new_values: newValues,
        confidence,
        source,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in enrich-contact-from-email:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
