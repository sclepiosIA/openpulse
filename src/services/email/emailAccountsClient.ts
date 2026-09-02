import { supabase } from '@/integrations/supabase/client';

export type EmailAccountRow = {
  id: string;
  email_address: string;
  display_name?: string | null;
  is_active?: boolean | null;
  sync_enabled?: boolean | null;
  is_shared?: boolean | null;
  last_sync_at?: string | null;
  imap_host?: string | null;
  imap_port?: number | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  profile_id?: string | null;
};

const FULL_COLS =
  'id, email_address, display_name, is_active, sync_enabled, is_shared, last_sync_at, imap_host, imap_port, smtp_host, smtp_port, created_at, updated_at';

export async function fetchEmailAccountsForProfile(profileId: string, opts?: { columns?: string }): Promise<EmailAccountRow[]> {
  const cols = opts?.columns ?? FULL_COLS;
  const { data } = await supabase
    .from('user_email_accounts_safe' as 'user_email_accounts')
    .select(cols)
    .eq('is_active', true)
    .or(`profile_id.eq.${profileId},is_shared.eq.true`)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as EmailAccountRow[];
}

export async function fetchEmailThreadFlags(threadId: string): Promise<{ is_archived: boolean; is_spam: boolean } | null> {
  const { data } = await supabase
    .from('email_threads')
    .select('is_archived, is_spam')
    .eq('id', threadId)
    .maybeSingle();
  if (!data) return null;
  return { is_archived: data.is_archived ?? false, is_spam: data.is_spam ?? false };
}
