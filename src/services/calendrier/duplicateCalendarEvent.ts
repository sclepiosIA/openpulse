import { supabase } from '@/integrations/supabase/client';

export interface DuplicateEventParams {
  sourceId: string;
  selectedDates: Date[];
  originalStart: Date;
  durationMs: number;
  createdBy?: string;
}

/**
 * Duplique un événement calendrier vers une liste de dates, en conservant heure et durée.
 * Retourne le nombre de copies créées.
 */
export async function duplicateCalendarEvent({
  sourceId,
  selectedDates,
  originalStart,
  durationMs,
  createdBy,
}: DuplicateEventParams): Promise<number> {
  const { data: original, error: fetchError } = await supabase
    .from('calendar_events')
    .select('calendar_id, title, description, location, video_conference_url, all_day, status, visibility, etablissement_id, tache_id, color, display_as_banner, availability')
    .eq('id', sourceId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!original) throw new Error('Événement introuvable');

  const inserts = selectedDates.map((date) => {
    const newStart = new Date(date);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    return {
      calendar_id: original.calendar_id,
      title: original.title,
      description: original.description,
      location: original.location,
      video_conference_url: original.video_conference_url,
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      all_day: original.all_day,
      status: original.status,
      visibility: original.visibility,
      etablissement_id: original.etablissement_id,
      tache_id: original.tache_id,
      color: original.color,
      display_as_banner: (original as any).display_as_banner ?? false,
      availability: (original as any).availability ?? 'busy',
      created_by: createdBy,
    };
  });

  const { error: insertError } = await supabase
    .from('calendar_events')
    .insert(inserts);
  if (insertError) throw insertError;

  return inserts.length;
}
