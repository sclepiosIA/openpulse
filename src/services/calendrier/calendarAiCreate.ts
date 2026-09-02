import { supabase } from '@/integrations/supabase/client';

export interface CalendarAiCreatePayload {
  text: string;
  calendars: Array<{ id: string; name: string }>;
}

export interface CalendarAiCreateResponse {
  events?: Array<Record<string, any>>;
  interpretation?: string;
  error?: string;
}

export async function callCalendarAiCreate(
  payload: CalendarAiCreatePayload,
): Promise<CalendarAiCreateResponse> {
  const { data, error } = await supabase.functions.invoke('calendar-ai-create', {
    body: payload,
  });
  if (error) throw error;
  return (data ?? {}) as CalendarAiCreateResponse;
}
