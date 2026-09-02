import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { isThirdPartyIframe } from '@/lib/iframeDetection'
import { useVapidPublicKey } from '@/hooks/shared/useAppConfig'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { debug } from '@/lib/debug'

// Types d'applications PWA
export type PWAAppScope = 'main' | 'mail' | 'todos' | 'pulse' | 'calendar'

// Mapping routes → app_scope
const ROUTE_TO_SCOPE: Record<string, PWAAppScope> = {
  '/m/mail': 'mail',
  '/m/pulse': 'pulse',
  '/m/todos': 'todos',
  '/m/calendrier': 'calendar',
  '/emails': 'mail',
  '/pulse': 'pulse',
  '/todos': 'todos',
  '/calendrier': 'calendar',
}

// Détecte le scope de la PWA courante basé sur la route
function detectAppScope(pathname: string): PWAAppScope {
  for (const [route, scope] of Object.entries(ROUTE_TO_SCOPE)) {
    if (pathname.startsWith(route)) {
      return scope
    }
  }
  return 'main'
}

// Clé publique VAPID - fallback si app_config non chargé
const VAPID_PUBLIC_KEY_FALLBACK =
  ''

// Détecte si on est dans un aperçu tiers
function isApercuTiersPreview(): boolean {
  try {
    const hostname = window.location.hostname
    // Detect by hostname first (works in both iframe and direct access)
    if (hostname.includes('preview--') || hostname.includes('previsualisation.example.org')) {
      return true
    }
    // Fallback: detect iframe context with référent d'aperçu tiers
    if (window.self !== window.top) {
      const referrer = document.referrer || ''
      return referrer.includes('generation.example.org') || referrer.includes('apercu.example.org')
    }
    return false
  } catch {
    return true
  }
}

// Timeout wrapper for service worker ready
async function getServiceWorkerWithTimeout(
  timeoutMs = 5000
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  // Skip if no SW is registered (e.g. aperçu tiers)
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    if (registrations.length === 0) return null
  } catch {
    return null
  }

  try {
    const result = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Service worker timeout')), timeoutMs)
      ),
    ])
    return result as ServiceWorkerRegistration
  } catch (error) {
    debug.warn('[Push] Service worker ready timeout:', error)
    return null
  }
}

// Helper pour vérifier si Notification existe dans le scope global
function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

// Helper pour obtenir la permission actuelle en toute sécurité
function getNotificationPermission(): NotificationPermission {
  if (isNotificationSupported()) {
    return Notification.permission
  }
  return 'default'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export interface PushPreferences {
  enabled: boolean
  email_notifications: boolean
  task_notifications: boolean
  ai_suggestions: boolean
  calendar_reminders: boolean
  treasury_alerts: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

// Detect iOS Safari
function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
  return isIOS && isSafari
}

// Check if running as installed PWA on iOS
function isIOSPWA(): boolean {
  return isIOSSafari() && navigator.standalone === true
}

// Check if iOS version supports Web Push (iOS 16.4+)
function isIOSWebPushSupported(): boolean {
  if (!isIOSSafari()) return false

  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  if (!match) return false

  const majorVersion = parseInt(match[1], 10)
  const minorVersion = parseInt(match[2], 10)

  // Web Push supported from iOS 16.4+
  return majorVersion > 16 || (majorVersion === 16 && minorVersion >= 4)
}

export interface PushNotificationStatus {
  isSupported: boolean
  isIOSSafari: boolean
  isIOSPWA: boolean
  iosWebPushSupported: boolean
  needsPWAInstall: boolean
}

export function usePushNotifications() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [preferences, setPreferences] = useState<PushPreferences | null>(null)
  const [isSendingTest, setIsSendingTest] = useState(false)

  // Clé VAPID depuis app_config (centralisée) avec fallback hardcodé
  const vapidKey = useVapidPublicKey() || VAPID_PUBLIC_KEY_FALLBACK

  // Détecte le scope de la PWA courante
  const currentAppScope = detectAppScope(location.pathname)

  // Detect aperçu tiers environment
  const inApercuTiers = isApercuTiersPreview() || isThirdPartyIframe()

  // Écouter les messages du Service Worker pour marquer les emails comme lus
  useEffect(() => {
    const handleSWMessage = async (event: MessageEvent) => {
      const data = event.data

      // Gestion de "Marquer comme lu" depuis la notification push
      if (data?.type === 'MARK_EMAIL_READ' && data?.threadId) {
        debug.log('[Push] Marking email thread as read:', data.threadId)
        try {
          // Marquer tous les messages du thread comme lus
          await supabase
            .from('email_messages')
            .update({ is_read: true })
            .eq('thread_id', data.threadId)

          // Invalider les caches pour mettre à jour l'UI
          queryClient.invalidateQueries({ queryKey: ['email-threads'] })
          queryClient.invalidateQueries({ queryKey: ['email-unread-count'] })

          toast.success('Email marqué comme lu')
        } catch (error) {
          debug.error('[Push] Failed to mark email as read:', error)
        }
      }

      // Gestion de la navigation depuis la notification
      if (data?.type === 'NAVIGATE_TO' && data?.url) {
        debug.log('[Push] Navigating to:', data.url)
        navigate(data.url)
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage)
      return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage)
    }
  }, [queryClient, navigate])

  // Determine device/browser status
  const iosStatus = {
    isIOSSafari: isIOSSafari(),
    isIOSPWA: isIOSPWA(),
    iosWebPushSupported: isIOSWebPushSupported(),
  }

  // Push is supported if:
  // - NOT in aperçu tiers (service worker disabled there)
  // - Standard browsers with Notification + serviceWorker + PushManager
  // - OR iOS 16.4+ Safari running as installed PWA
  const isSupported =
    !inApercuTiers &&
    (('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) ||
      (iosStatus.iosWebPushSupported && iosStatus.isIOSPWA))

  // iOS Safari needs PWA install to use push
  const needsPWAInstall =
    iosStatus.isIOSSafari && iosStatus.iosWebPushSupported && !iosStatus.isIOSPWA

  // Environment log moved to useEffect to prevent logging on every render
  useEffect(() => {
    if (import.meta.env.DEV) {
      debug.log('[Push] Environment:', {
        inApercuTiers,
        isSupported,
        permission: getNotificationPermission(),
      })
    }
  }, [inApercuTiers, isSupported])

  // Check current permission and subscription status
  useEffect(() => {
    const checkStatus = async () => {
      if (!isSupported || inApercuTiers) {
        setIsLoading(false)
        return
      }

      if (isNotificationSupported()) {
        setPermission(Notification.permission)
      }

      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        // Check if already subscribed with timeout
        const registration = await getServiceWorkerWithTimeout()
        if (registration) {
          const subscription = await registration.pushManager.getSubscription()

          if (subscription) {
            // Verify subscription exists in database
            const { data } = await supabase
              .from('push_subscriptions')
              .select('id')
              .eq('user_id', user.id)
              .eq('endpoint', subscription.endpoint)
              .maybeSingle()

            setIsSubscribed(!!data)
          }
        }

        // Load preferences
        const { data: prefs } = await supabase
          .from('push_notification_preferences')
          .select(
            'id, user_id, enabled, email_notifications, task_notifications, ai_suggestions, calendar_reminders, treasury_alerts, quiet_hours_start, quiet_hours_end, created_at, updated_at'
          )
          .eq('user_id', user.id)
          .maybeSingle()

        if (prefs) {
          setPreferences(prefs as unknown as PushPreferences)
        }
      } catch (error) {
        debug.error('[Push] Error checking status:', error)
      }

      setIsLoading(false)
    }

    checkStatus()
  }, [user, isSupported, inApercuTiers])

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNotificationSupported()) {
      toast.error('Les notifications ne sont pas supportées par ce navigateur')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (error) {
      debug.error('[Push] Permission error:', error)
      return false
    }
  }, [])

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    debug.log('[Push] Subscribe called:', {
      userId: user?.id,
      authLoading,
      isSupported,
      needsPWAInstall,
      permission: getNotificationPermission(),
    })

    // Wait for auth to load
    if (authLoading) {
      debug.log('[Push] Auth still loading, waiting...')
      toast.info("Chargement de l'authentification...")
      return false
    }

    if (!user) {
      debug.error('[Push] Subscribe failed: user is null after auth loaded')
      toast.error('Vous devez être connecté pour activer les notifications')
      return false
    }

    if (!isSupported) {
      if (needsPWAInstall) {
        toast.error(
          "Installez l'application sur votre écran d'accueil pour activer les notifications"
        )
      } else {
        toast.error('Push notifications non supportées')
      }
      return false
    }

    try {
      // Request permission if needed
      if (!isNotificationSupported() || Notification.permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) {
          toast.error('Permission refusée pour les notifications')
          return false
        }
      }

      const registration = await navigator.serviceWorker.ready

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidKey)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })

      const keys = subscription.toJSON().keys
      if (!keys) {
        throw new Error('Failed to get subscription keys')
      }

      // Determine device type for better tracking
      const deviceType = iosStatus.isIOSPWA
        ? 'ios_pwa'
        : iosStatus.isIOSSafari
          ? 'ios_safari'
          : /Android/.test(navigator.userAgent)
            ? 'android'
            : /Mac/.test(navigator.userAgent)
              ? 'mac'
              : /Windows/.test(navigator.userAgent)
                ? 'windows'
                : 'other'

      // Récupérer les scopes existants pour cette subscription (si elle existe)
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('app_scopes')
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint)
        .maybeSingle()

      // Ajouter le scope courant au tableau (sans dupliquer)
      const existingScopes: string[] = existing?.app_scopes || ['main']
      const newScopes = existingScopes.includes(currentAppScope)
        ? existingScopes
        : [...existingScopes, currentAppScope]

      // Save to database avec les scopes combinés
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          device_type: deviceType,
          app_scope: currentAppScope, // Legacy: scope simple pour compatibilité
          app_scopes: newScopes, // Nouveau: tableau de scopes
        },
        {
          onConflict: 'user_id,endpoint',
        }
      )

      if (error) throw error

      // Create default preferences if not exists
      await supabase.from('push_notification_preferences').upsert(
        {
          user_id: user.id,
          enabled: true,
        },
        {
          onConflict: 'user_id',
        }
      )

      setIsSubscribed(true)
      // Mark that the user has subscribed at least once (prevents prompt re-display)
      try {
        localStorage.setItem('push-subscribed-once', 'true')
      } catch {
        /* localStorage indisponible (mode privé) — non bloquant */
      }
      toast.success('Notifications push activées')
      return true
    } catch (error: unknown) {
      debug.error('[Push] Subscribe error:', error)
      toast.error(sanitizeSupabaseError(error))
      return false
    }
  }, [user, authLoading, isSupported, needsPWAInstall, requestPermission, iosStatus])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
      }

      setIsSubscribed(false)
      toast.success('Notifications push désactivées')
      return true
    } catch (error) {
      debug.error('[Push] Unsubscribe error:', error)
      toast.error('Erreur lors de la désactivation')
      return false
    }
  }, [user])

  // Update preferences
  const updatePreferences = useCallback(
    async (newPrefs: Partial<PushPreferences>): Promise<boolean> => {
      if (!user) return false

      try {
        const { error } = await supabase.from('push_notification_preferences').upsert(
          {
            user_id: user.id,
            ...preferences,
            ...newPrefs,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )

        if (error) throw error

        setPreferences((prev) => (prev ? { ...prev, ...newPrefs } : null))
        toast.success('Préférences mises à jour')
        return true
      } catch (error) {
        debug.error('[Push] Update preferences error:', error)
        toast.error('Erreur lors de la mise à jour')
        return false
      }
    },
    [user, preferences]
  )

  // Send test notification
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!user || !isSubscribed) {
      toast.error("Vous devez d'abord activer les notifications")
      return false
    }

    setIsSendingTest(true)

    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          title: '🔔 Test de notification',
          body: 'Les notifications push fonctionnent correctement !',
          type: 'test',
          url: '/parametres',
        },
      })

      if (error) throw error

      if (data?.sent > 0) {
        toast.success('Notification de test envoyée !')
        return true
      } else {
        toast.warning('Aucune notification envoyée. Vérifiez vos abonnements.')
        return false
      }
    } catch (error) {
      debug.error('[Push] Test notification error:', error)
      toast.error("Erreur lors de l'envoi du test")
      return false
    } finally {
      setIsSendingTest(false)
    }
  }, [user, isSubscribed])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    preferences,
    requestPermission,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    isSendingTest,
    // iOS specific
    isIOSSafari: iosStatus.isIOSSafari,
    isIOSPWA: iosStatus.isIOSPWA,
    iosWebPushSupported: iosStatus.iosWebPushSupported,
    needsPWAInstall,
    // aperçu tiers detection
    isApercuTiersPreview: inApercuTiers,
  }
}
