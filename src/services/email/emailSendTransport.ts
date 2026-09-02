import { supabase } from '@/integrations/supabase/client';

/** Upload d'un blob dans le bucket `email-transfers`. */
export async function uploadEmailTransferFile(
  path: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from('email-transfers')
    .upload(path, file, { contentType, upsert: false });
  if (error) throw error;
}

export type SendEmailPayload = {
  account_id: string;
  user_id?: string | null;
  to: string;
  cc?: string;
  subject: string;
  html_body: string;
};

export type SendEmailResult = {
  smtp_sent?: boolean;
  db_stored?: boolean;
  [k: string]: unknown;
};

export async function invokeSendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke('send-email', { body: payload });
  if (error && !(data as SendEmailResult | undefined)?.smtp_sent) throw error;
  return (data ?? {}) as SendEmailResult;
}
