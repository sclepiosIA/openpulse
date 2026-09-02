/**
 * JARVIS 9.0 - Behavior Model
 * 
 * Modélise le comportement utilisateur pour:
 * - Prédire les actions probables
 * - Détecter les patterns récurrents
 * - Ajuster les suggestions en temps réel
 */

import { createClient } from "@supabase/supabase-js";

export interface ActionSequence {
  id: string;
  actions: string[];
  frequency: number;
  avgGapSeconds: number;
  confidence: number;
  lastObserved: string;
  contextTriggers: {
    dayOfWeek?: number[];
    hourOfDay?: number[];
    pageContext?: string[];
    entityType?: string[];
  };
}

export interface UserBehaviorProfile {
  userId: string;
  primaryWorkPatterns: ActionSequence[];
  preferredActionTimes: { action: string; preferredHours: number[] }[];
  communicationStyle: 'formal' | 'casual' | 'concise';
  responsePreference: 'detailed' | 'brief' | 'actionable';
  topActions: { action: string; count: number }[];
  avgSessionDurationMinutes: number;
  peakProductivityHours: number[];
  avoidedActions: string[];
}

export interface BehaviorPrediction {
  action: string;
  probability: number;
  reason: string;
  suggestedTime?: string;
  contextMatch: number;
  executableCommand?: string;
}

/**
 * Analyse l'historique pour détecter des séquences d'actions récurrentes
 */
export async function detectActionSequences(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  daysBack: number = 30
): Promise<ActionSequence[]> {
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  
  // Récupérer les conversations
  const { data: conversations } = await supabase
    .from('jarvis_conversations')
    .select('messages, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoffDate)
    .order('created_at', { ascending: true });
  
  if (!conversations?.length) return [];
  
  // Extraire les séquences d'actions
  const sequences: Map<string, { count: number; timestamps: Date[]; contexts: Set<string> }> = new Map();
  
  for (const conv of conversations) {
    const messages = conv.messages as any[] || [];
    const actions: { name: string; timestamp: Date }[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tool of msg.tool_calls) {
          actions.push({
            name: tool.function?.name || tool.name,
            timestamp: new Date(conv.created_at),
          });
        }
      }
    }
    
    // Détecter les paires et triplets d'actions
    for (let i = 0; i < actions.length - 1; i++) {
      // Paires
      const pair = `${actions[i].name}→${actions[i + 1].name}`;
      const existing = sequences.get(pair) || { count: 0, timestamps: [], contexts: new Set() };
      existing.count++;
      existing.timestamps.push(actions[i].timestamp);
      sequences.set(pair, existing);
      
      // Triplets (si possible)
      if (i < actions.length - 2) {
        const triplet = `${actions[i].name}→${actions[i + 1].name}→${actions[i + 2].name}`;
        const existingTriplet = sequences.get(triplet) || { count: 0, timestamps: [], contexts: new Set() };
        existingTriplet.count++;
        existingTriplet.timestamps.push(actions[i].timestamp);
        sequences.set(triplet, existingTriplet);
      }
    }
  }
  
  // Convertir en ActionSequence
  const result: ActionSequence[] = [];
  
  for (const [seqKey, data] of sequences) {
    if (data.count < 3) continue; // Minimum 3 occurrences pour être significatif
    
    const actions = seqKey.split('→');
    const gaps = calculateAverageGap(data.timestamps);
    const dayDistribution = calculateDayDistribution(data.timestamps);
    const hourDistribution = calculateHourDistribution(data.timestamps);
    
    result.push({
      id: seqKey.replace(/→/g, '_'),
      actions,
      frequency: data.count,
      avgGapSeconds: gaps,
      confidence: Math.min(0.9, 0.3 + (data.count / 50)),
      lastObserved: data.timestamps[data.timestamps.length - 1].toISOString(),
      contextTriggers: {
        dayOfWeek: dayDistribution,
        hourOfDay: hourDistribution,
      },
    });
  }
  
  return result.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
}

/**
 * Construit le profil comportemental complet d'un utilisateur
 */
export async function buildUserBehaviorProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserBehaviorProfile> {
  const sequences = await detectActionSequences(supabase, userId);
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // Analyser les actions les plus fréquentes
  const { data: learningData } = await supabase
    .from('jarvis_learning_data')
    .select('action_type, accepted, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', cutoffDate);
  
  const actionCounts = new Map<string, number>();
  const rejectedActions = new Set<string>();
  const actionHours = new Map<string, number[]>();
  
  for (const entry of learningData || []) {
    actionCounts.set(entry.action_type, (actionCounts.get(entry.action_type) || 0) + 1);
    
    if (!entry.accepted) {
      rejectedActions.add(entry.action_type);
    }
    
    const hour = new Date(entry.recorded_at).getHours();
    const hours = actionHours.get(entry.action_type) || [];
    hours.push(hour);
    actionHours.set(entry.action_type, hours);
  }
  
  // Top actions
  const topActions = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Heures préférées par action
  const preferredActionTimes = Array.from(actionHours.entries()).map(([action, hours]) => ({
    action,
    preferredHours: calculateModeHours(hours),
  }));
  
  // Analyser le style de communication depuis la mémoire
  const { data: memoryData } = await supabase
    .from('jarvis_user_memory')
    .select('key, value')
    .eq('user_id', userId)
    .in('category', ['preference', 'instruction']);
  
  let communicationStyle: 'formal' | 'casual' | 'concise' = 'casual';
  let responsePreference: 'detailed' | 'brief' | 'actionable' = 'actionable';
  
  for (const mem of memoryData || []) {
    if (mem.key.includes('style') || mem.key.includes('ton')) {
      if (mem.value.toLowerCase().includes('formel')) communicationStyle = 'formal';
      else if (mem.value.toLowerCase().includes('concis')) communicationStyle = 'concise';
    }
    if (mem.key.includes('réponse') || mem.key.includes('détail')) {
      if (mem.value.toLowerCase().includes('détaillé')) responsePreference = 'detailed';
      else if (mem.value.toLowerCase().includes('bref')) responsePreference = 'brief';
    }
  }
  
  // Calculer les heures de productivité maximale
  const allHours = Array.from(actionHours.values()).flat();
  const peakHours = calculateModeHours(allHours);
  
  return {
    userId,
    primaryWorkPatterns: sequences.slice(0, 5),
    preferredActionTimes,
    communicationStyle,
    responsePreference,
    topActions,
    avgSessionDurationMinutes: 15, // Placeholder - calculer depuis conversations
    peakProductivityHours: peakHours,
    avoidedActions: Array.from(rejectedActions),
  };
}

/**
 * Prédit les prochaines actions probables basées sur le profil
 */
export function predictNextActions(
  profile: UserBehaviorProfile,
  currentContext: {
    hour: number;
    dayOfWeek: number;
    currentPage?: string;
    lastAction?: string;
  }
): BehaviorPrediction[] {
  const predictions: BehaviorPrediction[] = [];
  
  // Prédictions basées sur les patterns de travail
  for (const pattern of profile.primaryWorkPatterns) {
    const hourMatch = pattern.contextTriggers.hourOfDay?.includes(currentContext.hour) ? 0.3 : 0;
    const dayMatch = pattern.contextTriggers.dayOfWeek?.includes(currentContext.dayOfWeek) ? 0.3 : 0;
    
    // Si lastAction correspond au début d'un pattern
    if (currentContext.lastAction && pattern.actions[0] === currentContext.lastAction) {
      predictions.push({
        action: pattern.actions[1],
        probability: Math.min(0.95, pattern.confidence + 0.2),
        reason: `Suite logique après "${currentContext.lastAction}"`,
        contextMatch: 1,
        executableCommand: getCommandForAction(pattern.actions[1]),
      });
    }
    
    // Si l'heure/jour correspond
    if (hourMatch + dayMatch > 0.3) {
      predictions.push({
        action: pattern.actions[0],
        probability: Math.min(0.9, pattern.confidence + hourMatch + dayMatch),
        reason: `Pattern habituel à cette heure/jour`,
        contextMatch: hourMatch + dayMatch,
        executableCommand: getCommandForAction(pattern.actions[0]),
      });
    }
  }
  
  // Prédictions basées sur les heures préférées
  for (const pref of profile.preferredActionTimes) {
    if (pref.preferredHours.includes(currentContext.hour)) {
      const existing = predictions.find(p => p.action === pref.action);
      if (existing) {
        existing.probability = Math.min(0.95, existing.probability + 0.1);
      } else {
        predictions.push({
          action: pref.action,
          probability: 0.5,
          reason: `Action fréquente à ${currentContext.hour}h`,
          contextMatch: 0.5,
          executableCommand: getCommandForAction(pref.action),
        });
      }
    }
  }
  
  // Dédupliquer et trier
  const unique = new Map<string, BehaviorPrediction>();
  for (const pred of predictions) {
    const existing = unique.get(pred.action);
    if (!existing || pred.probability > existing.probability) {
      unique.set(pred.action, pred);
    }
  }
  
  return Array.from(unique.values())
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);
}

/**
 * Sauvegarde le profil comportemental en base
 */
export async function saveUserBehaviorProfile(
  supabase: ReturnType<typeof createClient>,
  profile: UserBehaviorProfile
): Promise<void> {
  // Sauvegarder les séquences principales
  for (const sequence of profile.primaryWorkPatterns) {
    await supabase
      .from('jarvis_user_behavior_model')
      .upsert({
        user_id: profile.userId,
        action_sequence: sequence.actions,
        frequency: sequence.frequency,
        avg_time_gap_seconds: sequence.avgGapSeconds,
        context_triggers: sequence.contextTriggers,
        confidence: sequence.confidence,
        last_observed: sequence.lastObserved,
      }, {
        onConflict: 'user_id,action_sequence',
      });
  }
}

// Helpers
function calculateAverageGap(timestamps: Date[]): number {
  if (timestamps.length < 2) return 0;
  
  let totalGap = 0;
  for (let i = 1; i < timestamps.length; i++) {
    totalGap += (timestamps[i].getTime() - timestamps[i - 1].getTime()) / 1000;
  }
  return Math.round(totalGap / (timestamps.length - 1));
}

function calculateDayDistribution(timestamps: Date[]): number[] {
  const dayCounts = new Array(7).fill(0);
  for (const ts of timestamps) {
    dayCounts[ts.getDay()]++;
  }
  
  const avg = timestamps.length / 7;
  return dayCounts
    .map((count, day) => ({ day, count }))
    .filter(d => d.count > avg * 1.3)
    .map(d => d.day);
}

function calculateHourDistribution(timestamps: Date[]): number[] {
  const hourCounts = new Array(24).fill(0);
  for (const ts of timestamps) {
    hourCounts[ts.getHours()]++;
  }
  
  const avg = timestamps.length / 24;
  return hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > avg * 1.5)
    .map(h => h.hour);
}

function calculateModeHours(hours: number[]): number[] {
  if (hours.length === 0) return [];
  
  const counts = new Map<number, number>();
  for (const h of hours) {
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  
  const avg = hours.length / 24;
  return Array.from(counts.entries())
    .filter(([_, count]) => count > avg * 1.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour]) => hour);
}

function getCommandForAction(action: string): string {
  const commands: Record<string, string> = {
    'query_database': 'Affiche les données récentes',
    'send_email': 'Envoie un email',
    'create_task': 'Crée une nouvelle tâche',
    'schedule_meeting': 'Planifie une réunion',
    'sync_qonto_transactions': 'Synchronise les transactions Qonto',
    'generate_report': 'Génère un rapport',
    'check_emails': 'Vérifie mes emails non lus',
    'review_tasks': 'Montre mes tâches prioritaires',
    'check_pipeline': 'Affiche le pipeline commercial',
  };
  return commands[action] || `Exécute ${action}`;
}
