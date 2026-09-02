import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'

export interface CollabPeer {
  id: string
  name: string
  color: string
  /** Position du curseur dans le repère de la scène (facultatif). */
  x?: number
  y?: number
  editing?: boolean
  updatedAt?: number
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6']

function colorFor(id: string) {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return COLORS[sum % COLORS.length]
}

type SceneElement = { id?: string; version?: number; isDeleted?: boolean } & Record<string, unknown>

/**
 * Fusionne des éléments distants dans la scène locale par identifiant :
 * l'élément conservé est celui dont la `version` Excalidraw est la plus élevée.
 * Évite l'écrasement complet de la scène locale (« dernier écrivain gagne »).
 */
export function mergeElements(local: SceneElement[], remote: SceneElement[]): SceneElement[] {
  const byId = new Map<string, SceneElement>()
  local.forEach((el) => {
    if (el?.id) byId.set(el.id, el)
  })
  remote.forEach((el) => {
    if (!el?.id) return
    const existing = byId.get(el.id)
    if (!existing || (el.version ?? 0) >= (existing.version ?? 0)) byId.set(el.id, el)
  })
  return Array.from(byId.values()).filter((el) => !el.isDeleted)
}

/** Éléments dont la version a changé depuis le dernier envoi. */
export function diffElements(
  previous: Map<string, number>,
  current: readonly SceneElement[]
): SceneElement[] {
  const changed: SceneElement[] = []
  current.forEach((el) => {
    if (!el?.id) return
    const prev = previous.get(el.id)
    if (prev === undefined || prev !== (el.version ?? 0)) changed.push(el)
  })
  return changed
}

/**
 * Collaboration temps réel sur un tableau partagé :
 * - présence (qui est sur le tableau) et curseurs distants,
 * - diffusion incrémentale des seuls éléments modifiés,
 * - fusion par identifiant/version (aucune perte du travail concurrent),
 * - resynchronisation depuis la base à la reconnexion.
 */
export function useWhiteboardCollab(
  whiteboardId: string | null,
  enabled: boolean,
  onRemoteElements: (elements: unknown[]) => void,
  onResync?: () => void
) {
  const { user } = useAuth()
  const [peers, setPeers] = useState<CollabPeer[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const sentVersionsRef = useRef<Map<string, number>>(new Map())
  const onRemoteRef = useRef(onRemoteElements)
  const onResyncRef = useRef(onResync)
  const hasConnectedRef = useRef(false)
  onRemoteRef.current = onRemoteElements
  onResyncRef.current = onResync

  useEffect(() => {
    sentVersionsRef.current = new Map()
    hasConnectedRef.current = false
  }, [whiteboardId])

  useEffect(() => {
    if (!enabled || !whiteboardId || !user?.id) {
      setPeers([])
      return
    }
    const meta: CollabPeer = {
      id: user.id,
      name:
        (user.user_metadata as Record<string, string> | undefined)?.full_name ||
        user.email?.split('@')[0] ||
        'Utilisateur',
      color: colorFor(user.id),
    }

    const channel = supabase.channel(`whiteboard:${whiteboardId}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, CollabPeer[]>
        const list = Object.values(state)
          .map((entries) => entries[0])
          .filter((p): p is CollabPeer => !!p && p.id !== user.id)
        setPeers(list)
      })
      .on('broadcast', { event: 'elements' }, ({ payload }) => {
        if (!payload || payload.from === user.id) return
        if (Array.isArray(payload.elements) && payload.elements.length) {
          onRemoteRef.current(payload.elements)
        }
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (!payload || payload.from === user.id) return
        setPeers((prev) =>
          prev.map((p) =>
            p.id === payload.from
              ? {
                  ...p,
                  x: payload.x,
                  y: payload.y,
                  editing: payload.editing,
                  updatedAt: Date.now(),
                }
              : p
          )
        )
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track(meta)
          // Reconnexion : la scène locale peut avoir divergé, on resynchronise.
          if (hasConnectedRef.current) onResyncRef.current?.()
          hasConnectedRef.current = true
          sentVersionsRef.current = new Map()
        }
      })

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
      setPeers([])
    }
  }, [whiteboardId, enabled, user?.id, user?.email, user?.user_metadata])

  /** Diffuse uniquement les éléments modifiés depuis le dernier envoi. */
  const broadcastScene = useCallback(
    (elements: readonly unknown[]) => {
      const channel = channelRef.current
      if (!channel || !user?.id) return
      const list = elements as readonly SceneElement[]
      const changed = diffElements(sentVersionsRef.current, list)
      const next = new Map<string, number>()
      list.forEach((el) => {
        if (el?.id) next.set(el.id, el.version ?? 0)
      })
      // Éléments supprimés localement : on les signale comme supprimés.
      sentVersionsRef.current.forEach((_v, id) => {
        if (!next.has(id)) changed.push({ id, isDeleted: true } as SceneElement)
      })
      sentVersionsRef.current = next
      if (!changed.length) return
      channel.send({
        type: 'broadcast',
        event: 'elements',
        payload: { from: user.id, elements: changed },
      })
    },
    [user?.id]
  )

  const broadcastCursor = useCallback(
    (x: number, y: number, editing = false) => {
      const channel = channelRef.current
      if (!channel || !user?.id) return
      channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { from: user.id, x, y, editing },
      })
    },
    [user?.id]
  )

  return { peers, broadcastScene, broadcastCursor }
}
