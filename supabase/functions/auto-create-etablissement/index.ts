import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gestion-marque-ia.apercu.example.org',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-function-secret',
}

interface ExtractedData {
  nom?: string
  ville?: string
  region?: string
  type?: 'CH' | 'ESPIC' | 'Clinique' | 'Autre'
  email?: string
  telephone?: string
  adresse?: string
  code_postal?: string
  contact_nom?: string
  contact_prenom?: string
  contact_email?: string
  contact_telephone?: string
  contact_fonction?: string
  nombre_passages_urgences_annuel?: number
  dpi?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // SECURITY: Check secret OR admin JWT
    const requestSecret = req.headers.get('x-function-secret')
    const expectedSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')

    let isAuthorized = false
    let userId: string | null = null

    // Path 1: Internal secret (for automations)
    if (requestSecret && requestSecret === expectedSecret) {
      console.log('✅ Authorized via internal secret')
      isAuthorized = true
    } else {
      // Path 2: Admin JWT (for authenticated users)
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const authClient = createClient(supabaseUrl, supabaseServiceKey, {
          global: {
            headers: { Authorization: authHeader },
          },
          auth: { persistSession: false, autoRefreshToken: false },
        })

        const {
          data: { user },
        } = await authClient.auth.getUser()
        if (user) {
          userId = user.id
          const { data: isAdmin } = await authClient.rpc('is_admin_strict')
          if (isAdmin) {
            console.log(`✅ Authorized via admin JWT: ${userId}`)
            isAuthorized = true
          }
        }
      }
    }

    if (!isAuthorized) {
      console.error('❌ Unauthorized: No valid secret or admin JWT')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Parse request body
    const { suggestion_id } = await req.json()

    if (!suggestion_id) {
      console.error('Missing suggestion_id')
      return new Response(JSON.stringify({ error: 'suggestion_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Processing suggestion:', suggestion_id)

    // Fetch the suggestion with its email thread
    const { data: suggestion, error: suggestionError } = await supabase
      .from('email_to_etablissement_suggestions')
      .select(
        `
        *,
        email_thread:email_threads(
          id,
          subject,
          participants,
          user_email_account_id
        )
      `
      )
      .eq('id', suggestion_id)
      .single()

    if (suggestionError) {
      console.error('Error fetching suggestion:', suggestionError)
      return new Response(
        JSON.stringify({ error: 'Suggestion not found', details: suggestionError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify suggestion status
    if (suggestion.status !== 'accepted') {
      console.error('Suggestion not accepted:', suggestion.status)
      return new Response(
        JSON.stringify({ error: 'Suggestion must be accepted before creating establishment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if suggestion type is create_new
    if (suggestion.suggestion_type !== 'create_new') {
      console.log('Suggestion is link_existing, skipping establishment creation')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Suggestion is for linking existing establishment',
          suggestion_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const extractedData = suggestion.extracted_data as ExtractedData

    // Validate required data
    if (!extractedData?.nom || !extractedData?.ville) {
      console.error('Missing required data:', extractedData)
      return new Response(
        JSON.stringify({ error: 'Missing required data: nom and ville are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creating establishment with data:', extractedData)

    // Create the establishment
    const { data: etablissement, error: etablissementError } = await supabase
      .from('etablissements')
      .insert({
        nom: extractedData.nom,
        ville: extractedData.ville,
        region: extractedData.region || 'Île-de-France',
        type: extractedData.type || 'CH',
        statut: 'Prospect',
        email: extractedData.email,
        telephone: extractedData.telephone,
        adresse: extractedData.adresse,
        code_postal: extractedData.code_postal,
        nombre_passages_urgences_annuel: extractedData.nombre_passages_urgences_annuel,
        dpi: extractedData.dpi as any,
        notes: `Créé automatiquement depuis email: ${suggestion.email_thread?.subject || 'N/A'}`,
      })
      .select()
      .single()

    if (etablissementError) {
      console.error('Error creating establishment:', etablissementError)
      return new Response(
        JSON.stringify({ error: 'Failed to create establishment', details: etablissementError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Establishment created:', etablissement.id)

    // Create contact if data is available
    if (extractedData.contact_nom || extractedData.contact_email) {
      const { error: contactError } = await supabase.from('contacts').insert({
        etablissement_id: etablissement.id,
        nom: extractedData.contact_nom || 'À définir',
        prenom: extractedData.contact_prenom,
        fonction: extractedData.contact_fonction || 'Contact principal',
        email: extractedData.contact_email,
        telephone: extractedData.contact_telephone,
        est_contact_principal: true,
        type_contact: 'Principal',
      })

      if (contactError) {
        console.warn('Failed to create contact:', contactError)
      } else {
        console.log('Contact created for establishment')
      }
    }

    // Link the email thread to the establishment
    const { error: linkError } = await supabase
      .from('email_threads')
      .update({ etablissement_id: etablissement.id })
      .eq('id', suggestion.email_thread_id)

    if (linkError) {
      console.warn('Failed to link email thread:', linkError)
    } else {
      console.log('Email thread linked to establishment')
    }

    // Apply task models to create initial tasks
    const { data: taskResult, error: taskError } = await supabase.rpc(
      'apply_task_models_to_establishment',
      {
        etablissement_id_param: etablissement.id,
      }
    )

    if (taskError) {
      console.warn('Failed to create initial tasks:', taskError)
    } else {
      console.log('Initial tasks created:', taskResult)
    }

    // Log the successful creation
    console.log('Successfully created establishment:', {
      id: etablissement.id,
      nom: etablissement.nom,
      ville: etablissement.ville,
    })

    return new Response(
      JSON.stringify({
        success: true,
        etablissement,
        tasks_created: taskResult?.[0]?.taches_creees || 0,
        message: 'Establishment created successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: sanitizeErrorForClient(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
