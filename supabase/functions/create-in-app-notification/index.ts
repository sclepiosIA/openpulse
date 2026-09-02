import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

// Input validation schema
const NotificationPayloadSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum([
    'ai_suggestion',
    'task_assignment',
    'task_completion',
    'establishment_update',
    'mention',
    'other',
  ]),
  related_id: z.string().uuid().optional(),
  related_type: z.enum(['etablissement', 'tache', 'ai_suggestion', 'email']).nullable().optional(),
})

// Simple rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // SECURITY: Validate service role key
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!authHeader || !authHeader.includes(serviceRoleKey)) {
      console.error('Unauthorized: Invalid service role key')
      return new Response(JSON.stringify({ error: 'Unauthorized: Service role key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // SECURITY: Rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`)
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // Edge functions do not need browser-session persistence or token refresh.
    // Disabling both prevents each request from leaving an auth refresh timer alive.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json()

    // SECURITY: Validate input with Zod
    const validationResult = NotificationPayloadSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error)
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validationResult.error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const payload = validationResult.data

    // Check user notification preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('user_id', payload.user_id)
      .single()

    const preferences = profile?.preferences || {}
    const inAppPrefs =
      (
        preferences as {
          in_app_notifications?: Record<string, boolean>
        }
      ).in_app_notifications || {}

    // Check if this type of notification is enabled
    const notificationTypeEnabled = {
      ai_suggestion: inAppPrefs.ai_suggestions !== false,
      task_assignment: inAppPrefs.task_assignment !== false,
      task_completion: inAppPrefs.task_completion !== false,
      establishment_update: inAppPrefs.establishment_updates !== false,
      mention: inAppPrefs.comments_mentions !== false,
      other: true,
    }

    if (!notificationTypeEnabled[payload.type]) {
      console.log(`Notification ${payload.type} disabled for user ${payload.user_id}`)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Notification skipped due to user preferences',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create the notification
    const { data: notification, error } = await supabase
      .from('in_app_notifications')
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        related_id: payload.related_id || null,
        related_type: payload.related_type || null,
        is_read: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to create notification',
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Created notification for user ${payload.user_id}: ${payload.title}`)

    return new Response(JSON.stringify({ success: true, notification }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return buildErrorResponse('create-in-app-notification', error, corsHeaders, 500)
  }
}

serve(handler)
