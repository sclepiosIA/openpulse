/**
 * JARVIS 12.0 - Calendar Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

/**
 * get_my_calendar - Récupère les événements calendrier de l'utilisateur
 * avec tous les détails : titre, horaires, lieu, description, participants, calendrier
 */
export async function executeGetMyCalendar(ctx: ToolContext, args: { date_from?: string; date_to?: string; include_all_day?: boolean; calendar_ids?: string[] }): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Defaults: today → end of week (dimanche)
    const now = new Date();
    const dateFrom = args.date_from || now.toISOString();
    
    // Default date_to: end of current week (Sunday 23:59:59)
    const endOfWeek = new Date(now);
    const dayOfWeek = endOfWeek.getDay(); // 0=Sun
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
    endOfWeek.setHours(23, 59, 59, 999);
    const dateTo = args.date_to || endOfWeek.toISOString();

    const includeAllDay = args.include_all_day !== false;

    // 1. Get user's calendars
    let calQuery = ctx.supabase
      .from('calendars')
      .select('id, name, color')
      .eq('owner_id', ctx.userId);

    if (args.calendar_ids && args.calendar_ids.length > 0) {
      calQuery = calQuery.in('id', args.calendar_ids);
    } else {
      calQuery = calQuery.eq('is_visible', true);
    }

    const { data: calendars, error: calError } = await calQuery;
    if (calError) throw calError;
    if (!calendars || calendars.length === 0) {
      return { success: true, data: { events: [], total: 0, period: { from: dateFrom, to: dateTo }, message: 'Aucun calendrier trouvé' }, execution_time_ms: Date.now() - start };
    }

    const calendarIds = calendars.map(c => c.id);
    const calendarMap = new Map(calendars.map(c => [c.id, { name: c.name, color: c.color }]));

    // 2. Fetch events in range
    let evtQuery = ctx.supabase
      .from('calendar_events')
      .select(`
        id, title, start_time, end_time, location, description,
        video_conference_url, all_day, status, color,
        calendar_id, etablissement_id, recurrence_rule,
        etablissements:etablissement_id (id, nom)
      `)
      .in('calendar_id', calendarIds)
      .gte('end_time', dateFrom)
      .lte('start_time', dateTo)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true })
      .limit(200);

    if (!includeAllDay) {
      evtQuery = evtQuery.eq('all_day', false);
    }

    const { data: events, error: evtError } = await evtQuery;
    if (evtError) throw evtError;

    // 3. Also fetch shared calendars events
    const { data: shares } = await ctx.supabase
      .from('calendar_shares')
      .select('calendar_id, permission, calendars:calendar_id (id, name, color)')
      .eq('shared_with_user_id', ctx.userId);

    let sharedEvents: any[] = [];
    if (shares && shares.length > 0) {
      const sharedCalIds = shares.map(s => s.calendar_id);
      shares.forEach(s => {
        const cal = s.calendars as any;
        if (cal) calendarMap.set(s.calendar_id, { name: cal.name, color: cal.color });
      });

      const { data: sEvents } = await ctx.supabase
        .from('calendar_events')
        .select(`
          id, title, start_time, end_time, location, description,
          video_conference_url, all_day, status, color,
          calendar_id, etablissement_id, recurrence_rule,
          etablissements:etablissement_id (id, nom)
        `)
        .in('calendar_id', sharedCalIds)
        .gte('end_time', dateFrom)
        .lte('start_time', dateTo)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true })
        .limit(100);

      sharedEvents = sEvents || [];
    }

    // 4. Merge and deduplicate
    const allEvents = [...(events || []), ...sharedEvents];
    const seen = new Set<string>();
    const uniqueEvents = allEvents.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Sort by start_time
    uniqueEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // 5. Enrich with calendar info and format
    const enrichedEvents = uniqueEvents.map(e => {
      const cal = calendarMap.get(e.calendar_id);
      return {
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        all_day: e.all_day || false,
        location: e.location || null,
        description: e.description || null,
        video_conference_url: e.video_conference_url || null,
        recurrence_rule: e.recurrence_rule || null,
        color: e.color || cal?.color || null,
        calendar: cal ? { name: cal.name, color: cal.color } : null,
        etablissement: (e.etablissements as any)?.nom ? { id: (e.etablissements as any).id, nom: (e.etablissements as any).nom } : null,
      };
    });

    // 6. Group by day for readability
    const byDay: Record<string, typeof enrichedEvents> = {};
    for (const evt of enrichedEvents) {
      const day = evt.start_time.substring(0, 10); // YYYY-MM-DD
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(evt);
    }

    return {
      success: true,
      data: {
        events: enrichedEvents,
        by_day: byDay,
        total: enrichedEvents.length,
        calendars_used: calendars.map(c => ({ id: c.id, name: c.name, color: c.color })),
        period: { from: dateFrom, to: dateTo },
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch calendar events', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateRecurringEvent(ctx: ToolContext, args: { title: string; start_time: string; end_time: string; recurrence_rule: string; location?: string; description?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: calendar } = await ctx.supabase.from('calendars').select('id').eq('owner_id', ctx.userId).eq('is_default', true).single();
    if (!calendar) throw new Error('No default calendar found');
    const { data, error } = await ctx.supabase.from('calendar_events').insert({ calendar_id: calendar.id, title: args.title, start_time: args.start_time, end_time: args.end_time, recurrence_rule: args.recurrence_rule, location: args.location, description: args.description, created_by: ctx.userId, status: 'confirmed' }).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Événement récurrent créé: ${args.title}`, event: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create recurring event', execution_time_ms: Date.now() - start };
  }
}

export async function executeDetectCalendarConflicts(ctx: ToolContext, args: { user_id?: string; date_from: string; date_to: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const targetUserId = args.user_id || ctx.userId;
    const { data: events } = await ctx.supabase.from('calendar_events').select('id, title, start_time, end_time').eq('created_by', targetUserId).gte('start_time', args.date_from).lte('end_time', args.date_to).order('start_time', { ascending: true });
    if (!events || events.length < 2) return { success: true, data: { has_conflicts: false, conflicts: [], events_checked: events?.length || 0 }, execution_time_ms: Date.now() - start };
    const conflicts: Array<{ event1: typeof events[0]; event2: typeof events[0] }> = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1Start = new Date(events[i].start_time).getTime(), e1End = new Date(events[i].end_time).getTime();
        const e2Start = new Date(events[j].start_time).getTime(), e2End = new Date(events[j].end_time).getTime();
        if (e1Start < e2End && e1End > e2Start) conflicts.push({ event1: events[i], event2: events[j] });
      }
    }
    return { success: true, data: { has_conflicts: conflicts.length > 0, conflicts: conflicts.map(c => ({ event1: { id: c.event1.id, title: c.event1.title }, event2: { id: c.event2.id, title: c.event2.title } })), events_checked: events.length }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Conflict detection failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeImportIcsCalendar(ctx: ToolContext, args: { ics_content: string; calendar_id?: string }): Promise<ToolResult> {
  const start = Date.now();
  return { success: true, data: { message: 'ICS import requires ICS parser integration', content_length: args.ics_content.length }, execution_time_ms: Date.now() - start };
}

export async function executeSyncExternalCalendar(ctx: ToolContext, args: { provider: string; action: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list_subscriptions': {
        const { data, error } = await ctx.supabase
          .from('calendar_subscriptions')
          .select('id, name, url, is_active, last_sync_at, last_sync_status')
          .eq('user_id', ctx.userId);
        if (error) throw error;
        return { success: true, data: { subscriptions: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'sync_now': {
        // Déclencher la synchronisation via la fonction sync-calendar-subscriptions
        const { data, error } = await ctx.supabase.functions.invoke('sync-calendar-subscriptions', {
          body: { user_id: ctx.userId }
        });
        if (error) throw error;
        return { success: true, data: { message: 'Synchronisation lancée', result: data }, execution_time_ms: Date.now() - start };
      }
      case 'add_subscription': {
        // Requires url parameter - inform user
        return { success: true, data: { message: 'Pour ajouter un abonnement, utilisez le formulaire calendrier ou précisez l\'URL ICS' }, execution_time_ms: Date.now() - start };
      }
      case 'check_status': {
        const { data } = await ctx.supabase
          .from('calendar_subscriptions')
          .select('name, last_sync_at, last_sync_status')
          .eq('user_id', ctx.userId)
          .order('last_sync_at', { ascending: false })
          .limit(5);
        return { 
          success: true, 
          data: { 
            message: `${data?.length || 0} abonnement(s) configuré(s)`,
            recent_syncs: data 
          }, 
          execution_time_ms: Date.now() - start 
        };
      }
      default:
        return { success: true, data: { message: `Action '${args.action}' non reconnue. Actions disponibles: list_subscriptions, sync_now, check_status` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Calendar sync failed', execution_time_ms: Date.now() - start };
  }
}
