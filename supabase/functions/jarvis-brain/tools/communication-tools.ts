/**
 * JARVIS 12.0 - Communication Tools
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeTranslateEmail(ctx: ToolContext, args: { content: string; target_language: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('translate-email', { body: { content: args.content, target_language: args.target_language } });
    if (error) throw error;
    return { success: true, data: { translated_content: data?.translated || data?.result, target_language: args.target_language }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Translation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCorrectEmail(ctx: ToolContext, args: { content: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('correct-spelling-email', { body: { content: args.content } });
    if (error) throw error;
    return { success: true, data: { corrected_content: data?.corrected || data?.result, corrections_count: data?.corrections_count || 0 }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Correction failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeReformulateEmail(ctx: ToolContext, args: { content: string; tone?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.functions.invoke('reformulate-email', { body: { content: args.content, tone: args.tone || 'professional' } });
    if (error) throw error;
    return { success: true, data: { reformulated_content: data?.reformulated || data?.result, tone: args.tone || 'professional' }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reformulation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeSuggestEmailResponse(ctx: ToolContext, args: { thread_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: messages } = await ctx.supabase.from('email_messages').select('from_address, subject, body_text').eq('thread_id', args.thread_id).order('sent_at', { ascending: true }).limit(10);
    if (!messages?.length) throw new Error('No messages found in thread');
    const { data, error } = await ctx.supabase.functions.invoke('suggest-email-content', { body: { thread_id: args.thread_id, context: messages } });
    if (error) throw error;
    return { success: true, data: { suggested_response: data?.suggestion || data?.result, based_on_messages: messages.length }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Suggestion failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateEmailTemplate(ctx: ToolContext, args: { name: string; subject: string; body: string; variables?: string[]; category?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase
      .from('email_templates')
      .insert([{
        name: args.name,
        subject: args.subject,
        content: args.body,
        variables: args.variables || [],
        category: args.category || null,
        is_active: true,
        created_by: ctx.userId,
      }])
      .select()
      .single();
    if (error) throw error;
    return { success: true, data: { message: 'Template email créé avec succès', template: data }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create email template', execution_time_ms: Date.now() - start };
  }
}
