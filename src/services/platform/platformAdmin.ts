import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabaseBrowser';

/**
 * Service Platform Admin (audit Fable 5 · action 180.1).
 * Encapsule tous les appels à l'edge function `platform-admin` (GET + POST).
 */
export type PlatformAdminAction =
  | { method: 'GET'; action: string; params?: Record<string, string> }
  | { method: 'POST'; body: Record<string, unknown> };

export async function callPlatformAdmin<T = unknown>(a: PlatformAdminAction): Promise<T> {
  if (a.method === 'GET') {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.access_token) {
      throw new Error('Session expirée. Reconnectez-vous puis réessayez.');
    }
    const url = new URL(`${SUPABASE_URL}/functions/v1/platform-admin`);
    url.searchParams.set('action', a.action);
    Object.entries(a.params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
    });
    const text = await r.text();
    const json = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error(json?.error ?? r.statusText ?? 'Erreur Platform API');
    return json as T;
  }

  const { data, error } = await supabase.functions.invoke('platform-admin', {
    method: a.method,
    body: a.method === 'POST' ? a.body : undefined,
  } as never);
  if (error) throw error;
  return data as T;
}
