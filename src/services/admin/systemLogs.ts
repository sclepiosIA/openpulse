import { supabase } from '@/integrations/supabase/client';

/**
 * Services logs système — extraction pour découplage Supabase (audit Fable 5 · action 180.1).
 */

export interface AiProcessingErrorLog {
  id: string;
  processed_at: string;
  processing_type: string | null;
  error_message: string | null;
  processing_duration_ms: number | null;
  model_used: string | null;
  success: boolean | null;
  processed_by: string | null;
  context_type: string | null;
}

export const fetchAiProcessingErrors = async (sinceDate: string): Promise<AiProcessingErrorLog[]> => {
  const { data, error } = await supabase
    .from('ai_processing_log')
    .select(
      'id, processed_at, processing_type, error_message, processing_duration_ms, model_used, success, processed_by, context_type',
    )
    .eq('success', false)
    .gte('processed_at', sinceDate)
    .order('processed_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as AiProcessingErrorLog[];
};

export interface EmailSyncErrorLog {
  id: string;
  execution_start: string | null;
  execution_end: string | null;
  error_details: unknown;
  status: string | null;
  emails_fetched: number | null;
}

export const fetchEmailSyncErrors = async (sinceDate: string): Promise<EmailSyncErrorLog[]> => {
  const { data, error } = await supabase
    .from('email_sync_logs')
    .select('id, execution_start, execution_end, error_details, status, emails_fetched')
    .eq('status', 'error')
    .gte('execution_start', sinceDate)
    .order('execution_start', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as EmailSyncErrorLog[];
};
