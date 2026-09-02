/**
 * useCalls — accès au journal d'appels (CRUD + history).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseBrowser';
import type { Call } from '@/types/calls';

interface UseCallsOptions {
  etablissementId?: string;
  prospectId?: string;
  contactId?: string;
  userId?: string;
  limit?: number;
}

export function useCalls(opts: UseCallsOptions = {}) {
  return useQuery({
    queryKey: ['calls', opts],
    queryFn: async (): Promise<Call[]> => {
      let q = supabase.from('calls').select('*').order('started_at', { ascending: false });
      if (opts.etablissementId) q = q.eq('etablissement_id', opts.etablissementId);
      if (opts.prospectId) q = q.eq('prospect_id', opts.prospectId);
      if (opts.contactId) q = q.eq('contact_id', opts.contactId);
      if (opts.userId) q = q.eq('user_id', opts.userId);
      q = q.limit(opts.limit ?? 100);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Call[];
    },
    staleTime: 60_000,
  });
}

export async function getRecordingSignedUrl(path: string, expiresIn = 300): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.warn('[getRecordingSignedUrl]', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function logCallAction(payload: {
  action: 'start' | 'answer' | 'end' | 'fail';
  call_id?: string;
  [k: string]: unknown;
}): Promise<{ call_id?: string }> {
  const { data, error } = await supabase.functions.invoke('call-log', { body: payload });
  if (error) throw error;
  return data || {};
}

export async function uploadCallRecording(callId: string, blob: Blob): Promise<string | null> {
  const form = new FormData();
  form.append('call_id', callId);
  const ext = blob.type.includes('webm') ? 'webm' : 'wav';
  form.append('file', new File([blob], `${callId}.${ext}`, { type: blob.type }));

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const url = `${SUPABASE_URL}/functions/v1/call-recording-upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    console.warn('[uploadCallRecording] failed', await res.text());
    return null;
  }
  const json = await res.json();
  return json.path ?? null;
}

export async function deleteOwnRecordings(): Promise<number> {
  const { data: calls } = await supabase
    .from('calls')
    .select('id, recording_path')
    .not('recording_path', 'is', null);

  let count = 0;
  for (const c of calls ?? []) {
    if (!c.recording_path) continue;
    await supabase.storage.from('call-recordings').remove([c.recording_path]);
    await supabase.from('calls').update({ recording_path: null, recording_purged_at: new Date().toISOString() }).eq('id', c.id);
    count++;
  }
  return count;
}
