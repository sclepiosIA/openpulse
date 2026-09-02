/**
 * safeRealtimeChannel — wrapper résilient autour de `supabase.channel(...)`.
 *
 * Objectif : ne JAMAIS laisser une exception Realtime (subscribe, addBinding,
 * removeChannel, status CHANNEL_ERROR/TIMED_OUT) faire tomber l'UI.
 * Toutes les erreurs sont :
 *   - loguées en console via `debug.error` (dev),
 *   - reportées en base via `frontendErrorCapture.reportRealtimeError`
 *     (error_type='realtime', metadata { phase, channel, status }).
 *
 * Root cause historique (audit run-1782663570) :
 *   "cannot add postgres_changes callbacks for realtime:<name> after subscribe()"
 *   provoqué par la réutilisation d'un nom de channel déjà souscrit en
 *   StrictMode / remount. Le helper auto-suffixe les noms de channel pour
 *   éviter la collision.
 *
 * Usage :
 *   useEffect(() => {
 *     const ch = safeRealtimeChannel('support-tickets-badge', (channel) =>
 *       channel
 *         .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, cb)
 *         .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, cb2),
 *     );
 *     return () => ch.dispose();
 *   }, []);
 */
import { supabase } from '@/integrations/supabase/client';
import { frontendErrorCapture } from './frontendErrorCapture';
import { debug } from './debug';

type RealtimeChannel = ReturnType<typeof supabase.channel>;

export interface SafeChannelHandle {
  /** Vrai nom utilisé côté Supabase (avec suffixe unique). */
  channelName: string;
  /** Channel brut — null si la création a échoué. */
  channel: RealtimeChannel | null;
  /** Cleanup idempotent à appeler dans le `useEffect` cleanup. */
  dispose: () => void;
}

let counter = 0;
function uniqueSuffix(): string {
  counter = (counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function safeRealtimeChannel(
  baseName: string,
  build: (channel: RealtimeChannel) => RealtimeChannel,
  options?: { onStatusError?: (status: string) => void },
): SafeChannelHandle {
  const channelName = `${baseName}-${uniqueSuffix()}`;
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  try {
    const raw = supabase.channel(channelName);
    const configured = build(raw);
    channel = configured;
    try {
      configured.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Ces statuts sont retentés automatiquement par supabase-js et gérés
          // en mode dégradé côté hooks (badge → 0). On log en debug uniquement
          // pour éviter de polluer `frontend_error_logs` (audit 2026-07-02).
          if (!disposed && status !== 'CLOSED') {
            debug.warn('[realtimeMonitor] status', channelName, status);
            options?.onStatusError?.(status);
          }
        }
      });
    } catch (err) {
      debug.error('[realtimeMonitor] subscribe failed', channelName, err);
      frontendErrorCapture.reportRealtimeError('subscribe', channelName, err);
    }
  } catch (err) {
    debug.error('[realtimeMonitor] channel build failed', channelName, err);
    frontendErrorCapture.reportRealtimeError('bind', channelName, err);
  }

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (!channel) return;
    try {
      supabase.removeChannel(channel);
    } catch (err) {
      debug.error('[realtimeMonitor] removeChannel failed', channelName, err);
      frontendErrorCapture.reportRealtimeError('remove', channelName, err);
    }
  };

  return { channelName, channel, dispose };
}
