import { supabase } from '@/integrations/supabase/client';

export type EmailTransferRow = {
  id: string;
  token: string;
  subject: string | null;
  expires_at: string | null;
  file_count: number | null;
  total_size_bytes: number | null;
  download_count: number | null;
  purged_at: string | null;
  created_at: string;
};

const COLS =
  'id,token,subject,expires_at,file_count,total_size_bytes,download_count,purged_at,created_at';

export async function fetchMyEmailTransfers(opts?: { limit?: number }): Promise<EmailTransferRow[]> {
  const { data, error } = await supabase
    .from('email_transfers')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50);
  if (error) throw error;
  return (data ?? []) as EmailTransferRow[];
}

export async function deleteEmailTransfer(id: string): Promise<void> {
  const { error } = await supabase.from('email_transfers').delete().eq('id', id);
  if (error) throw error;
}
