/**
 * jarvisSmartTriggersChannel — Singleton refcount pour le canal Realtime des SmartTriggers Jarvis.
 *
 * Plusieurs composants (sidebar, nudge proactif…) souhaitent réagir aux mêmes événements
 * Postgres. Sans coordination, chaque montage ouvrait un canal portant le même nom
 * (`jarvis-smart-all-${userId}`), ce que Supabase Realtime rejette en boucle (`CLOSED`),
 * provoquant des centaines de logs d'erreurs et des reconnexions inutiles.
 *
 * Ce module garantit qu'**un seul** canal est ouvert par utilisateur, partagé entre tous
 * les abonnés via un compteur de références. Lorsque le dernier abonné se désinscrit, le
 * canal est fermé proprement.
 */
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type SmartTriggerEvent = 'INSERT' | 'UPDATE' | 'DELETE';
export type SmartTriggerPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;
export type SmartTriggerStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

export interface SmartTriggerSubscriber {
  onPayload: (table: string, eventType: SmartTriggerEvent, payload: SmartTriggerPayload) => void;
  onStatus?: (status: SmartTriggerStatus) => void;
}


interface ChannelState {
  channel: RealtimeChannel;
  subscribers: Set<SmartTriggerSubscriber>;
  status: 'idle' | 'subscribing' | 'subscribed' | 'closed';
  retryCount: number;
  retryTimeout: ReturnType<typeof setTimeout> | null;
  visibilityHandler: (() => void) | null;
}

const MAX_RETRIES = 5;
const channels = new Map<string, ChannelState>();

function notifyStatus(state: ChannelState, status: SmartTriggerStatus) {
  state.subscribers.forEach((sub) => {
    try {
      sub.onStatus?.(status);
    } catch (e) {
      debug.warn('[SmartTriggers] subscriber onStatus threw', e);
    }
  });
}

function teardownChannel(key: string, state: ChannelState) {
  if (state.retryTimeout) {
    clearTimeout(state.retryTimeout);
    state.retryTimeout = null;
  }
  if (state.visibilityHandler) {
    document.removeEventListener('visibilitychange', state.visibilityHandler);
    state.visibilityHandler = null;
  }
  try {
    supabase.removeChannel(state.channel);
  } catch {
    /* noop */
  }
  channels.delete(key);
}

function buildChannel(
  key: string,
  userId: string,
  tables: readonly string[],
  isStreamingRef: { current: boolean },
): ChannelState {
  const channel = supabase.channel(key);

  const state: ChannelState = {
    channel,
    subscribers: new Set(),
    status: 'subscribing',
    retryCount: 0,
    retryTimeout: null,
    visibilityHandler: null,
  };

  for (const tableName of tables) {
    (channel as unknown as {
      on: (
        event: 'postgres_changes',
        filter: { event: string; schema: string; table: string },
        cb: (payload: SmartTriggerPayload) => void,
      ) => RealtimeChannel;
    }).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {

        if (document.visibilityState !== 'visible') return;
        const evt = payload.eventType;
        if (evt !== 'INSERT' && evt !== 'UPDATE' && evt !== 'DELETE') return;
        state.subscribers.forEach((sub) => {
          try {
            sub.onPayload(tableName, evt, payload);
          } catch (e) {
            debug.warn('[SmartTriggers] subscriber payload handler threw', e);
          }
        });
      },
    );
  }

  const subscribe = () => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        state.status = 'subscribed';
        state.retryCount = 0;
        if (import.meta.env.DEV) {
          debug.log(`[SmartTriggers] Connected, listening to ${tables.length} tables`);
        }
        notifyStatus(state, 'SUBSCRIBED');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        state.status = 'closed';
        notifyStatus(state, status as SmartTriggerStatus);

        // No subscribers left — let teardown handle it.
        if (state.subscribers.size === 0) return;
        // Suspend retries while Jarvis is actively streaming.
        if (isStreamingRef.current) return;
        // Don't retry if tab is hidden — wait for visibility change.
        if (document.visibilityState !== 'visible') return;

        if (state.retryCount < MAX_RETRIES) {
          state.retryCount++;
          const delay = Math.min(5000 * Math.pow(2, state.retryCount - 1), 30000);
          state.retryTimeout = setTimeout(() => {
            // Recreate channel from scratch
            const existing = channels.get(key);
            if (!existing || existing !== state || existing.subscribers.size === 0) return;
            try {
              supabase.removeChannel(state.channel);
            } catch {
              /* noop */
            }
            channels.delete(key);
            const fresh = buildChannel(key, userId, tables, isStreamingRef);
            // Migrate subscribers
            state.subscribers.forEach((s) => fresh.subscribers.add(s));
          }, delay);
        } else if (import.meta.env.DEV) {
          debug.log(`[SmartTriggers] ${status} — max retries reached, will reconnect on tab focus`);
        }
      }
    });
  };

  state.visibilityHandler = () => {
    if (document.visibilityState === 'visible' && state.status === 'closed' && state.retryCount >= MAX_RETRIES) {
      state.retryCount = 0;
      // Rebuild on focus
      const existing = channels.get(key);
      if (!existing || existing !== state || existing.subscribers.size === 0) return;
      try {
        supabase.removeChannel(state.channel);
      } catch {
        /* noop */
      }
      channels.delete(key);
      const fresh = buildChannel(key, userId, tables, isStreamingRef);
      state.subscribers.forEach((s) => fresh.subscribers.add(s));
    }
  };
  document.addEventListener('visibilitychange', state.visibilityHandler);

  channels.set(key, state);
  subscribe();
  return state;
}

/**
 * Subscribe to the shared SmartTriggers channel.
 * Returns an unsubscribe function. The underlying Realtime channel is reference-counted:
 * it is opened on first subscriber and closed when the last subscriber leaves.
 */
export function subscribeSmartTriggers(
  userId: string,
  tables: readonly string[],
  subscriber: SmartTriggerSubscriber,
  isStreamingRef: { current: boolean },
): () => void {
  const key = `jarvis-smart-all-${userId}`;
  let state = channels.get(key);
  if (!state) {
    state = buildChannel(key, userId, tables, isStreamingRef);
  }
  state.subscribers.add(subscriber);

  // If channel is already subscribed, notify immediately so consumers can flip isListening.
  if (state.status === 'subscribed') {
    try {
      subscriber.onStatus?.('SUBSCRIBED');
    } catch {
      /* noop */
    }
  }

  return () => {
    const current = channels.get(key);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      teardownChannel(key, current);
    }
  };
}
