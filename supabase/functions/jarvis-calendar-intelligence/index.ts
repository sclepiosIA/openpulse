import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
 /**
  * JARVIS V12.0 - Calendar Intelligence Engine
  * 
  * Analyse des patterns de disponibilité, détection de conflits,
  * suggestions de préparation avant réunion.
  */
 
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;
 
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 🔒 Validate JWT — reject anon/unauthenticated callers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authenticatedUserId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, eventId, dateRange, duration, preferredTime } = body;
    // 🔒 Force userId to authenticated subject — ignore any client-supplied value
    const userId = authenticatedUserId;

    // 🔒 Verify event ownership when eventId is used
    const verifyEventOwnership = async (eid: string): Promise<boolean> => {
      const { data } = await supabase
        .from('calendar_events')
        .select('id, calendars!inner(owner_id)')
        .eq('id', eid)
        .eq('calendars.owner_id', userId)
        .maybeSingle();
      return !!data;
    };

    switch (action) {
      case 'analyze_availability': {
        const patterns = await analyzeAvailabilityPatterns(supabase, userId);
        return new Response(JSON.stringify({ success: true, patterns }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'suggest_best_slots': {
        const slots = await suggestBestSlots(supabase, userId, duration, preferredTime, dateRange);
        return new Response(JSON.stringify({ success: true, slots }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'detect_conflicts': {
        const conflicts = await detectConflicts(supabase, userId, dateRange);
        return new Response(JSON.stringify({ success: true, conflicts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'prepare_meeting': {
        if (!eventId || !(await verifyEventOwnership(eventId))) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const preparation = await prepareMeetingContext(supabase, eventId);
        return new Response(JSON.stringify({ success: true, preparation }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_weekly_summary': {
        const summary = await getWeeklySummary(supabase, userId);
        return new Response(JSON.stringify({ success: true, summary }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    console.error('Calendar intelligence error:', error);
    return buildErrorResponse('jarvis-calendar-intelligence', error, corsHeaders, 500);
  }
});
 
 async function analyzeAvailabilityPatterns(supabase: any, userId: string): Promise<any> {
   // Get user's calendars
   const { data: calendars } = await supabase
     .from('calendars')
     .select('id')
     .eq('owner_id', userId);
 
   if (!calendars || calendars.length === 0) {
     return { patterns: [], insights: [] };
   }
 
   const calendarIds = calendars.map((c: any) => c.id);
 
   // Get events from last 30 days
   const thirtyDaysAgo = new Date();
   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
 
   const { data: events } = await supabase
     .from('calendar_events')
     .select('*')
     .in('calendar_id', calendarIds)
     .gte('start_time', thirtyDaysAgo.toISOString())
     .order('start_time', { ascending: true });
 
   if (!events || events.length === 0) {
     return { patterns: [], insights: [] };
   }
 
   // Analyze patterns by day of week and time
   const dayPatterns: Record<number, { count: number; hours: number[] }> = {};
   const hourPatterns: Record<number, number> = {};
 
   events.forEach((event: any) => {
     const startDate = new Date(event.start_time);
     const dayOfWeek = startDate.getDay();
     const hour = startDate.getHours();
 
     if (!dayPatterns[dayOfWeek]) {
       dayPatterns[dayOfWeek] = { count: 0, hours: [] };
     }
     dayPatterns[dayOfWeek].count++;
     dayPatterns[dayOfWeek].hours.push(hour);
 
     hourPatterns[hour] = (hourPatterns[hour] || 0) + 1;
   });
 
   // Find busiest and quietest times
   const busiestHour = Object.entries(hourPatterns)
     .sort(([, a], [, b]) => b - a)[0];
   const quietestHour = Object.entries(hourPatterns)
     .sort(([, a], [, b]) => a - b)[0];
 
   const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
   const busiestDay = Object.entries(dayPatterns)
     .sort(([, a], [, b]) => b.count - a.count)[0];
 
   return {
     patterns: {
       totalMeetings: events.length,
       avgMeetingsPerWeek: Math.round(events.length / 4),
       busiestDay: dayNames[parseInt(busiestDay[0])],
       busiestHour: `${busiestHour[0]}h`,
       quietestHour: `${quietestHour[0]}h`
     },
     insights: [
       `Vous avez en moyenne ${Math.round(events.length / 4)} réunions par semaine`,
       `Votre jour le plus chargé est le ${dayNames[parseInt(busiestDay[0])]}`,
       `Créneaux recommandés pour le focus: ${quietestHour[0]}h-${parseInt(quietestHour[0]) + 2}h`
     ],
     recommendations: [
       {
         type: 'focus_time',
         title: 'Bloquer du temps focus',
         suggestion: `Réservez ${quietestHour[0]}h-${parseInt(quietestHour[0]) + 2}h pour le travail en profondeur`
       },
       {
         type: 'meeting_clustering',
         title: 'Regrouper les réunions',
         suggestion: `Concentrez vos réunions le ${dayNames[parseInt(busiestDay[0])]} pour libérer les autres jours`
       }
     ]
   };
 }
 
 async function suggestBestSlots(
   supabase: any, 
   userId: string, 
   duration: number = 60,
   preferredTime?: string,
   dateRange?: { start: string; end: string }
 ): Promise<any[]> {
   const { data: calendars } = await supabase
     .from('calendars')
     .select('id')
     .eq('owner_id', userId);
 
   if (!calendars || calendars.length === 0) return [];
 
   const calendarIds = calendars.map((c: any) => c.id);
 
   const startDate = dateRange?.start ? new Date(dateRange.start) : new Date();
   const endDate = dateRange?.end ? new Date(dateRange.end) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
 
   // Get existing events
   const { data: events } = await supabase
     .from('calendar_events')
     .select('start_time, end_time')
     .in('calendar_id', calendarIds)
     .gte('start_time', startDate.toISOString())
     .lte('end_time', endDate.toISOString())
     .order('start_time');
 
   const busySlots = (events || []).map((e: any) => ({
     start: new Date(e.start_time),
     end: new Date(e.end_time)
   }));
 
   // Generate available slots
   const availableSlots: any[] = [];
   const current = new Date(startDate);
   current.setHours(9, 0, 0, 0); // Start at 9 AM
 
   while (current < endDate && availableSlots.length < 10) {
     const dayOfWeek = current.getDay();
     
     // Skip weekends
     if (dayOfWeek === 0 || dayOfWeek === 6) {
       current.setDate(current.getDate() + 1);
       current.setHours(9, 0, 0, 0);
       continue;
     }
 
     const slotEnd = new Date(current.getTime() + duration * 60 * 1000);
     
     // Check if slot is within working hours (9-18)
     if (current.getHours() >= 18) {
       current.setDate(current.getDate() + 1);
       current.setHours(9, 0, 0, 0);
       continue;
     }
 
     // Check for conflicts
     const hasConflict = busySlots.some((busy: any) => 
       (current >= busy.start && current < busy.end) ||
       (slotEnd > busy.start && slotEnd <= busy.end) ||
       (current <= busy.start && slotEnd >= busy.end)
     );
 
     if (!hasConflict) {
       // Calculate score based on preferences
       let score = 100;
       const hour = current.getHours();
       
       // Prefer mid-morning and mid-afternoon
       if (hour >= 10 && hour <= 11) score += 20;
       else if (hour >= 14 && hour <= 16) score += 15;
       else if (hour === 9 || hour === 17) score -= 10;
       
       // Prefer preferred time if specified
       if (preferredTime === 'morning' && hour < 12) score += 25;
       else if (preferredTime === 'afternoon' && hour >= 14) score += 25;
 
       availableSlots.push({
         start: new Date(current),
         end: slotEnd,
         score,
         label: formatSlotLabel(current, slotEnd)
       });
     }
 
     // Move to next slot (30 min increments)
     current.setMinutes(current.getMinutes() + 30);
   }
 
   return availableSlots
     .sort((a, b) => b.score - a.score)
     .slice(0, 5);
 }
 
 function formatSlotLabel(start: Date, end: Date): string {
   const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
   const day = dayNames[start.getDay()];
   const date = start.getDate();
   const startTime = `${start.getHours()}h${start.getMinutes().toString().padStart(2, '0')}`;
   const endTime = `${end.getHours()}h${end.getMinutes().toString().padStart(2, '0')}`;
   
   return `${day} ${date} - ${startTime} à ${endTime}`;
 }
 
 async function detectConflicts(
   supabase: any, 
   userId: string,
   dateRange?: { start: string; end: string }
 ): Promise<any[]> {
   const { data: calendars } = await supabase
     .from('calendars')
     .select('id')
     .eq('owner_id', userId);
 
   if (!calendars || calendars.length === 0) return [];
 
   const calendarIds = calendars.map((c: any) => c.id);
 
   const startDate = dateRange?.start || new Date().toISOString();
   const endDate = dateRange?.end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
 
   const { data: events } = await supabase
     .from('calendar_events')
     .select('*')
     .in('calendar_id', calendarIds)
     .gte('start_time', startDate)
     .lte('end_time', endDate)
     .order('start_time');
 
   if (!events || events.length < 2) return [];
 
   const conflicts: any[] = [];
 
   for (let i = 0; i < events.length - 1; i++) {
     const current = events[i];
     const next = events[i + 1];
 
     const currentEnd = new Date(current.end_time);
     const nextStart = new Date(next.start_time);
 
     // Check for overlap
     if (currentEnd > nextStart) {
       conflicts.push({
         type: 'overlap',
         severity: 'high',
         events: [
           { id: current.id, title: current.title, start: current.start_time, end: current.end_time },
           { id: next.id, title: next.title, start: next.start_time, end: next.end_time }
         ],
         message: `"${current.title}" et "${next.title}" se chevauchent`
       });
     }
     // Check for back-to-back (no buffer)
     else if (currentEnd.getTime() === nextStart.getTime()) {
       conflicts.push({
         type: 'back_to_back',
         severity: 'low',
         events: [
           { id: current.id, title: current.title },
           { id: next.id, title: next.title }
         ],
         message: `Pas de pause entre "${current.title}" et "${next.title}"`
       });
     }
   }
 
   return conflicts;
 }
 
 async function prepareMeetingContext(supabase: any, eventId: string): Promise<any> {
   // Get the event
   const { data: event, error } = await supabase
     .from('calendar_events')
     .select('*, etablissement:etablissement_id(*)')
     .eq('id', eventId)
     .single();
 
   if (error || !event) {
     throw new Error('Event not found');
   }
 
   const preparation: any = {
     event: {
       title: event.title,
       startTime: event.start_time,
       endTime: event.end_time,
       location: event.location,
       description: event.description
     },
     context: {},
     suggestions: [],
     documents: []
   };
 
   // If linked to an établissement, get context
   if (event.etablissement) {
     const etab = event.etablissement;
     preparation.context.etablissement = {
       nom: etab.nom,
       statut: etab.statut,
       progression: etab.progression,
       ca_mensuel: etab.ca_mensuel
     };
 
     // Get recent tasks for this établissement
     const { data: tasks } = await supabase
       .from('taches')
       .select('titre, statut, priorite')
       .eq('etablissement_id', etab.id)
       .in('statut', ['A faire', 'En cours'])
       .order('priorite', { ascending: false })
       .limit(5);
 
     if (tasks) {
       preparation.context.pendingTasks = tasks;
     }
 
     // Get recent emails
     const { data: threads } = await supabase
       .from('email_threads')
       .select('subject, last_message_date')
       .eq('etablissement_id', etab.id)
       .order('last_message_date', { ascending: false })
       .limit(3);
 
     if (threads) {
       preparation.context.recentEmails = threads;
     }
   }
 
   // Generate suggestions
   preparation.suggestions = [
     {
       type: 'preparation',
       title: 'Points à préparer',
       items: [
         'Revoir les échanges récents',
         'Préparer l\'ordre du jour',
         'Vérifier les tâches en attente'
       ]
     },
     {
       type: 'follow_up',
       title: 'Actions post-réunion suggérées',
       items: [
         'Envoyer un récapitulatif',
         'Créer les tâches identifiées',
         'Planifier la prochaine étape'
       ]
     }
   ];
 
   return preparation;
 }
 
 async function getWeeklySummary(supabase: any, userId: string): Promise<any> {
   const { data: calendars } = await supabase
     .from('calendars')
     .select('id')
     .eq('owner_id', userId);
 
   if (!calendars || calendars.length === 0) {
     return { totalEvents: 0, totalHours: 0, byCategory: {} };
   }
 
   const calendarIds = calendars.map((c: any) => c.id);
 
   // Get this week's events
   const startOfWeek = new Date();
   startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
   startOfWeek.setHours(0, 0, 0, 0);
 
   const endOfWeek = new Date(startOfWeek);
   endOfWeek.setDate(endOfWeek.getDate() + 7);
 
   const { data: events } = await supabase
     .from('calendar_events')
     .select('*')
     .in('calendar_id', calendarIds)
     .gte('start_time', startOfWeek.toISOString())
     .lt('end_time', endOfWeek.toISOString());
 
   if (!events) {
     return { totalEvents: 0, totalHours: 0, byCategory: {} };
   }
 
   // Calculate total hours
   const totalMinutes = events.reduce((acc: number, event: any) => {
     const start = new Date(event.start_time);
     const end = new Date(event.end_time);
     return acc + (end.getTime() - start.getTime()) / (1000 * 60);
   }, 0);
 
   // Group by day
   const byDay: Record<string, number> = {};
   const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
   
   events.forEach((event: any) => {
     const day = dayNames[new Date(event.start_time).getDay()];
     byDay[day] = (byDay[day] || 0) + 1;
   });
 
   return {
     totalEvents: events.length,
     totalHours: Math.round(totalMinutes / 60 * 10) / 10,
     byDay,
     busiestDay: Object.entries(byDay).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A',
     upcomingToday: events.filter((e: any) => {
       const eventDate = new Date(e.start_time);
       const today = new Date();
       return eventDate.toDateString() === today.toDateString() && eventDate > today;
     }).length
   };
 }