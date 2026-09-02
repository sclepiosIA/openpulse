import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TranscriptionSession, TranscriptionDecision, TranscriptionNextStep } from '@/types/transcription';
import { isOccurrenceId, parseOccurrenceId } from '@/lib/recurrenceUtils';
import { debug } from '@/lib/debug';

interface EventTranscriptionResult {
  transcription: TranscriptionSession | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch transcription session linked to a calendar event
 * Matches by calendar_event_id or external_meeting_url
 */
export function useEventTranscription(
  eventId?: string | null,
  videoConferenceUrl?: string | null
): EventTranscriptionResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-transcription', eventId, videoConferenceUrl],
    queryFn: async (): Promise<TranscriptionSession | null> => {
      if (!eventId && !videoConferenceUrl) return null;

      // Build query conditions
      let query = supabase
        .from('visio_transcription_sessions')
        .select('id, room_code, external_meeting_url, title, started_at, ended_at, created_by, etablissement_id, partenaire_id, groupe_id, status, summary, decisions, next_steps, full_transcript, language, calendar_event_id, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(1);

      // Match by calendar_event_id if provided
      if (eventId) {
        // For recurring event occurrences, extract the parent UUID
        let effectiveEventId = eventId;
        if (isOccurrenceId(eventId)) {
          const parsed = parseOccurrenceId(eventId);
          if (parsed) {
            effectiveEventId = parsed.parentId;
          }
        }
        query = query.eq('calendar_event_id', effectiveEventId);
      } else if (videoConferenceUrl) {
        // Fallback: match by external_meeting_url or room_code in URL
        const roomCodeMatch = videoConferenceUrl.match(/\/visio\/([A-Z0-9]+)/i);
        if (roomCodeMatch) {
          query = query.eq('room_code', roomCodeMatch[1].toUpperCase());
        } else {
          query = query.eq('external_meeting_url', videoConferenceUrl);
        }
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        debug.error('[useEventTranscription] Error:', error);
        throw error;
      }

      if (!data) return null;

      // Map database response to TranscriptionSession type
      return {
        id: data.id,
        room_code: data.room_code ?? undefined,
        external_meeting_url: data.external_meeting_url ?? undefined,
        title: data.title || 'Session de transcription',
        started_at: data.started_at ?? new Date().toISOString(),
        ended_at: data.ended_at ?? undefined,
        created_by: data.created_by || '',
        etablissement_id: data.etablissement_id ?? undefined,
        partenaire_id: data.partenaire_id ?? undefined,
        groupe_id: data.groupe_id ?? undefined,
        status: data.status as 'active' | 'ended' | 'processing' | 'archived',
        summary: data.summary ?? undefined,
        decisions: ((data.decisions as TranscriptionDecision[] | null) || []),
        next_steps: ((data.next_steps as TranscriptionNextStep[] | null) || []),
        full_transcript: data.full_transcript ?? undefined,
        language: data.language || 'fr-FR',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      };
    },
    enabled: !!(eventId || videoConferenceUrl),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    transcription: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}
