/**
 * JARVIS 9.0 - Moteur d'intelligence prédictive avancée
 * 
 * Analyse les patterns d'utilisation pour anticiper les actions :
 * - Modélisation comportementale utilisateur
 * - Séquences d'actions détectées automatiquement
 * - Prédictions basées sur le contexte (heure, jour, page)
 * - Pré-chargement intelligent du contexte
 * - Apprentissage continu des préférences
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { 
  buildUserBehaviorProfile, 
  predictNextActions,
  saveUserBehaviorProfile,
  detectActionSequences 
} from "./behavior-model.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface ActionPattern {
  action_type: string;
  day_of_week?: number; // 0-6
  hour_of_day?: number; // 0-23
  frequency: number;
  last_performed?: string;
  context?: Record<string, unknown>;
}

interface Prediction {
  action_type: string;
  description: string;
  confidence: number; // 0-1
  suggested_time?: string;
  context?: Record<string, unknown>;
  reason: string;
}

interface UserBehaviorStats {
  total_actions: number;
  most_common_actions: { action: string; count: number }[];
  peak_hours: number[];
  peak_days: number[];
  recent_patterns: ActionPattern[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user from auth
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const profileId = profile.id;
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // 1. Analyser l'historique des conversations Jarvis (30 derniers jours)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: conversations } = await supabase
      .from('jarvis_conversations')
      .select('id, messages, created_at, metadata')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    // 2. Analyser les actions exécutées via jarvis_action_log (si existe)
    const { data: actionLogs } = await supabase
      .from('ai_processing_log')
      .select('processing_type, processed_at, result, context_type')
      .eq('processed_by', profileId)
      .gte('processed_at', thirtyDaysAgo)
      .order('processed_at', { ascending: false })
      .limit(500);

    // 3. Analyser les tâches créées/complétées
    const { data: taskHistory } = await supabase
      .from('taches')
      .select('id, created_at, date_validation, categorie_id, priorite')
      .or(`created_by.eq.${profileId},responsable_id.eq.${profileId}`)
      .gte('created_at', thirtyDaysAgo)
      .limit(200);

    // 4. Construire les statistiques de comportement
    const behaviorStats = analyzeBehavior(conversations || [], actionLogs || [], taskHistory || []);

    // 5. Générer les prédictions
    const predictions = generatePredictions(behaviorStats, currentHour, currentDay, now);

    // 6. Enrichir avec le contexte actuel
    const enrichedPredictions = await enrichPredictions(supabase, profileId, predictions);

    // 7. Stocker les prédictions pour suivi
    if (enrichedPredictions.length > 0) {
      await supabase
        .from('jarvis_proactive_alerts')
        .upsert(
          enrichedPredictions.slice(0, 5).map((p, i) => ({
            id: `prediction-${profileId}-${now.toISOString().slice(0, 10)}-${i}`,
            user_id: profileId,
            type: 'prediction',
            priority: p.confidence > 0.8 ? 'high' : p.confidence > 0.5 ? 'medium' : 'low',
            title: `Suggestion: ${p.action_type}`,
            message: p.description,
            action_type: 'jarvis_command',
            action_data: { prediction: p },
            read: false,
            dismissed: false,
          })),
          { onConflict: 'id', ignoreDuplicates: false }
        );
    }

    return new Response(JSON.stringify({
      success: true,
      predictions: enrichedPredictions,
      behavior_stats: {
        total_actions: behaviorStats.total_actions,
        peak_hours: behaviorStats.peak_hours,
        peak_days: behaviorStats.peak_days,
        most_common_actions: behaviorStats.most_common_actions.slice(0, 5),
      },
      generated_at: now.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[predictive-engine] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: sanitizeErrorForClient(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function analyzeBehavior(
  conversations: any[],
  actionLogs: any[],
  taskHistory: any[]
): UserBehaviorStats {
  const actionCounts = new Map<string, number>();
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  const patterns: ActionPattern[] = [];

  // Analyser les conversations pour extraire les types d'actions
  for (const conv of conversations) {
    const createdAt = new Date(conv.created_at);
    hourCounts[createdAt.getHours()]++;
    dayCounts[createdAt.getDay()]++;

    // Extraire les types d'actions depuis les messages
    const messages = conv.messages as any[] || [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tool of msg.tool_calls) {
          const action = tool.function?.name || tool.name;
          if (action) {
            actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
          }
        }
      }
    }
  }

  // Analyser les logs d'actions
  for (const log of actionLogs) {
    const processedAt = new Date(log.processed_at);
    hourCounts[processedAt.getHours()]++;
    dayCounts[processedAt.getDay()]++;
    
    actionCounts.set(log.processing_type, (actionCounts.get(log.processing_type) || 0) + 1);
  }

  // Identifier les heures et jours de pointe
  const avgHour = hourCounts.reduce((a, b) => a + b, 0) / 24;
  const avgDay = dayCounts.reduce((a, b) => a + b, 0) / 7;
  
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > avgHour * 1.5)
    .map(h => h.hour);

  const peakDays = dayCounts
    .map((count, day) => ({ day, count }))
    .filter(d => d.count > avgDay * 1.2)
    .map(d => d.day);

  // Convertir en array trié
  const mostCommonActions = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // Détecter les patterns récurrents
  const weekdayMorningActions = analyzeTimeSlotActions(conversations, actionLogs, [8, 9, 10], [1, 2, 3, 4, 5]);
  const mondayActions = analyzeTimeSlotActions(conversations, actionLogs, undefined, [1]);
  const fridayActions = analyzeTimeSlotActions(conversations, actionLogs, undefined, [5]);

  if (weekdayMorningActions.length > 0) {
    patterns.push({
      action_type: weekdayMorningActions[0],
      hour_of_day: 9,
      frequency: weekdayMorningActions.length,
      context: { time_slot: 'weekday_morning' }
    });
  }

  if (mondayActions.length > 3) {
    patterns.push({
      action_type: 'weekly_review',
      day_of_week: 1,
      hour_of_day: 9,
      frequency: mondayActions.length,
      context: { routine: 'monday_morning' }
    });
  }

  return {
    total_actions: conversations.length + actionLogs.length,
    most_common_actions: mostCommonActions,
    peak_hours: peakHours,
    peak_days: peakDays,
    recent_patterns: patterns,
  };
}

function analyzeTimeSlotActions(
  conversations: any[],
  actionLogs: any[],
  hours?: number[],
  days?: number[]
): string[] {
  const actions: string[] = [];

  for (const conv of conversations) {
    const dt = new Date(conv.created_at);
    const matchesHour = !hours || hours.includes(dt.getHours());
    const matchesDay = !days || days.includes(dt.getDay());
    
    if (matchesHour && matchesDay) {
      const messages = conv.messages as any[] || [];
      for (const msg of messages) {
        if (msg.role === 'user' && msg.content) {
          // Simple heuristic: extract action intent from user messages
          if (msg.content.toLowerCase().includes('pipeline')) actions.push('check_pipeline');
          if (msg.content.toLowerCase().includes('email')) actions.push('check_emails');
          if (msg.content.toLowerCase().includes('tâche')) actions.push('review_tasks');
          if (msg.content.toLowerCase().includes('facture')) actions.push('check_invoices');
        }
      }
    }
  }

  return actions;
}

// JARVIS 8.0: Extended Prediction interface with executable commands
interface ExtendedPrediction extends Prediction {
  executable_command?: string;
  one_click_action?: boolean;
  category?: 'routine' | 'productivity' | 'sales' | 'management';
}

function generatePredictions(
  stats: UserBehaviorStats,
  currentHour: number,
  currentDay: number,
  now: Date
): ExtendedPrediction[] {
  const predictions: ExtendedPrediction[] = [];

  // Prédiction basée sur l'heure actuelle
  const isWorkingHour = currentHour >= 8 && currentHour <= 19;
  const isWeekday = currentDay >= 1 && currentDay <= 5;
  const isMorning = currentHour >= 8 && currentHour <= 10;
  const isEndOfDay = currentHour >= 17 && currentHour <= 19;
  const isMonday = currentDay === 1;
  const isFriday = currentDay === 5;
  const isMiddleOfMonth = now.getDate() >= 14 && now.getDate() <= 16;
  const isEndOfMonth = now.getDate() >= 28;

  // Actions courantes suggérées avec commandes exécutables
  for (const action of stats.most_common_actions.slice(0, 3)) {
    if (action.count >= 5) {
      predictions.push({
        action_type: action.action,
        description: `Vous utilisez souvent "${action.action}" (${action.count} fois ce mois)`,
        confidence: Math.min(0.9, 0.5 + (action.count / 50)),
        reason: 'frequent_action',
        executable_command: getExecutableCommand(action.action),
        one_click_action: true,
        category: 'productivity',
      });
    }
  }

  // Suggestions contextuelles par moment avec commandes exécutables
  if (isWeekday && isMorning) {
    predictions.push({
      action_type: 'daily_briefing',
      description: 'Démarrez la journée avec un briefing : tâches urgentes, emails importants, événements du jour',
      confidence: 0.85,
      reason: 'morning_routine',
      executable_command: 'Génère mon briefing du jour avec les tâches urgentes, emails non lus et événements à venir',
      one_click_action: true,
      category: 'routine',
    });
  }

  if (isMonday && isMorning) {
    predictions.push({
      action_type: 'weekly_review',
      description: 'Lundi matin : vérifiez le pipeline commercial et les objectifs de la semaine',
      confidence: 0.9,
      reason: 'monday_morning_routine',
      executable_command: 'Montre-moi un résumé du pipeline commercial avec les opportunités à suivre cette semaine et mes objectifs CA',
      one_click_action: true,
      category: 'sales',
    });
  }

  if (isFriday && isEndOfDay) {
    predictions.push({
      action_type: 'weekly_summary',
      description: 'Fin de semaine : récapitulatif des accomplissements et préparation de la semaine prochaine',
      confidence: 0.8,
      reason: 'friday_evening_routine',
      executable_command: 'Génère un bilan de ma semaine : tâches terminées, emails traités, rendez-vous effectués, et prépare les priorités de la semaine prochaine',
      one_click_action: true,
      category: 'routine',
    });
  }

  if (isWeekday && isEndOfDay) {
    predictions.push({
      action_type: 'end_of_day_review',
      description: 'Vérifiez les tâches non terminées avant de partir',
      confidence: 0.7,
      reason: 'end_of_day_routine',
      executable_command: 'Liste mes tâches non terminées aujourd\'hui et suggère lesquelles reporter à demain',
      one_click_action: true,
      category: 'productivity',
    });
  }

  // JARVIS 8.0: Nouvelles suggestions contextuelles
  if (isMiddleOfMonth) {
    predictions.push({
      action_type: 'mid_month_review',
      description: 'Mi-mois : vérifiez l\'avancement des objectifs CA',
      confidence: 0.75,
      reason: 'mid_month_checkpoint',
      executable_command: 'Analyse mon avancement CA à mi-mois et identifie les actions pour atteindre l\'objectif',
      one_click_action: true,
      category: 'sales',
    });
  }

  if (isEndOfMonth) {
    predictions.push({
      action_type: 'month_end_close',
      description: 'Fin de mois : préparez la clôture et les relances factures',
      confidence: 0.8,
      reason: 'month_end_routine',
      executable_command: 'Liste les factures impayées et génère des emails de relance pour la clôture de fin de mois',
      one_click_action: true,
      category: 'management',
    });
  }

  // Suggestion de review support si beaucoup de tickets
  if (isWeekday && currentHour >= 14 && currentHour <= 16) {
    predictions.push({
      action_type: 'support_review',
      description: 'Après-midi : bon moment pour revoir les tickets support en attente',
      confidence: 0.6,
      reason: 'afternoon_support',
      executable_command: 'Liste les tickets support en attente depuis plus de 24h et suggère une priorisation',
      one_click_action: true,
      category: 'management',
    });
  }

  // Suggestions basées sur les patterns détectés
  for (const pattern of stats.recent_patterns) {
    const matchesHour = pattern.hour_of_day === undefined || 
      Math.abs(pattern.hour_of_day - currentHour) <= 1;
    const matchesDay = pattern.day_of_week === undefined || 
      pattern.day_of_week === currentDay;

    if (matchesHour && matchesDay) {
      predictions.push({
        action_type: pattern.action_type,
        description: `Basé sur vos habitudes, c'est le moment idéal pour "${pattern.action_type}"`,
        confidence: Math.min(0.95, 0.6 + (pattern.frequency / 20)),
        reason: 'pattern_match',
        context: pattern.context,
        executable_command: getExecutableCommand(pattern.action_type),
        one_click_action: true,
        category: 'productivity',
      });
    }
  }

  // Trier par confiance
  return predictions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

// Helper to generate executable commands for common actions
function getExecutableCommand(actionType: string): string {
  const commands: Record<string, string> = {
    'check_pipeline': 'Montre-moi le pipeline commercial avec les opportunités par statut et valeur',
    'check_emails': 'Résume mes emails urgents non lus avec les actions requises',
    'review_tasks': 'Liste mes tâches en attente triées par priorité et échéance',
    'check_invoices': 'Affiche les factures impayées avec les montants et retards',
    'daily_briefing': 'Génère mon briefing du jour complet',
    'weekly_review': 'Prépare ma revue hebdomadaire avec KPIs et priorités',
    'weekly_summary': 'Génère le bilan de ma semaine',
    'end_of_day_review': 'Récapitule ce qui reste à faire',
  };
  return commands[actionType] || `Exécute ${actionType}`;
}

async function enrichPredictions(
  supabase: any,
  profileId: string,
  predictions: Prediction[]
): Promise<Prediction[]> {
  const enriched: Prediction[] = [];

  for (const prediction of predictions) {
    const enrichedPrediction = { ...prediction };

    // Enrichir avec des données contextuelles
    switch (prediction.action_type) {
      case 'daily_briefing':
      case 'check_emails': {
        const { count: unreadCount } = await supabase
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .gt('unread_count', 0)
          .eq('is_archived', false);

        if (unreadCount && unreadCount > 0) {
          enrichedPrediction.description += ` (${unreadCount} emails non lus)`;
          enrichedPrediction.confidence = Math.min(1, enrichedPrediction.confidence + 0.1);
          enrichedPrediction.context = { ...enrichedPrediction.context, unread_count: unreadCount };
        }
        break;
      }

      case 'review_tasks':
      case 'end_of_day_review': {
        const { count: overdueCount } = await supabase
          .from('taches')
          .select('id', { count: 'exact', head: true })
          .eq('responsable_id', profileId)
          .in('statut', ['A faire', 'En cours'])
          .lt('echeance', new Date().toISOString());

        if (overdueCount && overdueCount > 0) {
          enrichedPrediction.description += ` (${overdueCount} tâches en retard)`;
          enrichedPrediction.confidence = Math.min(1, enrichedPrediction.confidence + 0.15);
          enrichedPrediction.context = { ...enrichedPrediction.context, overdue_count: overdueCount };
        }
        break;
      }

      case 'weekly_review':
      case 'check_pipeline': {
        const { data: prospects } = await supabase
          .from('etablissements')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'Prospect')
          .eq('commercial_id', profileId);

        if (prospects) {
          enrichedPrediction.context = { ...enrichedPrediction.context, prospect_count: prospects.length };
        }
        break;
      }
    }

    enriched.push(enrichedPrediction);
  }

  return enriched;
}
