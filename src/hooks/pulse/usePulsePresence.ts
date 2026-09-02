import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import type { PulsePresence, PresenceStatus } from '@/types/pulse'
import { debug } from '@/lib/debug'

const TYPING_TIMEOUT = 3000 // 3 secondes
const PRESENCE_UPDATE_INTERVAL = 30000 // 30 secondes
const PRESENCE_UPDATE_DEBOUNCE = 500 // Debounce pour les mises à jour de présence (augmenté pour performance)
const PRESENCE_UPDATE_THROTTLE = 1000 // Throttle minimum entre les updates

// Hook: Gestion de la présence utilisateur
export function usePulsePresence(conversationId: string | undefined) {
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PulsePresence>>(new Map())
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const presenceUpdateDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdatesRef = useRef<Map<string, PulsePresence>>(new Map())
  const lastUpdateRef = useRef<number>(0) // Throttle pour updatePresence
  const writesPausedUntilRef = useRef<number>(0)

  const shouldSkipPresenceWrite = useCallback(() => Date.now() < writesPausedUntilRef.current, [])

  const handlePresenceWriteError = useCallback((error: unknown) => {
    if (!error) return
    const status = (error as { status?: number })?.status
    const code = (error as { code?: string })?.code
    if (status === 401 || status === 403 || code === '42501') {
      writesPausedUntilRef.current = Date.now() + 30_000
    }
    debug.warn('Pulse presence write skipped:', error)
  }, [])

  // Mettre à jour sa propre présence avec throttle
  const updatePresence = useCallback(
    async (status: PresenceStatus = 'active') => {
      if (!profileId || !conversationId) return
      if (shouldSkipPresenceWrite()) return

      // Throttle: minimum PRESENCE_UPDATE_THROTTLE ms entre les updates (sauf offline)
      const now = Date.now()
      if (status !== 'offline' && now - lastUpdateRef.current < PRESENCE_UPDATE_THROTTLE) {
        return
      }
      lastUpdateRef.current = now

      try {
        const { error } = await supabase.from('pulse_presence').upsert(
          {
            user_id: profileId,
            conversation_id: conversationId,
            status,
            last_seen_at: new Date().toISOString(),
            typing_until: null,
          },
          {
            onConflict: 'user_id,conversation_id',
          }
        )
        if (error) handlePresenceWriteError(error)
      } catch (error) {
        handlePresenceWriteError(error)
      }
    },
    [profileId, conversationId, handlePresenceWriteError, shouldSkipPresenceWrite]
  )

  // Indiquer qu'on est en train de taper
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!profileId || !conversationId) return
      if (shouldSkipPresenceWrite()) return

      // Clear le timeout précédent
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }

      if (isTyping) {
        const typingUntil = new Date(Date.now() + TYPING_TIMEOUT).toISOString()

        try {
          const { error } = await supabase.from('pulse_presence').upsert(
            {
              user_id: profileId,
              conversation_id: conversationId,
              status: 'active',
              last_seen_at: new Date().toISOString(),
              typing_until: typingUntil,
            },
            {
              onConflict: 'user_id,conversation_id',
            }
          )
          if (error) handlePresenceWriteError(error)
        } catch (error) {
          handlePresenceWriteError(error)
        }

        // Auto-clear après timeout
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false)
        }, TYPING_TIMEOUT)
      } else {
        try {
          const { error } = await supabase.from('pulse_presence').upsert(
            {
              user_id: profileId,
              conversation_id: conversationId,
              status: 'active',
              last_seen_at: new Date().toISOString(),
              typing_until: null,
            },
            {
              onConflict: 'user_id,conversation_id',
            }
          )
          if (error) handlePresenceWriteError(error)
        } catch (error) {
          handlePresenceWriteError(error)
        }
      }
    },
    [profileId, conversationId, handlePresenceWriteError, shouldSkipPresenceWrite]
  )

  // Debounced batch update pour les présences
  const flushPendingUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current
    if (updates.size === 0) return

    const now = new Date()
    const nowTyping: string[] = []
    const updatedUserIds = new Set(updates.keys())

    for (const [userId, presence] of updates) {
      const typingUntil = presence.typing_until ? new Date(presence.typing_until) : null
      if (typingUntil && typingUntil > now) {
        nowTyping.push(userId)
      }
    }

    setOnlineUsers((prev) => {
      const next = new Map(prev)
      updates.forEach((presence, userId) => {
        next.set(userId, presence)
      })
      return next
    })

    setTypingUsers((prev) => {
      // Merge avec les typing users existants (hors ceux qu'on vient de mettre à jour)
      const existingTyping = prev.filter((id) => !updatedUserIds.has(id))
      return [...new Set([...existingTyping, ...nowTyping])]
    })

    pendingUpdatesRef.current = new Map()
  }, [])

  const schedulePresenceUpdate = useCallback(
    (presence: PulsePresence) => {
      pendingUpdatesRef.current.set(presence.user_id, presence)

      if (presenceUpdateDebounceRef.current) {
        clearTimeout(presenceUpdateDebounceRef.current)
      }

      presenceUpdateDebounceRef.current = setTimeout(() => {
        flushPendingUpdates()
      }, PRESENCE_UPDATE_DEBOUNCE)
    },
    [flushPendingUpdates]
  )

  // Écouter les changements de présence en temps réel
  useEffect(() => {
    if (!conversationId || !profileId) return

    // Mettre à jour sa présence au montage
    updatePresence('active')

    // Mettre à jour périodiquement
    presenceIntervalRef.current = setInterval(() => {
      updatePresence('active')
    }, PRESENCE_UPDATE_INTERVAL)

    // Écouter les changements via realtime
    const channel = supabase
      .channel(`pulse-presence-${conversationId}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pulse_presence',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const presence = payload.new as PulsePresence

          if (payload.eventType === 'DELETE') {
            const oldPresence = payload.old as PulsePresence
            setOnlineUsers((prev) => {
              const next = new Map(prev)
              next.delete(oldPresence.user_id)
              return next
            })
            setTypingUsers((prev) => prev.filter((id) => id !== oldPresence.user_id))
          } else if (presence.user_id !== profileId) {
            // Utiliser le debounce pour les mises à jour
            schedulePresenceUpdate(presence)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    // Charger les présences initiales
    const loadInitialPresences = async () => {
      const { data } = await supabase
        .from('pulse_presence')
        .select('id, user_id, conversation_id, status, last_seen_at, typing_until')
        .eq('conversation_id', conversationId)
        .neq('user_id', profileId)
        .gte('last_seen_at', new Date(Date.now() - 60000).toISOString())
        .limit(50)

      if (data) {
        const presenceMap = new Map<string, PulsePresence>()
        const nowTyping: string[] = []
        const now = new Date()

        data.forEach((p) => {
          presenceMap.set(p.user_id, p as PulsePresence)
          const typingUntil = p.typing_until ? new Date(p.typing_until) : null
          if (typingUntil && typingUntil > now) {
            nowTyping.push(p.user_id)
          }
        })

        setOnlineUsers(presenceMap)
        setTypingUsers(nowTyping)
      }
    }

    loadInitialPresences()

    // Cleanup avec délai pour permettre la navigation rapide sans déconnexion
    return () => {
      // Flush pending updates immédiatement
      if (presenceUpdateDebounceRef.current) {
        clearTimeout(presenceUpdateDebounceRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current)
      }

      // Cleanup différé du channel pour éviter reconnexions pendant navigation rapide
      const channelToRemove = channelRef.current
      setTimeout(() => {
        if (channelToRemove) {
          supabase.removeChannel(channelToRemove)
        }
        // NE PAS appeler updatePresence('offline') ici - cause du flooding de requêtes
        // L'absence de heartbeat suffira à marquer l'utilisateur comme inactif
      }, 500)

      // Annuler le cleanup différé si le composant remonte
      // Note: React ne supporte pas les cleanup imbriqués, donc on utilise un ref
      channelRef.current = null
      return
    }
  }, [conversationId, profileId, updatePresence, schedulePresenceUpdate])

  // Marquer comme away quand la fenêtre perd le focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away')
      } else {
        updatePresence('active')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [updatePresence])

  // Mémoriser le tableau des online users pour éviter les recréations
  const onlineUsersArray = useMemo(() => Array.from(onlineUsers.values()), [onlineUsers])

  return {
    onlineUsers: onlineUsersArray,
    typingUsers,
    setTyping,
    updatePresence,
  }
}

// NOTE: Le hook usePulseUnreadCount a été déplacé vers src/hooks/usePulseUnreadCount.ts
// pour une version optimisée avec batching. Utilisez cette version optimisée à la place.
