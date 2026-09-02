import { useEffect, useRef } from 'react'
import type {
  RealtimeChannel,
  RealtimeChannelOptions,
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

export interface UseRealtimeChannelConfig {
  /** Nom unique du canal (préfixer par domaine, ex: `emails:threads:${userId}`). */
  channel: string
  /** Options passées à `supabase.channel(name, options)`. */
  channelOptions?: RealtimeChannelOptions
  /** Souscriptions Postgres changes (INSERT/UPDATE/DELETE). */
  postgresChanges?: Array<{
    filter: RealtimePostgresChangesFilter<'*' | 'INSERT' | 'UPDATE' | 'DELETE'>
    handler: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  }>
  /** Souscriptions broadcast custom. */
  broadcast?: Array<{ event: string; handler: (payload: unknown) => void }>
  /** Callback appelé une fois le canal `SUBSCRIBED`. */
  onSubscribed?: (channel: RealtimeChannel) => void
  /** Désactive l'abonnement (par ex. si user non authentifié). */
  enabled?: boolean
}

/**
 * Hook standardisé pour souscrire à un canal Supabase Realtime.
 *
 * Garanties :
 *  - abonnement uniquement dans `useEffect`
 *  - cleanup systématique via `removeChannel`
 *  - pas de fuite entre renders (dépendance stable via `channel` name)
 *
 * Ne pas contourner : tout `supabase.channel()` en dehors de ce hook ou d'un
 * `useEffect` explicite sera flaggé par `scripts/audit-realtime-subscriptions.mjs`.
 */
export function useRealtimeChannel({
  channel,
  channelOptions,
  postgresChanges,
  broadcast,
  onSubscribed,
  enabled = true,
}: UseRealtimeChannelConfig) {
  // Refs pour éviter de re-souscrire quand seuls les handlers changent.
  const postgresRef = useRef(postgresChanges)
  const broadcastRef = useRef(broadcast)
  const onSubscribedRef = useRef(onSubscribed)

  useEffect(() => {
    postgresRef.current = postgresChanges
    broadcastRef.current = broadcast
    onSubscribedRef.current = onSubscribed
  })

  useEffect(() => {
    if (!enabled) return

    let ch: RealtimeChannel | null = supabase.channel(channel, channelOptions)

    for (const sub of postgresRef.current ?? []) {
      // Realtime typings varient selon la version : cast large volontaire.
      ch = (ch as RealtimeChannel).on(
        'postgres_changes' as never,
        sub.filter as never,
        sub.handler as never
      )
    }
    for (const sub of broadcastRef.current ?? []) {
      ch = ch.on('broadcast', { event: sub.event }, ({ payload }) => sub.handler(payload))
    }

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED' && ch && onSubscribedRef.current) {
        onSubscribedRef.current(ch)
      }
    })

    return () => {
      if (ch) {
        void supabase.removeChannel(ch)
        ch = null
      }
    }
    // On ne dépend que du nom du canal et de l'état enabled : les handlers
    // sont lus depuis les refs pour éviter le churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled])
}
