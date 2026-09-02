/**
 * JARVIS 9.0 - Active Learning Engine
 * 
 * Apprentissage actif par observation:
 * - Détecte automatiquement les préférences depuis les corrections utilisateur
 * - Ajuste les seuils de confiance en temps réel
 * - Optimise les réponses basées sur le feedback implicite
 */

import { createClient } from "@supabase/supabase-js";

export interface UserCorrectionPattern {
  actionType: string;
  originalBehavior: string;
  correctedBehavior: string;
  frequency: number;
  lastObserved: string;
  confidence: number;
}

export interface LearnedPreference {
  key: string;
  value: string;
  source: 'explicit' | 'inferred' | 'corrected';
  confidence: number;
  examples: string[];
  lastUpdated: string;
}

export interface ThresholdAdjustment {
  actionType: string;
  currentThreshold: number;
  suggestedThreshold: number;
  basedOnSamples: number;
  acceptanceRate: number;
}

/**
 * Détecte les corrections utilisateur et en déduit des préférences
 */
export async function detectUserCorrections(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserCorrectionPattern[]> {
  const patterns: UserCorrectionPattern[] = [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // Analyser les conversations où l'utilisateur a corrigé Jarvis
  const { data: conversations } = await supabase
    .from('jarvis_conversations')
    .select('messages, updated_at')
    .eq('user_id', userId)
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(100);
  
  const correctionPatterns = new Map<string, {
    original: string[];
    corrected: string[];
    timestamps: string[];
  }>();
  
  for (const conv of conversations || []) {
    const messages = conv.messages as any[] || [];
    
    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i];
      const next = messages[i + 1];
      
      // Détecter les patterns de correction
      if (current.role === 'assistant' && next.role === 'user') {
        // Pattern 1: Correction de ton d'email
        if (detectToneCorrection(current.content, next.content)) {
          addToCorrectionPattern(correctionPatterns, 'email_tone', current.content, next.content, conv.updated_at);
        }
        
        // Pattern 2: Correction de format de réponse
        if (detectFormatCorrection(current.content, next.content)) {
          addToCorrectionPattern(correctionPatterns, 'response_format', current.content, next.content, conv.updated_at);
        }
        
        // Pattern 3: Rejection d'auto-action
        if (detectActionRejection(current.content, next.content)) {
          addToCorrectionPattern(correctionPatterns, 'auto_action', current.content, next.content, conv.updated_at);
        }
      }
    }
  }
  
  // Convertir en patterns
  for (const [key, data] of correctionPatterns) {
    if (data.timestamps.length >= 2) { // Minimum 2 occurrences
      patterns.push({
        actionType: key,
        originalBehavior: summarizeBehavior(data.original),
        correctedBehavior: summarizeBehavior(data.corrected),
        frequency: data.timestamps.length,
        lastObserved: data.timestamps[0],
        confidence: Math.min(0.9, 0.5 + (data.timestamps.length / 10)),
      });
    }
  }
  
  return patterns;
}

/**
 * Génère des préférences apprises automatiquement
 */
export async function generateLearnedPreferences(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  corrections: UserCorrectionPattern[]
): Promise<LearnedPreference[]> {
  const preferences: LearnedPreference[] = [];
  
  for (const correction of corrections) {
    if (correction.confidence < 0.6) continue;
    
    switch (correction.actionType) {
      case 'email_tone':
        preferences.push({
          key: 'preferred_email_tone',
          value: correction.correctedBehavior,
          source: 'corrected',
          confidence: correction.confidence,
          examples: [correction.originalBehavior],
          lastUpdated: correction.lastObserved,
        });
        break;
        
      case 'response_format':
        preferences.push({
          key: 'preferred_response_format',
          value: correction.correctedBehavior,
          source: 'corrected',
          confidence: correction.confidence,
          examples: [correction.originalBehavior],
          lastUpdated: correction.lastObserved,
        });
        break;
        
      case 'auto_action':
        preferences.push({
          key: 'auto_action_preference',
          value: 'Demander confirmation avant exécution',
          source: 'corrected',
          confidence: correction.confidence,
          examples: [correction.originalBehavior],
          lastUpdated: correction.lastObserved,
        });
        break;
    }
  }
  
  // Sauvegarder les préférences apprises
  for (const pref of preferences) {
    await supabase
      .from('jarvis_user_memory')
      .upsert({
        user_id: userId,
        category: 'preference',
        key: pref.key,
        value: pref.value,
        importance: Math.round(pref.confidence * 5),
        metadata: {
          source: pref.source,
          confidence: pref.confidence,
          examples: pref.examples,
          auto_learned: true,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,category,key',
      });
  }
  
  return preferences;
}

/**
 * Calcule les ajustements de seuils de confiance par action
 */
export async function calculateThresholdAdjustments(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ThresholdAdjustment[]> {
  const adjustments: ThresholdAdjustment[] = [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // Récupérer les données d'apprentissage
  const { data: learningData } = await supabase
    .from('jarvis_learning_data')
    .select('action_type, accepted')
    .eq('user_id', userId)
    .gte('recorded_at', cutoff);
  
  // Grouper par action
  const actionStats = new Map<string, { accepted: number; rejected: number }>();
  
  for (const entry of learningData || []) {
    const stats = actionStats.get(entry.action_type) || { accepted: 0, rejected: 0 };
    if (entry.accepted) stats.accepted++;
    else stats.rejected++;
    actionStats.set(entry.action_type, stats);
  }
  
  // Calculer les ajustements
  const DEFAULT_THRESHOLDS: Record<string, number> = {
    'send_email': 0.9,
    'create_task': 0.6,
    'schedule_meeting': 0.8,
    'update_entity_status': 0.7,
    'default': 0.7,
  };
  
  for (const [actionType, stats] of actionStats) {
    const total = stats.accepted + stats.rejected;
    if (total < 5) continue; // Pas assez de données
    
    const acceptanceRate = stats.accepted / total;
    const currentThreshold = DEFAULT_THRESHOLDS[actionType] || DEFAULT_THRESHOLDS['default'];
    
    let suggestedThreshold: number;
    
    if (acceptanceRate > 0.95) {
      // Très haute acceptation → réduire le seuil (plus autonome)
      suggestedThreshold = Math.max(0.3, currentThreshold - 0.2);
    } else if (acceptanceRate > 0.85) {
      suggestedThreshold = Math.max(0.4, currentThreshold - 0.1);
    } else if (acceptanceRate < 0.5) {
      // Beaucoup de rejets → augmenter le seuil (plus de confirmations)
      suggestedThreshold = Math.min(0.95, currentThreshold + 0.2);
    } else if (acceptanceRate < 0.7) {
      suggestedThreshold = Math.min(0.9, currentThreshold + 0.1);
    } else {
      suggestedThreshold = currentThreshold;
    }
    
    adjustments.push({
      actionType,
      currentThreshold,
      suggestedThreshold,
      basedOnSamples: total,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
    });
  }
  
  return adjustments;
}

/**
 * Applique les ajustements de seuils
 */
export async function applyThresholdAdjustments(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  adjustments: ThresholdAdjustment[]
): Promise<void> {
  // Sauvegarder dans jarvis_settings
  const thresholds: Record<string, number> = {};
  
  for (const adj of adjustments) {
    if (adj.suggestedThreshold !== adj.currentThreshold) {
      thresholds[adj.actionType] = adj.suggestedThreshold;
    }
  }
  
  if (Object.keys(thresholds).length > 0) {
    await supabase
      .from('jarvis_settings')
      .upsert({
        user_id: userId,
        custom_thresholds: thresholds,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
  }
}

/**
 * Analyse le sentiment dans les réponses utilisateur
 */
export function analyzeSentiment(
  userResponse: string
): { sentiment: 'positive' | 'negative' | 'neutral'; confidence: number } {
  const positiveWords = /merci|parfait|super|excellent|génial|top|bravo|bien|ok|oui/i;
  const negativeWords = /non|pas|erreur|faux|incorrect|mauvais|problème|bug|nul/i;
  
  const hasPositive = positiveWords.test(userResponse);
  const hasNegative = negativeWords.test(userResponse);
  
  if (hasPositive && !hasNegative) {
    return { sentiment: 'positive', confidence: 0.8 };
  } else if (hasNegative && !hasPositive) {
    return { sentiment: 'negative', confidence: 0.8 };
  } else if (hasPositive && hasNegative) {
    return { sentiment: 'neutral', confidence: 0.5 };
  }
  
  return { sentiment: 'neutral', confidence: 0.6 };
}

// Helpers
function detectToneCorrection(assistantMsg: string, userMsg: string): boolean {
  const toneKeywords = /plus\s+(formel|informel|professionnel|simple|direct|poli)/i;
  return toneKeywords.test(userMsg);
}

function detectFormatCorrection(assistantMsg: string, userMsg: string): boolean {
  const formatKeywords = /plus\s+(court|long|détaillé|concis|simple)/i;
  return formatKeywords.test(userMsg);
}

function detectActionRejection(assistantMsg: string, userMsg: string): boolean {
  const rejectionKeywords = /non|annule|stop|arrête|pas\s+maintenant|attends/i;
  return rejectionKeywords.test(userMsg) && assistantMsg.includes('Action');
}

function addToCorrectionPattern(
  patterns: Map<string, { original: string[]; corrected: string[]; timestamps: string[] }>,
  key: string,
  original: string,
  corrected: string,
  timestamp: string
): void {
  const existing = patterns.get(key) || { original: [], corrected: [], timestamps: [] };
  existing.original.push(original.substring(0, 200));
  existing.corrected.push(corrected.substring(0, 200));
  existing.timestamps.push(timestamp);
  patterns.set(key, existing);
}

function summarizeBehavior(examples: string[]): string {
  if (examples.length === 0) return '';
  
  // Retourner un résumé du pattern le plus récent
  const latest = examples[examples.length - 1];
  
  if (latest.includes('formel')) return 'Ton formel';
  if (latest.includes('informel') || latest.includes('casual')) return 'Ton informel';
  if (latest.includes('court')) return 'Réponses courtes';
  if (latest.includes('détaillé')) return 'Réponses détaillées';
  
  return latest.substring(0, 50);
}
