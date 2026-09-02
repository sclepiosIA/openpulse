import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useVisibilityAwareInterval } from '@/hooks/ui/useVisibilityAwareInterval';
import type { PresenceStatus } from '@/types/pulse';
import { debug } from '@/lib/debug';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

interface UseCalendarPresenceOptions {
  enabled?: boolean;
  onStatusChange?: (
    status: PresenceStatus, 
    isAutomatic: boolean, 
    event?: CalendarEvent | null
  ) => void;
}

/**
 * Hook pour détecter automatiquement les réunions en cours
 * et mettre à jour le statut de présence
 */
export function useCalendarPresence({
  enabled = true,
  onStatusChange,
}: UseCalendarPresenceOptions = {}) {
  const { data: profile } = useCurrentProfile();
  const previousEventIdRef = useRef<string | null>(null);
  const latestProfileIdRef = useRef(profile?.id);

  // La ref est partagée par les callbacks async de tous les renders. Une réponse
  // lancée pour l'ancien profil est ainsi ignorée dès que le profil courant change.
  if (latestProfileIdRef.current !== profile?.id) {
    latestProfileIdRef.current = profile?.id;
    previousEventIdRef.current = null;
  }

  const checkCurrentMeeting = useCallback(async () => {
    const checkedProfileId = profile?.id;
    if (!checkedProfileId || !enabled) return;

    try {
      const now = new Date().toISOString();
      
      // Chercher un événement en cours pour l'utilisateur
      const { data: events, error } = await supabase
        .from('calendar_events')
        .select(`
          id,
          title,
          start_time,
          end_time,
          calendar_id,
          calendars!inner(owner_id)
        `)
        .eq('calendars.owner_id', checkedProfileId)
        .lte('start_time', now)
        .gte('end_time', now)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true })
        .limit(1);

      if (latestProfileIdRef.current !== checkedProfileId) return;

      if (error) {
        debug.error('Error checking calendar events:', error);
        return;
      }

      const currentEvent = events?.[0] as CalendarEvent | undefined;
      const currentEventId = currentEvent?.id || null;

      // Si l'événement a changé
      if (currentEventId !== previousEventIdRef.current) {
        previousEventIdRef.current = currentEventId;

        if (currentEvent) {
          // On est en réunion
          onStatusChange?.('in_meeting', true, {
            id: currentEvent.id,
            title: currentEvent.title,
            start_time: currentEvent.start_time,
            end_time: currentEvent.end_time,
          });
        } else {
          // Plus de réunion, retour au statut normal
          onStatusChange?.('active', false, null);
        }
      }
    } catch (error) {
      debug.error('Error in checkCurrentMeeting:', error);
    }
  }, [profile?.id, enabled, onStatusChange]);

  // Use visibility-aware interval - pauses when tab is hidden
  // Increased to 60s to reduce polling overhead
  useVisibilityAwareInterval(checkCurrentMeeting, 60000, {
    runImmediately: true,
    enabled: enabled && !!profile?.id,
  });

  return {
    checkNow: checkCurrentMeeting,
  };
}
