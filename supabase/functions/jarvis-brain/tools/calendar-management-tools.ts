/**
 * JARVIS 15.1 - Calendar Management Tools (CRUD complet)
 * Validation UUID + logging
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; authUserId?: string; }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUUID(value: unknown, label: string): string {
  if (!value || typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`${label} invalide ou manquant: "${value}"`);
  }
  return value;
}

export async function executeUpdateCalendarEvent(ctx: ToolContext, args: { event_id: string; data: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const id = assertUUID(args.event_id, 'event_id');
    if (!args.data || Object.keys(args.data).length === 0) throw new Error('Aucune donnée de mise à jour fournie');
    console.log(`[update_calendar_event] Updating ${id}`);
    const { data, error } = await ctx.supabase.from('calendar_events').update(args.data).eq('id', id).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Événement "${data.title}" mis à jour`, event: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    console.error('[update_calendar_event] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update event failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeDeleteCalendarEvent(ctx: ToolContext, args: { event_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const id = assertUUID(args.event_id, 'event_id');
    const { data: existing } = await ctx.supabase.from('calendar_events').select('title').eq('id', id).single();
    console.log(`[delete_calendar_event] Deleting: ${existing?.title || id}`);
    const { error } = await ctx.supabase.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
    return { success: true, data: { message: `Événement "${existing?.title || id}" supprimé` }, execution_time_ms: Date.now() - start };
  } catch (error) {
    console.error('[delete_calendar_event] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete event failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageEventAttendees(ctx: ToolContext, args: { action: string; event_id: string; attendee_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('event_attendees').select('*').eq('event_id', args.event_id);
        if (error) throw error;
        return { success: true, data: { attendees: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'add': {
        const { data, error } = await ctx.supabase.from('event_attendees').insert({ event_id: args.event_id, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Participant ajouté', attendee: data }, execution_time_ms: Date.now() - start };
      }
      case 'remove': {
        if (!args.attendee_id) throw new Error('attendee_id required');
        const { error } = await ctx.supabase.from('event_attendees').delete().eq('id', args.attendee_id);
        if (error) throw error;
        return { success: true, data: { message: 'Participant retiré' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Attendee operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageEventReminder(ctx: ToolContext, args: { action: string; event_id?: string; reminder_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        if (!args.event_id) throw new Error('event_id required');
        const { data, error } = await ctx.supabase.from('event_reminders').select('*').eq('event_id', args.event_id);
        if (error) throw error;
        return { success: true, data: { reminders: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        if (!args.event_id) throw new Error('event_id required');
        const { data, error } = await ctx.supabase.from('event_reminders').insert({ event_id: args.event_id, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Rappel créé', reminder: data }, execution_time_ms: Date.now() - start };
      }
      case 'delete': {
        if (!args.reminder_id) throw new Error('reminder_id required');
        const { error } = await ctx.supabase.from('event_reminders').delete().eq('id', args.reminder_id);
        if (error) throw error;
        return { success: true, data: { message: 'Rappel supprimé' }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reminder operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageBooking(ctx: ToolContext, args: { action: string; booking_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('bookings').select('*, booking_types(name)').eq('host_user_id', ctx.authUserId || ctx.userId).order('start_time', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { bookings: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'cancel': {
        if (!args.booking_id) throw new Error('booking_id required');
        const reason = (args.data as Record<string, unknown>)?.reason as string;
        const { data, error } = await ctx.supabase.from('bookings').update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString(), cancelled_by: ctx.authUserId || ctx.userId }).eq('id', args.booking_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Réservation annulée', booking: data }, execution_time_ms: Date.now() - start };
      }
      case 'confirm': {
        if (!args.booking_id) throw new Error('booking_id required');
        const { data, error } = await ctx.supabase.from('bookings').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', args.booking_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Réservation confirmée', booking: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Booking operation failed', execution_time_ms: Date.now() - start };
  }
}
