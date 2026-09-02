import { supabase } from '@/integrations/supabase/client';

export type EmailDraftUpsertPayload = {
  id?: string;
  account_id: string;
  to?: string | null;
  cc?: string | null;
  subject: string | null;
  body: string | null;
  user_id: string;
};

export async function upsertEmailDraft(payload: EmailDraftUpsertPayload): Promise<void> {
  const { error } = await supabase.from('email_drafts').upsert(payload as never);
  if (error) throw error;
}

export async function deleteEmailDraft(id: string): Promise<void> {
  await supabase.from('email_drafts').delete().eq('id', id);
}

