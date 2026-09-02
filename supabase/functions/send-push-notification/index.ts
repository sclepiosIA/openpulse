import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import webpush from 'npm:web-push@3.6.7'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface PushPayload {
  user_id?: string
  user_ids?: string[]
  title: string
  body: string
  url?: string
  tag?: string
  type?:
    | 'email'
    | 'task'
    | 'ai_suggestion'
    | 'calendar'
    | 'treasury'
    | 'test'
    | 'pulse'
    | 'pulse_visio'
  related_id?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
}

// Mapping type de notification → scopes PWA cibles
// IMPORTANT: On NE met plus 'main' en fallback pour les PWA dédiées
// Ainsi, si l'utilisateur a installé l'app Mail, il ne reçoit les emails QUE sur Mail
const TYPE_TO_SCOPES: Record<string, string[]> = {
  email: ['mail'], // Emails → UNIQUEMENT Mail PWA
  task: ['todos'], // Tâches → UNIQUEMENT Todos PWA
  pulse: ['pulse'], // Messages Pulse → UNIQUEMENT Pulse PWA
  pulse_visio: ['pulse'], // Visio Pulse → UNIQUEMENT Pulse PWA
  calendar: ['calendar'], // Calendrier → UNIQUEMENT Calendar PWA
  ai_suggestion: ['main'], // Suggestions IA → Main uniquement (pas d'app dédiée)
  treasury: ['main'], // Trésorerie → Main uniquement
  test: ['main', 'mail', 'todos', 'pulse', 'calendar'], // Test → toutes les PWA
}

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Determine provider from endpoint URL
function getProvider(endpoint: string): string {
  if (endpoint.includes('apple') || endpoint.includes('push.apple.com')) return 'apple'
  if (endpoint.includes('mozilla') || endpoint.includes('push.services.mozilla.com'))
    return 'mozilla'
  return 'fcm'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // SECURITY: Validate caller is either service-to-service or authenticated user
    const { validateServiceOrUser } = await import('../_shared/auth-helpers.ts')
    const { authorized } = await validateServiceOrUser(req)
    if (!authorized) {
      console.error('[Push] Unauthorized request - no valid auth')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
    let vapidSubject = Deno.env.get('VAPID_SUBJECT')
    // Ensure VAPID subject has mailto: prefix if it's an email
    if (
      vapidSubject &&
      !vapidSubject.startsWith('mailto:') &&
      !vapidSubject.startsWith('https://')
    ) {
      vapidSubject = `mailto:${vapidSubject}`
    }

    console.log('[Push] === Configuration ===')
    console.log(`[Push] VAPID Public Key length: ${vapidPublicKey?.length || 0}`)
    console.log(`[Push] VAPID Private Key length: ${vapidPrivateKey?.length || 0}`)
    console.log(`[Push] VAPID Subject: ${vapidSubject}`)

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured')
    }

    // Configure web-push with VAPID details
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload: PushPayload = await req.json()

    console.log('[Push] === Request ===')
    console.log('[Push] Title:', payload.title)
    console.log('[Push] Type:', payload.type)

    // Get target user IDs
    const userIds: string[] = []
    if (payload.user_id) userIds.push(payload.user_id)
    if (payload.user_ids) userIds.push(...payload.user_ids)

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No user_id or user_ids provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check user preferences (skip for test notifications)
    let filteredUserIds = userIds

    // Helper: quiet_hours actives (Europe/Paris par défaut)
    const isInQuietHours = (start: string | null, end: string | null): boolean => {
      if (!start || !end) return false
      try {
        const now = new Date()
        // Heure locale Europe/Paris "HH:MM"
        const hhmm = new Intl.DateTimeFormat('fr-FR', {
          timeZone: 'Europe/Paris',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(now)
        const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10))
        const cur = h * 60 + m
        const [sh, sm] = start.split(':').map((v) => parseInt(v, 10))
        const [eh, em] = end.split(':').map((v) => parseInt(v, 10))
        const s = sh * 60 + sm
        const e = eh * 60 + em
        // Plage overnight (ex: 22:00 → 07:00)
        return s <= e ? cur >= s && cur < e : cur >= s || cur < e
      } catch {
        return false
      }
    }

    if (payload.type !== 'test') {
      const { data: preferences } = await supabase
        .from('push_notification_preferences')
        .select(
          'user_id, enabled, email_notifications, task_notifications, ai_suggestions, calendar_reminders, treasury_alerts, quiet_hours_start, quiet_hours_end'
        )
        .in('user_id', userIds)

      filteredUserIds = userIds.filter((userId) => {
        const pref = preferences?.find((p) => p.user_id === userId)
        // Pas de ligne de préférences : opt-in par défaut (comportement historique)
        if (!pref) return true
        if (!pref.enabled) return false
        if (isInQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) {
          console.log(`[Push] Skipping user ${userId} — quiet hours active`)
          return false
        }

        switch (payload.type) {
          case 'email':
            return pref.email_notifications
          case 'task':
            return pref.task_notifications
          case 'ai_suggestion':
            return pref.ai_suggestions
          case 'calendar':
            return pref.calendar_reminders
          case 'treasury':
            return pref.treasury_alerts
          case 'pulse':
          case 'pulse_visio':
            return true // pas de flag dédié, respect de `enabled` déjà fait
          default:
            return true
        }
      })
    }

    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: userIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Déterminer les scopes cibles basés sur le type de notification
    const targetScopes = TYPE_TO_SCOPES[payload.type || 'test'] || ['main']
    console.log(`[Push] Target scopes for type '${payload.type}':`, targetScopes)

    // Get subscriptions filtrées par app_scopes (array) avec overlap
    // On récupère les subscriptions où app_scopes contient AU MOINS UN des scopes cibles
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, app_scopes')
      .in('user_id', filteredUserIds)
      .overlaps('app_scopes', targetScopes)

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`)
    }

    console.log(`[Push] Found ${subscriptions?.length || 0} subscriptions matching scopes`)

    // Si aucune subscription ne matche les scopes spécifiques, fallback vers 'main'
    // Cela permet aux utilisateurs sans PWA dédiée de recevoir toutes les notifs sur main
    let finalSubscriptions = subscriptions || []
    if (finalSubscriptions.length === 0 && !targetScopes.includes('main')) {
      console.log(`[Push] No subscriptions for ${targetScopes.join(',')}, falling back to 'main'`)
      const { data: mainSubs } = await supabase
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth, app_scopes')
        .in('user_id', filteredUserIds)
        .overlaps('app_scopes', ['main'])

      finalSubscriptions = mainSubs || []
      console.log(`[Push] Fallback found ${finalSubscriptions.length} 'main' subscriptions`)
    }

    if (finalSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, no_subscriptions: true, target_scopes: targetScopes }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Mapping URL desktop → mobile selon le scope de la subscription
    const DESKTOP_TO_MOBILE_URL: Record<string, string> = {
      '/emails': '/m/mail',
      '/pulse': '/m/pulse',
      '/todos': '/m/todos',
      '/calendrier': '/m/calendrier',
    }

    // Mapping type → icône spécifique
    const TYPE_TO_ICON: Record<string, string> = {
      email: '/icons/app-mail-192.png',
      pulse: '/icons/app-pulse-192.png',
      pulse_visio: '/icons/app-pulse-192.png',
      task: '/icons/app-todos-192.png',
      calendar: '/icons/app-calendar-192.png',
    }

    function rewriteUrlForScope(url: string, appScopes: string[]): string {
      // Si le scope inclut 'main', garder l'URL desktop telle quelle
      if (appScopes.includes('main')) return url

      // Réécrire l'URL desktop en URL mobile
      for (const [desktopPrefix, mobilePrefix] of Object.entries(DESKTOP_TO_MOBILE_URL)) {
        if (url.startsWith(desktopPrefix)) {
          return mobilePrefix + url.slice(desktopPrefix.length)
        }
      }
      return url
    }

    const baseIcon = TYPE_TO_ICON[payload.type || ''] || '/icons/icon-192x192.png'
    const baseBadge = TYPE_TO_ICON[payload.type || ''] || '/icons/icon-192x192.png'

    // Send to all subscriptions (fan-out concurrent avec batches limités)
    let sent = 0
    let failed = 0
    const expiredSubscriptions: string[] = []
    const activeSubscriptions: string[] = []
    const errors: { id: string; provider?: string; error?: string; statusCode?: number }[] = []
    const providerStats: Record<string, { sent: number; failed: number }> = {}

    const sendOne = async (sub: (typeof finalSubscriptions)[number]) => {
      const provider = getProvider(sub.endpoint)
      if (!providerStats[provider]) providerStats[provider] = { sent: 0, failed: 0 }

      const subScopes: string[] = sub.app_scopes || ['main']
      const rewrittenUrl = rewriteUrlForScope(payload.url || '/', subScopes)

      const pushPayloadData = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: baseIcon,
        badge: baseBadge,
        tag: payload.tag || payload.type || 'default',
        url: rewrittenUrl,
        type: payload.type,
        related_id: payload.related_id,
        requireInteraction: payload.requireInteraction || false,
        actions: payload.actions || [],
        timestamp: Date.now(),
      })

      const pushSubscription: PushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }

      try {
        const result = await webpush.sendNotification(pushSubscription, pushPayloadData, {
          TTL: 86400,
          urgency: 'high',
        })
        console.log(`[Push] ✓ ${provider} sub ${sub.id} status ${result.statusCode}`)
        sent++
        providerStats[provider].sent++
        activeSubscriptions.push(sub.id)
      } catch (error: any) {
        const statusCode = error.statusCode
        const errorMessage = error.body || error.message || String(error)
        console.error(`[Push] ✗ ${provider} sub ${sub.id} status ${statusCode}: ${errorMessage}`)
        failed++
        providerStats[provider].failed++
        errors.push({ id: sub.id, provider, error: errorMessage, statusCode })

        // Purge uniquement les subscriptions clairement mortes (410/404).
        // 400/413 (payload trop gros) et 429 (rate-limit) ne sont PAS des raisons de supprimer.
        if (statusCode === 410 || statusCode === 404) {
          expiredSubscriptions.push(sub.id)
        }
      }
    }

    // Batches concurrents de 10
    const CONCURRENCY = 10
    for (let i = 0; i < finalSubscriptions.length; i += CONCURRENCY) {
      const batch = finalSubscriptions.slice(i, i + CONCURRENCY)
      await Promise.allSettled(batch.map(sendOne))
    }

    // Mise à jour last_active_at en une seule requête pour les envois OK
    if (activeSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ last_active_at: new Date().toISOString() })
        .in('id', activeSubscriptions)
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredSubscriptions)
      console.log(`[Push] Cleaned up ${expiredSubscriptions.length} expired subscriptions`)
    }

    console.log(`[Push] === Summary ===`)
    console.log(`[Push] Total: ${sent} sent, ${failed} failed`)
    console.log(`[Push] By provider:`, JSON.stringify(providerStats))

    return new Response(
      JSON.stringify({
        sent,
        failed,
        expired_cleaned: expiredSubscriptions.length,
        by_provider: providerStats,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    return buildErrorResponse('send-push-notification', error, corsHeaders, 500)
  }
})
