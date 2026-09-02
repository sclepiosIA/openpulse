import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { toast } from 'sonner';

/**
 * Hook for creating calendar events + attendees + reminders.
 * Used by EmailVisioInviteDialog, EventCreatorModal, etc.
 */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  const getOrCreateDefaultCalendar = async (userId: string): Promise<string> => {
    const { data: calendar } = await supabase
      .from('calendars')
      .select('id')
      .eq('owner_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (calendar) return calendar.id;

    const { data: newCalendar, error } = await supabase
      .from('calendars')
      .insert({
        name: 'Mon calendrier',
        owner_id: userId,
        is_default: true,
        color: '#3b82f6',
        type: 'personal'
      })
      .select()
      // safe: guaranteed-row
      .single();

    if (error) throw error;
    return newCalendar.id;
  };

  const createEvent = async (params: {
    calendarId: string;
    title: string;
    startTime: string;
    endTime: string;
    videoConferenceUrl?: string;
    description?: string;
    location?: string;
    status?: string;
    visibility?: string;
    createdBy: string;
    color?: string;
  }) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        calendar_id: params.calendarId,
        title: params.title,
        start_time: params.startTime,
        end_time: params.endTime,
        video_conference_url: params.videoConferenceUrl || null,
        description: params.description || null,
        location: params.location || null,
        status: params.status || 'confirmed',
        visibility: params.visibility || 'private',
        created_by: params.createdBy,
        color: params.color || null,
      })
      .select()
      // safe: guaranteed-row
      .single();

    if (error) throw error;
    return data;
  };

  const addAttendees = async (attendees: Array<{
    event_id: string;
    email: string;
    display_name?: string | null;
    role: string;
    status: string;
    user_id?: string | null;
  }>) => {
    if (attendees.length === 0) return;
    const { error } = await supabase.from('event_attendees').insert(attendees);
    if (error) {
      debug.error('Error adding attendees:', error);
    }
  };

  const addReminder = async (params: {
    event_id: string;
    user_id: string;
    minutes_before: number;
  }) => {
    const { error } = await supabase.from('event_reminders').insert(params);
    if (error) throw error;
  };

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  return {
    getOrCreateDefaultCalendar,
    createEvent,
    addAttendees,
    addReminder,
    invalidateCalendar,
  };
}

/**
 * Hook for creating tasks from Pulse (TaskCreatorModal, TaskLinkerModal).
 */
export function usePulseTaskCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      titre: string;
      description: string;
      priorite?: string;
      echeance?: string | null;
      responsable_id?: string;
      categorie_id?: string;
    }) => {
      let categoryId = params.categorie_id;
      
      if (!categoryId) {
        const { data: anyCategory } = await supabase
          .from('categories_taches')
          .select('id')
          .limit(1)
          .maybeSingle();
        categoryId = anyCategory?.id;
      }

      if (!categoryId) {
        throw new Error('Aucune catégorie de tâche disponible');
      }

      const { data, error } = await supabase.from('taches')
        .insert([{
          titre: params.titre,
          description: params.description,
          statut: 'A faire',
          priorite: (params.priorite || 'Normale') as 'high' | 'low' | 'medium',
          echeance: params.echeance || null,
          responsable_id: params.responsable_id,
          categorie_id: categoryId,
        }])
        .select('id, titre')
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data as { id: string; titre: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taches'] });
    },
    onError: (error: Error) => {
      debug.error('Error creating task:', error);
      toast.error('Erreur lors de la création de la tâche');
    },
  });
}
