import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useAuth } from "@/components/AuthProvider";

export interface CalendarInvitationSuggestion {
  id: string;
  email_thread_id: string;
  calendar_uid: string;
  event_summary: string;
  event_dtstart: string;
  event_dtend?: string;
  event_location?: string;
  event_description?: string;
  event_organizer?: string;
  event_meeting_link?: string;
  event_attendees?: Array<{ email: string; name?: string }>;
  thread_summary?: string;
  status: 'pending_etablissement' | 'accepted' | 'rejected';
  suggested_etablissement_id?: string;
  created_task_id?: string;
  created_calendar_event_id?: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  thread?: {
    subject: string;
    participants: unknown;
  };

}

export function useCalendarSuggestions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['calendar-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_invitation_suggestions')
        .select(`
          *,
          thread:email_threads(subject, participants)
        `)
        .eq('status', 'pending_etablissement')
        .gte('event_dtstart', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse event_attendees JSON
      const parsed = (data || []).map(item => ({
        ...item,
        event_attendees: typeof item.event_attendees === 'string' 
          ? JSON.parse(item.event_attendees) 
          : item.event_attendees || []
      })) as CalendarInvitationSuggestion[];

      // Deduplicate by event_summary + event_dtstart (keep most recent)
      const deduped = new Map<string, CalendarInvitationSuggestion>();
      for (const item of parsed) {
        const key = `${item.event_summary}||${item.event_dtstart}`;
        const existing = deduped.get(key);
        if (!existing || new Date(item.created_at) > new Date(existing.created_at)) {
          deduped.set(key, item);
        }
      }
      return Array.from(deduped.values());
    },
  });

  // Accept to calendar (personal calendar)
  const acceptToCalendar = useMutation({
    mutationFn: async ({ suggestionId }: { suggestionId: string }) => {
      // Get current user
      if (!user) throw new Error('Non authentifié');

      // Get profile ID (profiles.id != auth.users.id in this project)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Profil utilisateur introuvable');
      }

      // Get suggestion details
      const { data: suggestion, error: fetchError } = await supabase
        .from('calendar_invitation_suggestions')
        .select('*, thread:email_threads(id, subject)')
        .eq('id', suggestionId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!suggestion) throw new Error('Suggestion introuvable');

      // Get user's default calendar
      const { data: calendar } = await supabase
        .from('calendars')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      let calendarId: string;
      if (!calendar) {
        const { data: newCalendar, error: createCalError } = await supabase
          .from('calendars')
          .insert({
            name: 'Mon calendrier',
            owner_id: user.id,
            is_default: true,
            color: '#3b82f6',
            type: 'personal'
          })
          .select()
          .single();

        if (createCalError) throw createCalError;
        calendarId = newCalendar.id;
      } else {
        calendarId = calendar.id;
      }

      // Build event description
      const descriptionParts: string[] = [];
      
      if (suggestion.thread_summary) {
        descriptionParts.push(`📝 Contexte des échanges:\n${suggestion.thread_summary}`);
      }
      
      const attendeesArray = Array.isArray(suggestion.event_attendees) 
        ? suggestion.event_attendees as Array<{ email: string; name?: string }>
        : [];
      
      if (attendeesArray.length > 0) {
        const attendeesList = attendeesArray
          .map((a) => a.name ? `${a.name} (${a.email})` : a.email)
          .join('\n• ');

        descriptionParts.push(`\n\n👥 Participants:\n• ${attendeesList}`);
      }
      
      if (suggestion.event_organizer) {
        descriptionParts.push(`\n\n👤 Organisateur: ${suggestion.event_organizer}`);
      }
      
      if (suggestion.event_description) {
        descriptionParts.push(`\n\n📄 Description originale:\n${suggestion.event_description.substring(0, 500)}`);
      }

      // Create calendar event
      const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          calendar_id: calendarId,
          title: suggestion.event_summary,
          start_time: suggestion.event_dtstart,
          end_time: suggestion.event_dtend || suggestion.event_dtstart,
          location: suggestion.event_location,
          video_conference_url: suggestion.event_meeting_link,
          description: descriptionParts.join(''),
          status: 'confirmed',
          visibility: 'private',
          created_by: user.id
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add attendees to event_attendees table if they exist
      if (attendeesArray.length > 0) {
        const attendeeInserts = attendeesArray.slice(0, 20).map((a) => ({
          event_id: event.id,
          email: a.email,
          name: a.name || null,
          status: 'pending',
          role: 'attendee'
        }));

        await supabase
          .from('event_attendees')
          .insert(attendeeInserts as never);
      }

      // Update suggestion status with profile.id (not user.id)
      const { error: updateError } = await supabase
        .from('calendar_invitation_suggestions')
        .update({
          status: 'accepted',
          created_calendar_event_id: event.id,
          processed_at: new Date().toISOString(),
          processed_by: profile.id
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "Succès",
        description: "Événement ajouté à votre calendrier",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Impossible d'ajouter l'événement au calendrier",
        variant: "destructive",
      });
    },
  });

  // Accept to task (existing behavior)
  const acceptSuggestion = useMutation({
    mutationFn: async ({ 
      suggestionId, 
      etablissementId 
    }: { 
      suggestionId: string; 
      etablissementId: string;
    }) => {
      // Get current user and profile
      if (!user) throw new Error('Non authentifié');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Profil utilisateur introuvable');
      }

      // Get suggestion details
      const { data: suggestion, error: fetchError } = await supabase
        .from('calendar_invitation_suggestions')
        .select('*, thread:email_threads(id)')
        .eq('id', suggestionId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!suggestion) throw new Error('Suggestion introuvable');

      // Get "Réunion" category
      const { data: category, error: catError } = await supabase
        .from('categories_taches')
        .select('id')
        .eq('nom', 'Réunion')
        .maybeSingle();

      if (catError) throw catError;
      if (!category) throw new Error('Catégorie "Réunion" introuvable');

      // Create task
      const descriptionParts = [];
      
      if (suggestion.event_meeting_link) {
        descriptionParts.push(`📹 Lien visio: ${suggestion.event_meeting_link}`);
      }
      
      if (suggestion.event_description) {
        descriptionParts.push(suggestion.event_description.substring(0, 500));
      }
      
      if (suggestion.event_location) {
        descriptionParts.push(`\n📍 Lieu: ${suggestion.event_location}`);
      }
      
      if (suggestion.event_organizer) {
        descriptionParts.push(`\n👤 Organisateur: ${suggestion.event_organizer}`);
      }
      
      if (suggestion.event_dtend) {
        const start = new Date(suggestion.event_dtstart);
        const end = new Date(suggestion.event_dtend);
        const duration = Math.round((end.getTime() - start.getTime()) / 60000);
        descriptionParts.push(`\n⏱️ Durée: ${duration} minutes`);
      }
      
      descriptionParts.push(`\n\n🔗 UID: ${suggestion.calendar_uid}`);

      const { data: task, error: taskError } = await supabase
        .from('taches')
        .insert({
          titre: suggestion.event_summary.substring(0, 255),
          description: descriptionParts.join(''),
          etablissement_id: etablissementId,
          categorie_id: category.id,
          priorite: 'medium',
          echeance: suggestion.event_dtstart.split('T')[0],
          statut: 'A faire',
          archive: false
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Update suggestion status with profile.id
      const { error: updateError } = await supabase
        .from('calendar_invitation_suggestions')
        .update({
          status: 'accepted',
          suggested_etablissement_id: etablissementId,
          created_task_id: task.id,
          processed_at: new Date().toISOString(),
          processed_by: profile.id
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      // Update thread etablissement_id
      await supabase
        .from('email_threads')
        .update({ etablissement_id: etablissementId })
        .eq('id', suggestion.thread.id);

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['taches'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      toast({
        title: "Succès",
        description: "Invitation acceptée et tâche créée",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Impossible d'accepter l'invitation",
        variant: "destructive",
      });
    },
  });

  const rejectSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      // Get current user and profile
      if (!user) throw new Error('Non authentifié');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Profil utilisateur introuvable');
      }

      const { error } = await supabase
        .from('calendar_invitation_suggestions')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: profile.id
        })
        .eq('id', suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-suggestions'] });
      toast({
        title: "Succès",
        description: "Invitation rejetée",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Impossible de rejeter l'invitation",
        variant: "destructive",
      });
    },
  });

  return {
    suggestions: suggestions || [],
    isLoading,
    acceptSuggestion: acceptSuggestion.mutate,
    acceptToCalendar: acceptToCalendar.mutate,
    rejectSuggestion: rejectSuggestion.mutate,
    isAccepting: acceptSuggestion.isPending,
    isAcceptingToCalendar: acceptToCalendar.isPending,
    isRejecting: rejectSuggestion.isPending,
  };
}
