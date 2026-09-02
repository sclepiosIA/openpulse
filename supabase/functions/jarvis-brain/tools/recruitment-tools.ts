/**
 * JARVIS 12.0 - Recruitment Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeManageJobOffer(ctx: ToolContext, args: { action: string; offer_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('job_offers').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        return { success: true, data: { offers: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('job_offers').insert({ ...args.data, status: 'draft', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Offre créée', offer: data }, execution_time_ms: Date.now() - start };
      }
      case 'publish': {
        if (!args.offer_id) throw new Error('offer_id required');
        const { data, error } = await ctx.supabase.from('job_offers').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', args.offer_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Offre publiée', offer: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Job offer operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeManageCandidate(ctx: ToolContext, args: { action: string; candidate_id?: string; data?: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    switch (args.action) {
      case 'list': {
        const { data, error } = await ctx.supabase.from('candidates').select('*, job_offers(titre)').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return { success: true, data: { candidates: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
      }
      case 'create': {
        const { data, error } = await ctx.supabase.from('candidates').insert({ ...args.data, stage: 'new', created_by: ctx.userId }).select().single();
        if (error) throw error;
        return { success: true, data: { message: 'Candidat ajouté', candidate: data }, execution_time_ms: Date.now() - start };
      }
      case 'advance_stage': {
        if (!args.candidate_id) throw new Error('candidate_id required');
        const stageOrder = ['new', 'screening', 'interview', 'technical', 'offer', 'hired'];
        const { data: current } = await ctx.supabase.from('candidates').select('stage').eq('id', args.candidate_id).single();
        const nextStage = stageOrder[Math.min(stageOrder.indexOf(current?.stage || 'new') + 1, stageOrder.length - 1)];
        const { data, error } = await ctx.supabase.from('candidates').update({ stage: nextStage }).eq('id', args.candidate_id).select().single();
        if (error) throw error;
        return { success: true, data: { message: `Candidat avancé: ${nextStage}`, candidate: data }, execution_time_ms: Date.now() - start };
      }
      default:
        return { success: true, data: { message: `Action ${args.action} not implemented` }, execution_time_ms: Date.now() - start };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Candidate operation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeScheduleInterview(ctx: ToolContext, args: { candidate_id: string; interviewer_ids: string[]; datetime: string; interview_type?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: candidate } = await ctx.supabase.from('candidates').select('nom, prenom').eq('id', args.candidate_id).single();
    const { data: interview, error } = await ctx.supabase.from('interviews').insert({ candidate_id: args.candidate_id, scheduled_at: args.datetime, type: args.interview_type || 'video', status: 'scheduled', created_by: ctx.userId }).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Entretien planifié le ${new Date(args.datetime).toLocaleDateString('fr-FR')}`, interview, candidate_name: `${candidate?.prenom || ''} ${candidate?.nom || ''}` }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to schedule interview', execution_time_ms: Date.now() - start };
  }
}

export async function executeEvaluateCandidate(ctx: ToolContext, args: { candidate_id: string; interview_id?: string; criteria?: Record<string, number>; recommendation: string; comments?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('candidate_evaluations').insert({ candidate_id: args.candidate_id, interview_id: args.interview_id, evaluator_id: ctx.userId, criteres: args.criteria || {}, recommendation: args.recommendation, commentaire_general: args.comments }).select().single();
    if (error) throw error;
    return { success: true, data: { message: `Évaluation ajoutée: ${args.recommendation}`, evaluation: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add evaluation', execution_time_ms: Date.now() - start };
  }
}

export async function executeParseCV(ctx: ToolContext, args: { storage_path: string; candidate_id?: string }): Promise<ToolResult> {
  const start = Date.now();
  return { success: true, data: { message: 'CV parsing requires document AI integration', storage_path: args.storage_path }, execution_time_ms: Date.now() - start };
}

export async function executeGetCandidateHistory(ctx: ToolContext, args: { candidate_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.from('candidate_history').select('*').eq('candidate_id', args.candidate_id).order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: { history: data, count: data?.length || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Candidate history failed', execution_time_ms: Date.now() - start };
  }
}
