/**
 * jarvis-auto-actions - Exécution automatique d'actions basées sur les patterns
 * 
 * JARVIS 6.0: Détecte les patterns d'usage et exécute automatiquement
 * des actions récurrentes selon le niveau d'autonomie configuré
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Niveaux d'autonomie
// 0 = Off, 1 = Suggest, 2 = Safe, 3 = Moderate, 4 = Full
const AUTONOMY_LEVELS = {
  OFF: 0,
  SUGGEST: 1,
  SAFE: 2,
  MODERATE: 3,
  FULL: 4,
} as const;

// Actions par niveau d'autonomie
const ACTIONS_BY_LEVEL: Record<number, string[]> = {
  [AUTONOMY_LEVELS.OFF]: [],
  [AUTONOMY_LEVELS.SUGGEST]: ['notification', 'suggestion'],
  [AUTONOMY_LEVELS.SAFE]: ['archive_email', 'reminder', 'tag_thread', 'mark_read'],
  [AUTONOMY_LEVELS.MODERATE]: ['send_reminder', 'create_task', 'update_status'],
  [AUTONOMY_LEVELS.FULL]: ['send_email', 'create_meeting', 'update_etablissement'],
};

interface AutoActionConfig {
  userId: string;
  autonomyLevel: number;
  enabledActions: string[];
  schedule?: {
    briefingTime?: string; // HH:MM
    reminderDays?: number[];
  };
}

interface PatternMatch {
  patternId: string;
  actionType: string;
  actionData: Record<string, unknown>;
  confidence: number;
}

/**
 * Vérifie si une action peut être exécutée au niveau d'autonomie donné
 */
function canExecuteAction(actionType: string, autonomyLevel: number): boolean {
  for (let level = autonomyLevel; level >= 0; level--) {
    if (ACTIONS_BY_LEVEL[level]?.includes(actionType)) {
      return true;
    }
  }
  return false;
}

/**
 * Détecte les patterns qui correspondent à l'heure actuelle
 */
async function detectTimeBasedPatterns(
  supabase: any,
  userId: string
): Promise<PatternMatch[]> {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDay = now.getDay();

  // Chercher les patterns de timing
  const { data: patterns, error } = await supabase
    .from('jarvis_usage_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_type', 'timing')
    .gte('confidence', 0.7)
    .order('confidence', { ascending: false })
    .limit(10);

  if (error || !patterns) return [];

  const matches: PatternMatch[] = [];

  for (const pattern of patterns) {
    const data = pattern.pattern_data;
    
    // Check if pattern matches current time (±15 minutes)
    if (data.hour !== undefined && data.minute !== undefined) {
      const patternMinutes = data.hour * 60 + data.minute;
      const currentMinutes = currentHour * 60 + currentMinute;
      const diff = Math.abs(patternMinutes - currentMinutes);
      
      if (diff <= 15) {
        // Check day of week if specified
        if (!data.days_of_week || data.days_of_week.includes(currentDay)) {
          matches.push({
            patternId: pattern.id,
            actionType: data.action_type || 'notification',
            actionData: data.action_data || {},
            confidence: pattern.confidence,
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Exécute une action automatique
 */
async function executeAutoAction(
  supabase: any,
  userId: string,
  match: PatternMatch,
  autonomyLevel: number
): Promise<{ success: boolean; result?: any; error?: string }> {
  const { actionType, actionData, patternId } = match;

  // Vérifier si l'action peut être exécutée
  if (!canExecuteAction(actionType, autonomyLevel)) {
    return { 
      success: false, 
      error: `Action "${actionType}" not allowed at autonomy level ${autonomyLevel}` 
    };
  }

  let result: any = null;

  try {
    switch (actionType) {
      case 'notification':
        // Envoyer une notification push
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId,
            title: actionData.title || 'Rappel Jarvis',
            body: actionData.body || 'Action automatique déclenchée',
          },
        });
        result = { notified: true };
        break;

      case 'suggestion':
        // Créer une alerte proactive
        await supabase.from('jarvis_proactive_alerts').insert({
          user_id: userId,
          alert_type: 'suggestion',
          title: actionData.title,
          message: actionData.message,
          priority: 'low',
          context_data: actionData,
        });
        result = { suggested: true };
        break;

      case 'reminder':
        // Créer un rappel de tâche
        const { data: reminderTask } = await supabase
          .from('taches')
          .insert({
            titre: actionData.title || 'Rappel automatique',
            description: actionData.description,
            assigned_to: userId,
            echeance: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            statut: 'a_faire',
            priorite: 'normale',
          })
          .select()
          .single();
        result = { taskId: reminderTask?.id };
        break;

      case 'briefing':
        // Déclencher le briefing du jour
        const { data: briefing } = await supabase.functions.invoke('jarvis-team-standup', {
          body: { userId },
        });
        result = briefing;
        break;

      case 'archive_email':
        // Archiver automatiquement des emails
        if (actionData.threadIds) {
          await supabase
            .from('email_threads')
            .update({ is_archived: true })
            .in('id', actionData.threadIds);
          result = { archived: actionData.threadIds.length };
        }
        break;

      default:
        return { success: false, error: `Unknown action type: ${actionType}` };
    }

    // Log l'action exécutée
    await supabase.from('jarvis_auto_actions').insert({
      user_id: userId,
      agent_id: 'prime',
      action_type: actionType,
      action_data: actionData,
      trigger_pattern_id: patternId,
      status: 'executed',
      result,
    });

    return { success: true, result };

  } catch (error: unknown) {
    console.error('[jarvis-auto-actions] Execution error:', error);
    
    // Log l'échec
    await supabase.from('jarvis_auto_actions').insert({
      user_id: userId,
      agent_id: 'prime',
      action_type: actionType,
      action_data: actionData,
      trigger_pattern_id: patternId,
      status: 'failed',
      result: { error: error.message },
    });

    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les users actifs avec autonomie > 0
    const { data: configs } = await supabase
      .from('jarvis_user_config')
      .select('user_id, autonomy_level, enabled_actions, schedule_config')
      .gt('autonomy_level', 0);

    const results: Array<{ userId: string; executed: number; failed: number }> = [];

    for (const cfg of configs || []) {
      const matches = await detectTimeBasedPatterns(supabase, cfg.user_id);
      let executed = 0;
      let failed = 0;
      for (const m of matches) {
        const r = await executeAutoAction(supabase, cfg.user_id, m, cfg.autonomy_level);
        if (r.success) executed++; else failed++;
      }
      results.push({ userId: cfg.user_id, executed, failed });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[jarvis-auto-actions] Fatal error:', error);
    return buildErrorResponse('jarvis-auto-actions', error, corsHeaders, 500);
  }
});

