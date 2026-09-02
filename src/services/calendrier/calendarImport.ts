import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — extraction des appels Supabase
 * de `CalendarImportDialog` vers la couche services/.
 */

export async function fetchExistingEventKeys(calendarId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('calendar_events')
    .select('title, start_time')
    .eq('calendar_id', calendarId);
  return new Set((data ?? []).map((e) => `${e.title}|${e.start_time}`));
}

export interface ImportIcsResult {
  imported: number;
  skipped?: number;
  [key: string]: unknown;
}

export async function importIcsEvents(params: {
  icsContent: string;
  calendarId: string;
  minDate?: string;
}): Promise<ImportIcsResult> {
  const { data, error } = await supabase.functions.invoke('import-ics-events', {
    body: params,
  });
  if (error) throw error;
  return data as ImportIcsResult;
}

export interface CreateCalendarSubscriptionParams {
  userId: string;
  calendarId: string;
  name: string;
  url: string;
  syncFrequency: 'hourly' | 'daily' | string;
}

export async function createCalendarSubscription(
  params: CreateCalendarSubscriptionParams,
): Promise<void> {
  const { error } = await supabase.from('calendar_subscriptions').insert({
    user_id: params.userId,
    calendar_id: params.calendarId,
    name: params.name,
    url: params.url,
    sync_frequency: params.syncFrequency,
  });
  if (error) throw error;
}

export async function syncCalendarSubscription(params: {
  subscriptionUrl: string;
  calendarId: string;
}): Promise<{ error: unknown | null }> {
  const { error } = await supabase.functions.invoke('sync-calendar-subscription', {
    body: params,
  });
  return { error };
}
