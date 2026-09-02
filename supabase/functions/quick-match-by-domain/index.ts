import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'
import { checkRateLimit, extractClientIp, rateLimitedResponse } from '../_shared/rate-limit.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // JWT Authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limiting
    const clientIp = extractClientIp(req)
    const rateLimit = checkRateLimit(`quick-match-by-domain:${clientIp}`, {
      limit: 100,
      windowSec: 60,
    })
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`)
      return rateLimitedResponse(rateLimit.retryAfterSec ?? 1, corsHeaders, 'Rate limit exceeded')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )

    const { domain } = await req.json()

    if (!domain || typeof domain !== 'string') {
      return new Response(JSON.stringify({ error: 'Domain is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedDomain = domain.toLowerCase().trim()
    console.log(`🔍 Quick match for domain: ${normalizedDomain}`)

    // Search in email_domain_mappings for direct match
    const { data: mapping, error } = await supabase
      .from('email_domain_mappings')
      .select('etablissement_id, groupe_id, niveau_mapping, confidence_level, verified')
      .eq('domain', normalizedDomain)
      .eq('verified', true)
      .eq('confidence_level', 'high')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error)
      throw error
    }

    if (mapping) {
      if (mapping.niveau_mapping === 'groupe' && mapping.groupe_id) {
        console.log(`✅ Groupe match found for ${normalizedDomain} -> groupe ${mapping.groupe_id}`)
        return new Response(
          JSON.stringify({
            success: true,
            matched: true,
            groupe_id: mapping.groupe_id,
            confidence: 'high',
            method: 'domain_mapping_groupe',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(
        `✅ Match found for ${normalizedDomain} -> etablissement ${mapping.etablissement_id}`
      )
      return new Response(
        JSON.stringify({
          success: true,
          matched: true,
          etablissement_id: mapping.etablissement_id,
          confidence: 'high',
          method: 'domain_mapping',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`❌ No match found for ${normalizedDomain}`)
    return new Response(
      JSON.stringify({
        success: true,
        matched: false,
        etablissement_id: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in quick-match-by-domain:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
