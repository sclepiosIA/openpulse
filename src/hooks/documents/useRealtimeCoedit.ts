import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/shared/useAuth'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'

/**
 * Hook générique de co-édition temps réel par broadcast de snapshots.
 *
 * Pattern : chaque client émet son état sérialisé (débouncé) sur un canal Supabase Realtime
 * dédié au document. Les autres clients appliquent le snapshot reçu à leur state local.
 * Présence : liste des utilisateurs connectés (avatars) + curseur / sélection.
 *
 * Utilisé pour le tableur et la présentation (le texte utilise Yjs CRDT via SupabaseProvider).
 */

export interface CoeditUser {
  user_id: string
  user_name: string
  user_avatar?: string | null
  user_color: string
  cursor?: unknown
}

const COLLAB_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

interface UseRealtimeCoeditOptions<T> {
  documentId: string | undefined
  enabled: boolean
  /** Snapshot courant à diffuser aux autres clients. */
  snapshot: T
  /** Callback appelé quand un snapshot distant arrive. Mettre à jour l'état local ici. */
  onRemoteSnapshot: (snapshot: T) => void
  /** Debounce des broadcasts locaux (ms). Défaut 350. */
  debounceMs?: number
  /** Identifiant de la surface (« sheet », « slides »…) — permet de séparer les canaux si besoin. */
  channelKind: string
}

export interface UseRealtimeCoeditReturn {
  connectedUsers: CoeditUser[]
  isConnected: boolean
  isSynced: boolean
  /** Diffuse une info de curseur / sélection (léger, sans debounce). */
  broadcastCursor: (cursor: unknown) => void
}

export function useRealtimeCoedit<T>({
  documentId,
  enabled,
  snapshot,
  onRemoteSnapshot,
  debounceMs = 350,
  channelKind,
}: UseRealtimeCoeditOptions<T>): UseRealtimeCoeditReturn {
  const { user } = useAuth()
  const { data: profile } = useCurrentProfile()

  const [connectedUsers, setConnectedUsers] = useState<CoeditUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressBroadcastRef = useRef(false)
  const latestSnapshotRef = useRef<T>(snapshot)
  const onRemoteRef = useRef(onRemoteSnapshot)
  const revisionRef = useRef(0)
  const lastAppliedRevisionRef = useRef(-1)

  useEffect(() => {
    latestSnapshotRef.current = snapshot
  }, [snapshot])
  useEffect(() => {
    onRemoteRef.current = onRemoteSnapshot
  }, [onRemoteSnapshot])

  const me = useMemo<CoeditUser | null>(() => {
    if (!user?.id) return null
    return {
      user_id: user.id,
      user_name:
        profile?.prenom && profile?.nom
          ? `${profile.prenom} ${profile.nom}`
          : user.email || 'Anonyme',
      user_avatar: profile?.avatar_url,
      user_color: COLLAB_COLORS[Math.abs(hashCode(user.id)) % COLLAB_COLORS.length],
    }
  }, [user?.id, user?.email, profile?.prenom, profile?.nom, profile?.avatar_url])

  // Setup channel
  useEffect(() => {
    if (!enabled || !documentId || !me) {
      setIsConnected(false)
      setIsSynced(false)
      setConnectedUsers([])
      return
    }

    const channelName = `coedit-${channelKind}-${documentId}`
    let cancelled = false

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: me.user_id },
      },
    })

    const refreshPresence = () => {
      const state = channel.presenceState() as Record<string, Array<CoeditUser>>
      const users: CoeditUser[] = []
      for (const key of Object.keys(state)) {
        for (const p of state[key]) {
          if (p.user_id && p.user_id !== me.user_id) users.push(p)
        }
      }
      setConnectedUsers(users)
    }

    channel
      .on('broadcast', { event: 'snapshot' }, ({ payload }) => {
        if (!payload || payload.sender === me.user_id) return
        const rev = typeof payload.revision === 'number' ? payload.revision : Date.now()
        if (rev <= lastAppliedRevisionRef.current) return
        lastAppliedRevisionRef.current = rev
        suppressBroadcastRef.current = true
        try {
          onRemoteRef.current(payload.data as T)
        } finally {
          // Libère au prochain tick pour laisser React commit
          setTimeout(() => {
            suppressBroadcastRef.current = false
          }, 0)
        }
      })
      .on('broadcast', { event: 'sync-request' }, ({ payload }) => {
        if (!payload || payload.sender === me.user_id) return
        // Un nouveau client demande la version courante → on renvoie notre snapshot
        channel.send({
          type: 'broadcast',
          event: 'snapshot',
          payload: {
            sender: me.user_id,
            revision: ++revisionRef.current,
            data: latestSnapshotRef.current,
          },
        })
      })
      .on('presence', { event: 'sync' }, refreshPresence)
      .on('presence', { event: 'join' }, refreshPresence)
      .on('presence', { event: 'leave' }, refreshPresence)
      .subscribe(async (status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          await channel.track({ ...me, cursor: null })
          // Demande le snapshot des pairs déjà présents
          channel.send({
            type: 'broadcast',
            event: 'sync-request',
            payload: { sender: me.user_id },
          })
          // Si personne ne répond dans 1.5 s, on se considère synchronisé (premier client)
          setTimeout(() => {
            if (!cancelled) setIsSynced(true)
          }, 1500)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false)
        }
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
      setIsSynced(false)
      setConnectedUsers([])
    }
  }, [documentId, enabled, me, channelKind])

  // Broadcast local changes (debounced), skip if the change came from a remote snapshot
  // Ne diffuse pas tant que la première synchro n'est pas terminée, pour éviter d'écraser
  // l'état d'un pair qui répond à notre sync-request.
  useEffect(() => {
    if (!enabled || !channelRef.current || !me) return
    if (!isSynced) return
    if (suppressBroadcastRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const ch = channelRef.current
      if (!ch) return
      revisionRef.current += 1
      lastAppliedRevisionRef.current = revisionRef.current
      ch.send({
        type: 'broadcast',
        event: 'snapshot',
        payload: {
          sender: me.user_id,
          revision: revisionRef.current,
          data: latestSnapshotRef.current,
        },
      })
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [snapshot, enabled, me, debounceMs, isSynced])

  const broadcastCursor = useCallback(
    (cursor: unknown) => {
      const ch = channelRef.current
      if (!ch || !me) return
      ch.track({ ...me, cursor })
    },
    [me]
  )

  return { connectedUsers, isConnected, isSynced, broadcastCursor }
}
