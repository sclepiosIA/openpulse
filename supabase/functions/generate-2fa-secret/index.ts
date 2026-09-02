import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as OTPAuth from 'https://esm.sh/otpauth@9.4.1?target=deno'
import { z } from 'npm:zod@3.25.76'
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

// Input validation schemas
const Generate2FASchema = z.object({
  action: z.enum(['generate', 'verify', 'validate'], {
    errorMap: () => ({ message: 'Invalid action. Must be: generate, verify, or validate' })
  }),
  token: z.string().regex(/^\d{6}$/, {
    message: 'Token must be exactly 6 digits'
  }).optional()
})

// CORS headers - allowing all origins for 2FA generation
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gestion-marque-ia.apercu.example.org',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-function-context',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables  
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration')
    }

    // Create service role client for secure access to secrets with function context
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { 'x-function-context': 'generate-2fa-secret' }
      }
    })

    // Verify user is authenticated via the regular client
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse and validate request body
    const rawBody = await req.json()
    const validationResult = Generate2FASchema.safeParse(rawBody)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: errors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action, token } = validationResult.data

    if (action === 'generate') {
      // Generate new 2FA secret using OTPAuth (Deno-compatible)
      const secret = (OTPAuth as any).Secret?.fromRandom && typeof (OTPAuth as any).Secret.fromRandom === 'function'
        ? (OTPAuth as any).Secret.fromRandom()
        : new (OTPAuth as any).Secret()
      const totp = new OTPAuth.TOTP({
        issuer: 'OpenPulse',
        label: user.email ?? 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      })

      const otpauthUrl = totp.toString()

      // Store temporary secret using service role (secure access)
      const { error: updateError } = await supabaseService
        .rpc('update_user_2fa_secret', {
          target_user_id: user.id,
          secret: null, // Don't activate yet
          temp_secret: secret.base32
        })

      if (updateError) {
        console.error('Error storing temp 2FA secret for user ID:', user.id) // No PII in logs
        throw updateError
      }

      return new Response(JSON.stringify({
        secret: secret.base32,
        manual_entry_key: secret.base32,
        qrCodeUrl: otpauthUrl,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else if (action === 'verify') {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Token is required for verification' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get temporary secret using service role
      const { data: tempSecret, error: secretError } = await supabaseService.rpc('get_user_temp_2fa_secret', {
        target_user_id: user.id
      })

      if (secretError || !tempSecret) {
        return new Response(JSON.stringify({ error: 'No temporary secret found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify the token using OTPAuth
      const totp = new OTPAuth.TOTP({
        issuer: 'OpenPulse',
        label: user.email ?? 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(tempSecret),
      })

      const delta = totp.validate({ token: String(token), window: 2 })
      const verified = delta !== null

      if (verified) {
        // Activate 2FA by moving temp secret to permanent secret
        const { error: activateError } = await supabaseService
          .rpc('update_user_2fa_secret', {
            target_user_id: user.id,
            secret: tempSecret,
            temp_secret: null
          })

        if (activateError) {
          console.error('Error activating 2FA for user ID:', user.id) // No PII in logs
          throw activateError
        }

        // Update user profile to enable 2FA (using service role for security)
        const { error: profileError } = await supabaseService
          .from('profiles')
          .update({ two_factor_enabled: true })
          .eq('user_id', user.id)

        if (profileError) {
          console.error('Error updating profile for user ID:', user.id) // No PII in logs
          throw profileError
        }
      }

      return new Response(JSON.stringify({ verified, success: verified }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else if (action === 'validate') {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Token is required for validation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get user's active 2FA secret using service role
      const { data: activeSecret, error: secretError } = await supabaseService.rpc('get_user_2fa_secret', {
        target_user_id: user.id
      })

      if (secretError || !activeSecret) {
        return new Response(JSON.stringify({ valid: false, error: '2FA not enabled' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Validate the token using OTPAuth
      const totp = new OTPAuth.TOTP({
        issuer: 'OpenPulse',
        label: user.email ?? 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(activeSecret),
      })

      const delta = totp.validate({ token: String(token), window: 2 })
      const valid = delta !== null

      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

  } catch (error: unknown) {
    console.error('2FA Error:', error instanceof Error ? error.message : 'Unknown error')
    // Don't expose internal error details to client
    return buildErrorResponse('generate-2fa-secret', error, corsHeaders, 500);
  }
})
