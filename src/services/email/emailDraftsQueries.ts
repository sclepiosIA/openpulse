import { supabase } from '@/integrations/supabase/client';

export async function fetchAllEmailDrafts(): Promise<any[]> {
  const { data, error } = await supabase
    .from('email_drafts')
    .select('*, account:user_email_accounts(email_address)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as any[];
}
