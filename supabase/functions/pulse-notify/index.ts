import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { validateServiceOrUser } from '../_shared/auth-helpers.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface PulseNotifyPayload {
  type: 'new_message' | 'mention' | 'reply' | 'task_link' | 'member_added'
  conversation_id: string
  message_id?: string
  actor_user_id: string
  target_user_ids?: string[]
  content_preview?: string
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // SECURITY: Validate caller authentication
    const { authorized } = await validateServiceOrUser(req)
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const payload: PulseNotifyPayload = await req.json()
    console.log(
      '[Pulse Notify] Received:',
      payload.type,
      'for conversation:',
      payload.conversation_id
    )

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('pulse_conversations')
      .select('id, name')
      .eq('id', payload.conversation_id)
      .single()

    if (convError || !conversation) {
      console.error('[Pulse Notify] Conversation not found')
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get actor profile
    const { data: actor } = await supabase
      .from('profiles')
      .select('id, nom, prenom')
      .eq('id', payload.actor_user_id)
      .single()

    const actorName = actor ? `${actor.prenom} ${actor.nom}` : 'Un utilisateur'

    // Determine target users
    let targetUserIds: string[] = []

    if (payload.target_user_ids && payload.target_user_ids.length > 0) {
      targetUserIds = payload.target_user_ids.filter((id) => id !== payload.actor_user_id)
    } else {
      const { data: members } = await supabase
        .from('pulse_conversation_members')
        .select('user_id, notification_level')
        .eq('conversation_id', payload.conversation_id)
        .neq('user_id', payload.actor_user_id)
        .limit(50)

      if (members) {
        targetUserIds = members
          .filter(
            (m) =>
              m.notification_level === 'all' ||
              (m.notification_level === 'mentions' && payload.type === 'mention')
          )
          .map((m) => m.user_id)
      }
    }

    if (targetUserIds.length === 0) {
      console.log('[Pulse Notify] No target users to notify')
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build notification content
    let title = ''
    let body = ''
    const tag = `pulse_${payload.conversation_id}`

    switch (payload.type) {
      case 'new_message':
        title = `💬 ${conversation.name}`
        body = `${actorName}: ${payload.content_preview?.substring(0, 100) || 'Nouveau message'}`
        break
      case 'mention':
        title = `📢 Mention dans ${conversation.name}`
        body = `${actorName} vous a mentionné`
        break
      case 'reply':
        title = `↩️ Réponse dans ${conversation.name}`
        body = `${actorName} a répondu à votre message`
        break
      case 'task_link':
        title = `📋 Tâche liée dans ${conversation.name}`
        body = `${actorName} a lié une tâche au message`
        break
      case 'member_added':
        title = `👋 ${conversation.name}`
        body = `${actorName} vous a ajouté à la conversation`
        break
    }

    // Call send-push-notification function
    const { data: pushResult, error: pushError } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          user_ids: targetUserIds,
          title,
          body,
          url: `/pulse?conversation=${payload.conversation_id}`,
          tag,
          type: 'pulse',
          related_id: payload.message_id || payload.conversation_id,
        },
      }
    )

    if (pushError) {
      console.error('[Pulse Notify] Push error:', pushError)
    } else {
      console.log('[Pulse Notify] Push result:', pushResult)
    }

    // Create in-app notifications for each user
    for (const userId of targetUserIds) {
      await supabase.from('in_app_notifications').insert({
        user_id: userId,
        title,
        message: body,
        type: 'pulse',
        related_type: 'pulse_message',
        related_id: payload.message_id || payload.conversation_id,
        is_read: false,
      })
    }

    console.log(`[Pulse Notify] Notified ${targetUserIds.length} users`)

    return new Response(
      JSON.stringify({
        sent: targetUserIds.length,
        push_result: pushResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return buildErrorResponse('pulse-notify', error, corsHeaders)
  }
}

serve(handler)
