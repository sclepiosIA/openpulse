import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'
import { checkRateLimit, extractClientIp, rateLimitedResponse } from '../_shared/rate-limit.ts'

// Input validation schemas
const IPAddressSchema = z
  .string()
  .min(7, 'IP address too short')
  .max(45, 'IP address too long') // Support IPv6
  .refine((ip) => {
    // Basic IP format validation (IPv4 or IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'unknown'
  }, 'Invalid IP address format')

const PathSchema = z.string().max(2048, 'Path too long').optional()

const UserAgentSchema = z.string().max(512, 'User agent too long').optional()

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gestion-marque-ia.apercu.example.org',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-forwarded-for, cf-connecting-ip, x-validator-secret',
}

interface IPValidationRequest {
  path?: string
  userAgent?: string
}

export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const rl = checkRateLimit(`ip-validator:${extractClientIp(req)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSec ?? 1, corsHeaders)

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    // Extract client IP with minimal logging
    const getClientIP = (request: Request): string => {
      const cfConnectingIP = request.headers.get('cf-connecting-ip')
      const xForwardedFor = request.headers.get('x-forwarded-for')
      const xRealIP = request.headers.get('x-real-ip')

      if (cfConnectingIP) return cfConnectingIP
      if (xRealIP) return xRealIP
      if (xForwardedFor) return xForwardedFor.split(',')[0].trim()

      return 'unknown'
    }

    const clientIP = getClientIP(req)

    // Validate IP address format
    const ipValidation = IPAddressSchema.safeParse(clientIP)
    if (!ipValidation.success) {
      console.error('Invalid IP format detected')
      return new Response(
        JSON.stringify({
          authorized: false,
          error: 'Invalid IP address format',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('IP validation request received') // No PII in logs

    // First, check if IP whitelist is enabled in security config
    const { data: securityConfig, error: configError } = await supabase
      .from('security_config')
      .select('ip_whitelist_enabled')
      .single()

    if (configError) {
      console.error('Error fetching security config:', configError)
      return new Response(
        JSON.stringify({
          authorized: false,
          error: 'Configuration error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If IP whitelist is disabled, allow all access
    if (!securityConfig.ip_whitelist_enabled) {
      console.log('IP whitelist disabled - allowing access') // No PII in logs
      return new Response(
        JSON.stringify({
          authorized: true,
          message: 'Accès autorisé (filtrage IP désactivé)',
          whitelist_enabled: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // IP whitelist is enabled, require validator secret for security
    const validatorSecret = req.headers.get('x-validator-secret')
    const expectedSecret = Deno.env.get('IP_VALIDATOR_SECRET')

    if (!validatorSecret || validatorSecret !== expectedSecret) {
      console.log('Unauthorized access attempt - missing or invalid secret (whitelist enabled)')
      return new Response(
        JSON.stringify({
          authorized: false,
          error: 'Unauthorized - invalid secret',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('IP whitelist enabled - checking authorized IPs') // No PII in logs

    // Check if IP is in authorized list
    const { data: authorizedIPs, error } = await supabase
      .from('authorized_ips')
      .select('ip_address')
      .eq('ip_address', clientIP)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({
          authorized: false,
          error: 'Database validation error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const isAuthorized = authorizedIPs && authorizedIPs.length > 0

    if (!isAuthorized) {
      // Validate and sanitize inputs before logging
      const userAgent = req.headers.get('user-agent') || null
      const path = req.url || null

      const sanitizedUserAgent = userAgent
        ? UserAgentSchema.parse(userAgent.substring(0, 512))
        : null
      const sanitizedPath = path ? PathSchema.parse(path.substring(0, 2048)) : null

      // Log unauthorized access attempt
      await supabase.rpc('log_unauthorized_access', {
        client_ip: clientIP,
        user_agent: sanitizedUserAgent,
        path: sanitizedPath,
      })

      console.log('Unauthorized IP access blocked') // No PII in logs

      return new Response(
        JSON.stringify({
          authorized: false,
          message: 'Accès non autorisé',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Authorized access granted') // No PII in logs

    return new Response(
      JSON.stringify({
        authorized: true,
        message: 'Accès autorisé',
        whitelist_enabled: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    console.error(
      'Error in IP validation:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    // Don't expose internal error details to client
    return buildErrorResponse('ip-validator', error, corsHeaders, 500)
  }
}

Deno.serve(handler)
