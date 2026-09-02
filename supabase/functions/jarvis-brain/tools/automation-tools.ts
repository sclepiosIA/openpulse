/**
 * JARVIS 12.0 - Automation & Workflow Tools
 * 
 * Rappels, tâches programmées, règles d'automatisation
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeCreateReminder(ctx: ToolContext, args: { 
  title: string; 
  remind_at: string; 
  entity_type?: string; 
  entity_id?: string;
  repeat?: string;
  notify_via?: string[];
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const reminderDate = new Date(args.remind_at);
    if (reminderDate <= new Date()) {
      return { success: false, error: 'La date de rappel doit être dans le futur', execution_time_ms: Date.now() - start };
    }

    // Créer une notification programmée
    const { data, error } = await ctx.supabase.from('notifications').insert({
      user_id: ctx.userId,
      type: 'reminder',
      titre: `⏰ Rappel: ${args.title}`,
      message: args.entity_type ? `Concernant: ${args.entity_type} ${args.entity_id}` : args.title,
      lien: args.entity_id ? `/${args.entity_type}s/${args.entity_id}` : null,
      metadata: {
        remind_at: args.remind_at,
        repeat: args.repeat,
        entity_type: args.entity_type,
        entity_id: args.entity_id,
        notify_via: args.notify_via || ['app'],
        created_by_jarvis: true
      },
      est_lu: false
    }).select().single();

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Rappel programmé pour le ${reminderDate.toLocaleDateString('fr-FR')} à ${reminderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        reminder: data,
        remind_at: args.remind_at
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reminder creation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateAutomationRule(ctx: ToolContext, args: {
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active?: boolean;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const validTriggers = ['new_email', 'task_overdue', 'ticket_created', 'status_changed', 'time_based'];
    const validActions = ['send_notification', 'create_task', 'send_email', 'update_status', 'assign_to'];

    if (!validTriggers.includes(args.trigger_type)) {
      return { success: false, error: `Trigger invalide. Valides: ${validTriggers.join(', ')}`, execution_time_ms: Date.now() - start };
    }
    if (!validActions.includes(args.action_type)) {
      return { success: false, error: `Action invalide. Valides: ${validActions.join(', ')}`, execution_time_ms: Date.now() - start };
    }

    // Stocker la règle d'automatisation
    const { data, error } = await ctx.supabase.from('user_preferences').insert({
      user_id: ctx.userId,
      preference_key: `automation_rule_${Date.now()}`,
      preference_value: JSON.stringify({
        name: args.name,
        trigger: { type: args.trigger_type, config: args.trigger_config },
        action: { type: args.action_type, config: args.action_config },
        is_active: args.is_active !== false,
        created_at: new Date().toISOString(),
        created_by: ctx.userId
      })
    }).select().single();

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Règle "${args.name}" créée (${args.trigger_type} → ${args.action_type})`,
        rule: {
          id: data.id,
          name: args.name,
          trigger: args.trigger_type,
          action: args.action_type,
          is_active: args.is_active !== false
        }
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Rule creation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeListAutomationRules(ctx: ToolContext, args: { active_only?: boolean }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', ctx.userId)
      .like('preference_key', 'automation_rule_%');

    if (error) throw error;

    const rules = (data || []).map(d => {
      try {
        const parsed = JSON.parse(d.preference_value);
        return { id: d.id, ...parsed };
      } catch {
        return null;
      }
    }).filter(Boolean);

    const filtered = args.active_only 
      ? rules.filter(r => r.is_active) 
      : rules;

    return { 
      success: true, 
      data: { 
        rules: filtered,
        count: filtered.length,
        active_count: rules.filter(r => r.is_active).length
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'List rules failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeToggleAutomationRule(ctx: ToolContext, args: { rule_id: string; is_active: boolean }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data: existing, error: fetchError } = await ctx.supabase
      .from('user_preferences')
      .select('*')
      .eq('id', args.rule_id)
      .eq('user_id', ctx.userId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: 'Règle non trouvée', execution_time_ms: Date.now() - start };
    }

    const parsed = JSON.parse(existing.preference_value);
    parsed.is_active = args.is_active;
    parsed.updated_at = new Date().toISOString();

    const { error } = await ctx.supabase
      .from('user_preferences')
      .update({ preference_value: JSON.stringify(parsed) })
      .eq('id', args.rule_id);

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Règle "${parsed.name}" ${args.is_active ? 'activée' : 'désactivée'}`,
        rule_id: args.rule_id,
        is_active: args.is_active
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Toggle failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateScheduledTask(ctx: ToolContext, args: {
  title: string;
  description?: string;
  schedule: string; // cron expression or 'daily', 'weekly', 'monthly'
  task_template?: Record<string, unknown>;
  next_run?: string;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Calculer la prochaine exécution
    let nextRun = args.next_run ? new Date(args.next_run) : new Date();
    
    if (!args.next_run) {
      switch (args.schedule) {
        case 'daily': nextRun.setDate(nextRun.getDate() + 1); nextRun.setHours(9, 0, 0, 0); break;
        case 'weekly': nextRun.setDate(nextRun.getDate() + (7 - nextRun.getDay() + 1) % 7 + 1); nextRun.setHours(9, 0, 0, 0); break;
        case 'monthly': nextRun.setMonth(nextRun.getMonth() + 1); nextRun.setDate(1); nextRun.setHours(9, 0, 0, 0); break;
      }
    }

    const { data, error } = await ctx.supabase.from('user_preferences').insert({
      user_id: ctx.userId,
      preference_key: `scheduled_task_${Date.now()}`,
      preference_value: JSON.stringify({
        title: args.title,
        description: args.description,
        schedule: args.schedule,
        task_template: args.task_template,
        next_run: nextRun.toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
        last_run: null,
        run_count: 0
      })
    }).select().single();

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Tâche programmée "${args.title}" créée (${args.schedule})`,
        scheduled_task: {
          id: data.id,
          title: args.title,
          schedule: args.schedule,
          next_run: nextRun.toISOString()
        }
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Scheduled task creation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetAutomationStats(ctx: ToolContext, args: { period_days?: number }): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Récupérer les règles de l'utilisateur
    const { data: rules } = await ctx.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', ctx.userId)
      .like('preference_key', 'automation_rule_%');

    const parsedRules = (rules || []).map(r => {
      try { return JSON.parse(r.preference_value); } catch { return null; }
    }).filter(Boolean);

    // Récupérer les rappels
    const { data: reminders } = await ctx.supabase
      .from('notifications')
      .select('id, metadata')
      .eq('user_id', ctx.userId)
      .eq('type', 'reminder');

    return { 
      success: true, 
      data: {
        total_rules: parsedRules.length,
        active_rules: parsedRules.filter(r => r.is_active).length,
        rules_by_trigger: parsedRules.reduce((acc: Record<string, number>, r) => {
          acc[r.trigger?.type || 'unknown'] = (acc[r.trigger?.type || 'unknown'] || 0) + 1;
          return acc;
        }, {}),
        pending_reminders: reminders?.length || 0,
        automation_health: parsedRules.length > 0 ? 'configured' : 'no_rules'
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Stats failed', execution_time_ms: Date.now() - start };
  }
}
