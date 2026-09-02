import { supabase } from '@/integrations/supabase/client';

export interface RecentSyncLog {
  id: string;
  status: string | null;
  execution_start: string | null;
  execution_end: string | null;
  emails_fetched: number | null;
}

export async function fetchRecentEmailSyncLog(): Promise<RecentSyncLog | null> {
  const { data, error } = await supabase
    .from('email_sync_logs')
    .select('id, status, execution_start, execution_end, emails_fetched')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as RecentSyncLog;
}
