/**
 * JARVIS 12.0 - Training Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeCreateTrainingSession(ctx: ToolContext, args: { etablissement_id: string; module: string; date: string; formateur_id?: string; participants?: string[] }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: session, error } = await ctx.supabase.from('sessions_formation').insert({ etablissement_id: args.etablissement_id, module: args.module, date_session: args.date, formateur_id: args.formateur_id || ctx.userId, statut: 'planifiee', created_by: ctx.userId }).select().single();
    if (error) throw error;
    if (args.participants?.length) {
      await ctx.supabase.from('emargements').insert(args.participants.map(p => ({ session_id: session.id, participant_id: p })));
    }
    return { success: true, data: { message: `Session créée pour le ${new Date(args.date).toLocaleDateString('fr-FR')}`, session, participants_count: args.participants?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create session', execution_time_ms: Date.now() - start };
  }
}

export async function executeRegisterAttendance(ctx: ToolContext, args: { session_id: string; participant_id: string; signature?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: existing } = await ctx.supabase.from('emargements').select('id').eq('session_id', args.session_id).eq('participant_id', args.participant_id).single();
    if (existing) {
      const { data, error } = await ctx.supabase.from('emargements').update({ est_present: true, signature: args.signature, signed_at: new Date().toISOString() }).eq('id', existing.id).select().single();
      if (error) throw error;
      return { success: true, data: { message: 'Présence enregistrée', emargement: data }, execution_time_ms: Date.now() - start };
    } else {
      const { data, error } = await ctx.supabase.from('emargements').insert({ session_id: args.session_id, participant_id: args.participant_id, est_present: true, signature: args.signature, signed_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      return { success: true, data: { message: 'Présence enregistrée', emargement: data }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to register attendance', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetSessionAttendance(ctx: ToolContext, args: { session_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: emargements, error } = await ctx.supabase.from('emargements').select('*, profiles(nom, prenom, email)').eq('session_id', args.session_id);
    if (error) throw error;
    const present = emargements?.filter(e => e.est_present) || [];
    return { success: true, data: { session_id: args.session_id, total_participants: emargements?.length || 0, present_count: present.length, attendance_rate: emargements?.length ? Math.round((present.length / emargements.length) * 100) : 0, participants: emargements }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get attendance', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetTrainingAnalytics(ctx: ToolContext, args: { etablissement_id?: string; period?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    let query = ctx.supabase.from('sessions_formation').select('*, emargements(est_present)');
    if (args.etablissement_id) query = query.eq('etablissement_id', args.etablissement_id);
    if (args.period) query = query.gte('date_session', new Date(args.period).toISOString());
    const { data: sessions, error } = await query;
    if (error) throw error;
    let totalParticipants = 0, totalPresent = 0;
    const byModule: Record<string, number> = {};
    for (const session of sessions || []) {
      const module = session.module || 'unknown';
      byModule[module] = (byModule[module] || 0) + 1;
      const emargements = session.emargements || [];
      totalParticipants += emargements.length;
      totalPresent += emargements.filter((e: { est_present: boolean }) => e.est_present).length;
    }
    return { success: true, data: { total_sessions: sessions?.length || 0, total_participants: totalParticipants, total_present: totalPresent, by_module: byModule, average_attendance_rate: totalParticipants > 0 ? Math.round((totalPresent / totalParticipants) * 100) : 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get analytics', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageCertification(ctx: ToolContext, args: { action: string; profile_id: string; certification?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('employee_certifications').select('*').eq('profile_id', args.profile_id);
        if (error) throw error;
        return { success: true, data: { certifications: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'add': {
        const { data, error } = await ctx.supabase.from('employee_certifications').insert({ profile_id: args.profile_id, nom: args.certification, ...args.data }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Certification ajoutée', certification: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Certification operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeSendSatisfactionSurvey(ctx: ToolContext, args: { session_id: string; type: string; participant_ids?: string[] }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const table = args.type === 'solution' ? 'enquetes_satisfaction_solution' : 'enquetes_satisfaction_formation';
    if (args.participant_ids?.length) {
      const inserts = args.participant_ids.map(pid => ({ session_id: args.session_id, participant_id: pid, statut: 'envoyee' }));
      const { error } = await ctx.supabase.from(table).insert(inserts);
      if (error) throw error;
    }
    return { success: true, data: { message: `Enquêtes envoyées à ${args.participant_ids?.length || 0} participants`, type: args.type }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Survey send failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetSatisfactionResults(ctx: ToolContext, args: { session_id?: string; type?: string; etablissement_id?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const table = args.type === 'solution' ? 'enquetes_satisfaction_solution' : 'enquetes_satisfaction_formation';
    let query = ctx.supabase.from(table).select('*');
    if (args.session_id) query = query.eq('session_id', args.session_id);
    if (args.etablissement_id) query = query.eq('etablissement_id', args.etablissement_id);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return { success: true, data: { results: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Satisfaction results failed', execution_time_ms: Date.now() - start };
  }
}
