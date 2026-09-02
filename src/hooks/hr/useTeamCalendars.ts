import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/types/calendar";
import { debug } from "@/lib/debug";
import { useAuth } from "@/components/AuthProvider";

// Types stricts pour les profils de propriétaires
interface OwnerProfile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  user_id: string | null;
}

interface TeamCalendar extends Calendar {
  owner_profile?: OwnerProfile;
}

// Type pour le join calendrier partagé
interface SharedCalendarData {
  calendar: Calendar | null;
}

export function useTeamCalendars() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['team-calendars'],
    queryFn: async () => {
      
      if (!user) throw new Error('Non authentifié');

      // Fetch team calendars (type = 'team') from all users
      const { data: teamCalendars, error: teamError } = await supabase
        .from('calendars')
        .select('id, name, color, description, owner_id, type, is_default, is_visible, timezone, created_at, updated_at')
        .eq('type', 'team')
        .neq('owner_id', user.id)
        .limit(100);

      if (teamError) {
        debug.error('Error fetching team calendars:', teamError);
        throw teamError;
      }

      // Fetch shared calendars
      const { data: sharedCalendars, error: sharedError } = await supabase
        .from('calendar_shares')
        .select(`
          calendar:calendars (*)
        `)
        .eq('shared_with_user_id', user.id);

      if (sharedError) {
        debug.error('Error fetching shared calendars:', sharedError);
        throw sharedError;
      }

      // Fetch profiles for owners
      const ownerIds = new Set<string>();
      (teamCalendars || []).forEach(cal => ownerIds.add(cal.owner_id));
      // Cast explicite pour le join Supabase
      const typedSharedCalendars = (sharedCalendars || []) as SharedCalendarData[];
      typedSharedCalendars.forEach((share) => {
        if (share.calendar) ownerIds.add(share.calendar.owner_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, prenom, nom, email, user_id')
        .in('user_id', Array.from(ownerIds));

      const profilesByUserId = (profiles || []).reduce<Record<string, OwnerProfile>>((acc, p) => {
        if (p.user_id) {
          acc[p.user_id] = {
            id: p.id,
            prenom: p.prenom || '',
            nom: p.nom || '',
            email: p.email,
            user_id: p.user_id
          };
        }
        return acc;
      }, {});

      // Combine and deduplicate
      const allCalendars: TeamCalendar[] = [];
      const seenIds = new Set<string>();

      // Type pour les calendriers de la base (avec type string)
      type CalendarType = 'personal' | 'team' | 'establishment' | 'absences' | 'shared';
      const validTypes: CalendarType[] = ['personal', 'team', 'establishment', 'absences', 'shared'];
      const isValidType = (type: string): type is CalendarType => validTypes.includes(type as CalendarType);

      // Add team calendars
      (teamCalendars || []).forEach((cal) => {
        if (!seenIds.has(cal.id)) {
          seenIds.add(cal.id);
          allCalendars.push({
            ...cal,
            type: isValidType(cal.type) ? cal.type : 'personal',
            is_default: cal.is_default ?? false,
            is_visible: cal.is_visible ?? true,
            timezone: cal.timezone ?? 'Europe/Paris',
            owner_profile: profilesByUserId[cal.owner_id]
          });
        }
      });

      // Add shared calendars
      typedSharedCalendars.forEach((share) => {
        if (share.calendar && !seenIds.has(share.calendar.id)) {
          seenIds.add(share.calendar.id);
          allCalendars.push({
            ...share.calendar,
            type: isValidType(share.calendar.type) ? share.calendar.type : 'personal',
            is_default: share.calendar.is_default ?? false,
            is_visible: share.calendar.is_visible ?? true,
            timezone: share.calendar.timezone ?? 'Europe/Paris',
            owner_profile: profilesByUserId[share.calendar.owner_id]
          });
        }
      });

      return allCalendars;
    }
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members-with-calendars'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom, email, user_id')
        .order('nom')
        .limit(200); // Safety limit

      if (error) throw error;
      return profiles || [];
    }
  });
}
