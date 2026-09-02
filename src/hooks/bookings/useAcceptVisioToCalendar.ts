import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';
import { useAuth } from "@/components/AuthProvider";

interface AcceptVisioParams {
  messageId: string;
  threadId?: string;
  subject: string;
  visioLink: string;
  visioProvider: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{ email: string; name?: string }>;
  fromAddress?: string;
}

interface AcceptVisioResult {
  eventId: string;
  summary: string | null;
}

export function useAcceptVisioToCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<AcceptVisioResult, Error, AcceptVisioParams>({
    mutationFn: async ({
      messageId,
      threadId,
      subject,
      visioLink,
      visioProvider,
      startTime,
      endTime,
      attendees,
      fromAddress
    }) => {
      // 1. Get current user
      if (!user) throw new Error('Non authentifié');

      // 2. Get thread_id from message if not provided
      let actualThreadId = threadId;
      if (!actualThreadId && messageId) {
        const { data: message } = await supabase
          .from('email_messages')
          .select('thread_id')
          .eq('id', messageId)
          .single();
        actualThreadId = message?.thread_id;
      }

      // 3. Generate AI summary and clean title if we have a thread
      let aiSummary: string | null = null;
      let cleanTitle: string | null = null;
      if (actualThreadId) {
        try {
          const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-thread-summary', {
            body: { threadId: actualThreadId }
          });
          
          if (!summaryError && summaryData) {
            if (summaryData.summary) {
              aiSummary = summaryData.summary;
            }
            if (summaryData.cleanTitle) {
              cleanTitle = summaryData.cleanTitle;
            }
          }
        } catch (e) {
          if (import.meta.env.DEV) debug.warn('Could not generate AI summary:', e);
        }
      }

      // 4. Get or create default calendar
      let calendarId: string;
      const { data: calendar, error: calError } = await supabase
        .from('calendars')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

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

      // 5. Build event description with AI summary and participants
      const descriptionParts: string[] = [];
      
      if (aiSummary) {
        descriptionParts.push(`📝 Contexte:\n${aiSummary}`);
      }
      
      if (attendees.length > 0) {
        descriptionParts.push(`\n\n👥 Participants:\n• ${attendees.map(a => a.name || a.email).join('\n• ')}`);
      }
      
      if (fromAddress) {
        descriptionParts.push(`\n\n👤 Organisateur: ${fromAddress}`);
      }

      // 6. Create calendar event with clean title
      const eventTitle = cleanTitle || subject || `Réunion ${visioProvider}`;
      
      const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          calendar_id: calendarId,
          title: eventTitle,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          video_conference_url: visioLink,
          description: descriptionParts.join(''),
          status: 'confirmed',
          visibility: 'private',
          created_by: user.id
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // 7. Add attendees
      if (attendees.length > 0) {
        const attendeeInserts = attendees.map(a => ({
          event_id: event.id,
          email: a.email,
          display_name: a.name || null,
          status: 'pending',
          role: 'attendee'
        }));

        await supabase.from('event_attendees').insert(attendeeInserts);
      }

      return {
        eventId: event.id,
        summary: aiSummary
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "✓ Événement accepté",
        description: "La visio a été ajoutée à votre calendrier avec le résumé IA",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    }
  });
}
