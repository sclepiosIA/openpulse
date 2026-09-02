/**
 * JARVIS 12.0 - Support Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeCreateSupportTicket(ctx: ToolContext, args: { titre: string; description: string; priority?: string; etablissement_id?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('support_tickets').insert({ titre: args.titre, description: args.description, priority: args.priority || 'medium', etablissement_id: args.etablissement_id, status: 'open', created_by: ctx.userId }).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Ticket #${data.id.slice(0, 8)} créé`, ticket: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create ticket', execution_time_ms: Date.now() - start };
  }
}

export async function executeUpdateTicketStatus(ctx: ToolContext, args: { ticket_id: string; status: string; resolution_note?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const updateData: Record<string, unknown> = { status: args.status };
    if (['resolved', 'closed'].includes(args.status)) { updateData.resolved_at = new Date().toISOString(); updateData.resolved_by = ctx.userId; }
    if (args.resolution_note) updateData.resolution_note = args.resolution_note;
    const { data, error } = await ctx.supabase.from('support_tickets').update(updateData).eq('id', args.ticket_id).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Ticket mis à jour: ${args.status}`, ticket: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update ticket', execution_time_ms: Date.now() - start };
  }
}

export async function executeAssignTicket(ctx: ToolContext, args: { ticket_id: string; agent_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: agent } = await ctx.supabase.from('profiles').select('nom, prenom').eq('id', args.agent_id).single();
    const { data, error } = await ctx.supabase.from('support_tickets').update({ assigned_to: args.agent_id, status: 'in_progress' }).eq('id', args.ticket_id).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Ticket assigné à ${agent?.prenom || ''} ${agent?.nom || ''}`, ticket: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to assign ticket', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetSupportKpis(ctx: ToolContext, args: { period?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodStart = args.period ? new Date(args.period) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const { data: tickets } = await ctx.supabase.from('support_tickets').select('id, status, priority, created_at, resolved_at').gte('created_at', periodStart.toISOString());
    if (!tickets) return { success: true, data: { message: 'No tickets found' }, execution_time_ms: Date.now() - start };
    const total = tickets.length;
    const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
    const resolvedTickets = tickets.filter(t => t.resolved_at);
    const avgMs = resolvedTickets.length > 0 ? resolvedTickets.reduce((sum, t) => sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0) / resolvedTickets.length : 0;
    return { success: true, data: { total_tickets: total, resolved_tickets: resolved, resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0, avg_resolution_time_hours: Math.round(avgMs / (1000 * 60 * 60) * 10) / 10 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get KPIs', execution_time_ms: Date.now() - start };
  }
}
