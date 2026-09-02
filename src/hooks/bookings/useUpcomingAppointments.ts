import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { startOfDay, endOfWeek, addDays, format, parseISO, max } from "date-fns";
import { fr } from "date-fns/locale";
import { debug } from "@/lib/debug";

export interface UpcomingAppointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  etablissement_id?: string;
  etablissement_nom?: string;
  type: 'rdv' | 'presentation' | 'negociation' | 'autre';
  formattedDate: string;
  description?: string;
  video_conference_url?: string;
  calendar_name?: string;
  calendar_color?: string;
  all_day?: boolean;
  hasConflict?: boolean;
}

const RDV_KEYWORDS = ['rdv', 'rendez-vous', 'meeting', 'réunion'];
const PRESENTATION_KEYWORDS = ['présentation', 'demo', 'démonstration'];
const NEGOCIATION_KEYWORDS = ['négociation', 'négocier', 'offre', 'proposition'];

function detectEventType(title: string): UpcomingAppointment['type'] {
  const lowerTitle = title.toLowerCase();
  
  if (NEGOCIATION_KEYWORDS.some(k => lowerTitle.includes(k))) return 'negociation';
  if (PRESENTATION_KEYWORDS.some(k => lowerTitle.includes(k))) return 'presentation';
  if (RDV_KEYWORDS.some(k => lowerTitle.includes(k))) return 'rdv';
  
  return 'autre';
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const eventDay = startOfDay(date);

  if (eventDay.getTime() === today.getTime()) {
    return `Aujourd'hui ${format(date, 'HH:mm')}`;
  }
  if (eventDay.getTime() === tomorrow.getTime()) {
    return `Demain ${format(date, 'HH:mm')}`;
  }
  
  return format(date, "EEEE HH:mm", { locale: fr });
}

// Detect conflicts between events (overlapping time ranges)
function detectConflicts(events: UpcomingAppointment[]): Set<string> {
  const conflictIds = new Set<string>();
  
  for (let i = 0; i < events.length; i++) {
    const eventA = events[i];
    if (eventA.all_day) continue; // Skip all-day events
    
    const startA = parseISO(eventA.start_time);
    const endA = parseISO(eventA.end_time);
    
    for (let j = i + 1; j < events.length; j++) {
      const eventB = events[j];
      if (eventB.all_day) continue;
      
      const startB = parseISO(eventB.start_time);
      const endB = parseISO(eventB.end_time);
      
      // Overlap: A starts before B ends AND B starts before A ends
      if (startA < endB && startB < endA) {
        conflictIds.add(eventA.id);
        conflictIds.add(eventB.id);
      }
    }
  }
  
  return conflictIds;
}

export function useUpcomingAppointments(limit: number = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['upcoming-appointments', user?.id, limit],
    queryFn: async (): Promise<UpcomingAppointment[]> => {
      const now = new Date();
      // Always show at least 7 days ahead, even on Sunday when endOfWeek = today
      const weekEnd = max([endOfWeek(now, { weekStartsOn: 1 }), addDays(now, 7)]);

      // Récupérer les calendriers de l'utilisateur
      const { data: calendars } = await supabase
        .from('calendars')
        .select('id')
        .eq('owner_id', user!.id);

      if (!calendars || calendars.length === 0) {
        return [];
      }

      const calendarIds = calendars.map(c => c.id);

      // Récupérer les événements à venir
      const { data: events, error } = await supabase
        .from('calendar_events')
        .select(`
          id,
          title,
          start_time,
          end_time,
          location,
          description,
          video_conference_url,
          all_day,
          etablissement_id,
          etablissements:etablissement_id (nom),
          calendar:calendar_id (name, color)
        `)
        .in('calendar_id', calendarIds)
        .gte('start_time', now.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) {
        debug.error('Error fetching appointments:', error);
        return [];
      }

      // Map events to appointments
      type JoinedEvent = (typeof events extends Array<infer T> ? T : never) & {
        etablissements?: { nom?: string | null } | null;
        calendar?: { name?: string | null; color?: string | null } | null;
      };
      const rawAppointments: UpcomingAppointment[] = ((events as JoinedEvent[]) || []).map(event => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location || undefined,
        description: event.description || undefined,
        video_conference_url: event.video_conference_url || undefined,
        all_day: event.all_day || false,
        etablissement_id: event.etablissement_id || undefined,
        etablissement_nom: event.etablissements?.nom || undefined,
        calendar_name: event.calendar?.name || undefined,
        calendar_color: event.calendar?.color || undefined,
        type: detectEventType(event.title),
        formattedDate: formatEventDate(event.start_time),
        hasConflict: false
      }));

      // Deduplicate events with same title + start_time (keep first occurrence)
      const seen = new Set<string>();
      const appointments = rawAppointments.filter(apt => {
        const key = `${apt.title}|${apt.start_time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Detect and mark conflicts
      const conflictIds = detectConflicts(appointments);
      appointments.forEach(apt => {
        apt.hasConflict = conflictIds.has(apt.id);
      });

      return appointments;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useWeeklyAppointmentsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-appointments-count', user?.id],
    queryFn: async (): Promise<number> => {
      const now = new Date();
      const weekEnd = max([endOfWeek(now, { weekStartsOn: 1 }), addDays(now, 7)]);

      // Récupérer les calendriers de l'utilisateur
      const { data: calendars } = await supabase
        .from('calendars')
        .select('id')
        .eq('owner_id', user!.id);

      if (!calendars || calendars.length === 0) {
        return 0;
      }

      const calendarIds = calendars.map(c => c.id);

      const { count, error } = await supabase
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .in('calendar_id', calendarIds)
        .gte('start_time', now.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .eq('status', 'confirmed');

      if (error) {
        debug.error('Error counting appointments:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });
}
