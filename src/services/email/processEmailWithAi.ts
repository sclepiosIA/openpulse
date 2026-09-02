import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — encapsule l'invocation de
 * l'edge function `process-email-with-ai` (utilisée par EmailTaskScanButton
 * et autres scans batch).
 */

export interface ProcessEmailWithAiResult {
  tasks_created?: number;
  tasks_updated?: number;
  contacts_created?: number;
  [key: string]: unknown;
}

export async function processEmailWithAi(params: {
  threadId: string;
  forceReprocess?: boolean;
}): Promise<ProcessEmailWithAiResult> {
  const { data, error } = await supabase.functions.invoke('process-email-with-ai', {
    body: {
      thread_id: params.threadId,
      force_reprocess: params.forceReprocess ?? false,
    },
  });
  if (error) throw error;
  return (data ?? {}) as ProcessEmailWithAiResult;
}

export interface ScannableThread {
  id: string;
  subject: string | null;
  etablissement_id: string | null;
  partenaire_id: string | null;
  last_message_date: string | null;
}

export async function fetchScannableThreads(sinceHours: number): Promise<ScannableThread[]> {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - sinceHours);
  const { data, error } = await supabase
    .from('email_threads')
    .select('id, subject, etablissement_id, partenaire_id, last_message_date')
    .gte('last_message_date', startDate.toISOString())
    .or('etablissement_id.not.is.null,partenaire_id.not.is.null')
    .order('last_message_date', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Erreur de récupération: ${error.message}`);
  return (data ?? []) as ScannableThread[];
}
