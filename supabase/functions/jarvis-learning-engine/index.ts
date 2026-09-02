/**
 * JARVIS 9.0 - Moteur d'Apprentissage Actif
 * 
 * Analyse les confirmations/rejets d'actions pour :
 * - Ajuster les seuils de confiance par type d'action
 * - Détecter les corrections utilisateur et en déduire des préférences
 * - Apprentissage actif par observation
 * - Auto-optimisation des réponses
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import {
  detectUserCorrections,
  generateLearnedPreferences,
  calculateThresholdAdjustments,
  applyThresholdAdjustments,
  analyzeSentiment,
} from "./active-learning.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

interface LearningMetrics {
  action_type: string;
  total_executions: number;
  confirmations: number;
  rejections: number;
  confirmation_rate: number;
  avg_response_time_ms: number;
  user_satisfaction_score: number;
}

interface UserPreferences {
  communication_style: 'formal' | 'casual' | 'concise' | 'detailed';
  response_length: 'short' | 'medium' | 'long';
  preferred_actions: string[];
  avoided_actions: string[];
  peak_usage_hours: number[];
  favorite_templates: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = await req.json();
    const { action, data } = body;
    const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : body.user_id;

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'record_feedback': {
        // Enregistrer un feedback utilisateur
        const { action_type, accepted, execution_time_ms, feedback_score } = data;
        
        await supabase.from('jarvis_learning_data').upsert({
          user_id: profile.id,
          action_type,
          accepted,
          execution_time_ms,
          feedback_score,
          recorded_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_metrics': {
        // Récupérer les métriques d'apprentissage
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: learningData } = await supabase
          .from('jarvis_learning_data')
          .select('*')
          .eq('user_id', profile.id)
          .gte('recorded_at', thirtyDaysAgo);

        // Grouper par type d'action
        const metricsByAction = new Map<string, LearningMetrics>();
        
        for (const entry of learningData || []) {
          const existing = metricsByAction.get(entry.action_type) || {
            action_type: entry.action_type,
            total_executions: 0,
            confirmations: 0,
            rejections: 0,
            confirmation_rate: 0,
            avg_response_time_ms: 0,
            user_satisfaction_score: 0,
          };

          existing.total_executions++;
          if (entry.accepted) existing.confirmations++;
          else existing.rejections++;
          existing.avg_response_time_ms = 
            (existing.avg_response_time_ms * (existing.total_executions - 1) + (entry.execution_time_ms || 0)) 
            / existing.total_executions;
          if (entry.feedback_score) {
            existing.user_satisfaction_score = 
              (existing.user_satisfaction_score * (existing.total_executions - 1) + entry.feedback_score) 
              / existing.total_executions;
          }

          metricsByAction.set(entry.action_type, existing);
        }

        // Calculer les taux de confirmation
        const metrics = Array.from(metricsByAction.values()).map(m => ({
          ...m,
          confirmation_rate: m.total_executions > 0 
            ? (m.confirmations / m.total_executions) * 100 
            : 0,
        }));

        return new Response(JSON.stringify({
          success: true,
          metrics,
          total_interactions: learningData?.length || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_preferences': {
        // Récupérer les préférences apprises
        const { data: memoryData } = await supabase
          .from('jarvis_user_memory')
          .select('category, key, value')
          .eq('user_id', profile.id)
          .in('category', ['preference', 'instruction']);

        // Analyser l'historique pour déduire les préférences
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: conversations } = await supabase
          .from('jarvis_conversations')
          .select('messages, created_at')
          .eq('user_id', user_id)
          .gte('created_at', thirtyDaysAgo)
          .limit(100);

        // Analyser les heures d'utilisation
        const hourCounts = new Array(24).fill(0);
        for (const conv of conversations || []) {
          const hour = new Date(conv.created_at).getHours();
          hourCounts[hour]++;
        }
        const avgUsage = hourCounts.reduce((a, b) => a + b, 0) / 24;
        const peakHours = hourCounts
          .map((count, hour) => ({ hour, count }))
          .filter(h => h.count > avgUsage * 1.5)
          .map(h => h.hour);

        // Construire les préférences
        const preferences: UserPreferences = {
          communication_style: detectCommunicationStyle(memoryData || []),
          response_length: detectResponseLength(memoryData || []),
          preferred_actions: [],
          avoided_actions: [],
          peak_usage_hours: peakHours,
          favorite_templates: [],
        };

        return new Response(JSON.stringify({
          success: true,
          preferences,
          memory_entries: memoryData?.length || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'adjust_thresholds': {
        // Ajuster les seuils de confiance basé sur l'historique
        const { data: learningData } = await supabase
          .from('jarvis_learning_data')
          .select('action_type, accepted')
          .eq('user_id', profile.id)
          .order('recorded_at', { ascending: false })
          .limit(500);

        const actionStats = new Map<string, { accepted: number; rejected: number }>();
        
        for (const entry of learningData || []) {
          const stats = actionStats.get(entry.action_type) || { accepted: 0, rejected: 0 };
          if (entry.accepted) stats.accepted++;
          else stats.rejected++;
          actionStats.set(entry.action_type, stats);
        }

        // Calculer les nouveaux seuils recommandés
        const thresholdRecommendations: Record<string, number> = {};
        
        for (const [actionType, stats] of actionStats) {
          const total = stats.accepted + stats.rejected;
          if (total < 5) continue; // Pas assez de données
          
          const acceptRate = stats.accepted / total;
          
          // Si taux d'acceptation élevé, on peut être plus autonome
          // Si taux faible, on doit demander plus de confirmations
          if (acceptRate > 0.9) {
            thresholdRecommendations[actionType] = 0.5; // Seuil bas = plus autonome
          } else if (acceptRate > 0.7) {
            thresholdRecommendations[actionType] = 0.6;
          } else if (acceptRate > 0.5) {
            thresholdRecommendations[actionType] = 0.7;
          } else {
            thresholdRecommendations[actionType] = 0.9; // Seuil haut = toujours confirmer
          }
        }

        return new Response(JSON.stringify({
          success: true,
          threshold_recommendations: thresholdRecommendations,
          data_points: learningData?.length || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'generate_report': {
        // Générer un rapport d'apprentissage mensuel
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        const { data: monthData } = await supabase
          .from('jarvis_learning_data')
          .select('*')
          .eq('user_id', profile.id)
          .gte('recorded_at', startOfMonth);

        const { data: conversations } = await supabase
          .from('jarvis_conversations')
          .select('id, messages')
          .eq('user_id', user_id)
          .gte('created_at', startOfMonth);

        const report = {
          period: `${now.toLocaleString('fr-FR', { month: 'long' })} ${now.getFullYear()}`,
          total_interactions: monthData?.length || 0,
          conversations_count: conversations?.length || 0,
          top_actions: getTopActions(monthData || []),
          acceptance_rate: calculateAcceptanceRate(monthData || []),
          avg_satisfaction: calculateAvgSatisfaction(monthData || []),
          recommendations: generateRecommendations(monthData || []),
          generated_at: now.toISOString(),
        };

        return new Response(JSON.stringify({
          success: true,
          report,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('[learning-engine] Error:', error);
    return buildErrorResponse('jarvis-learning-engine', error, corsHeaders, 500);
  }
});

function detectCommunicationStyle(memoryData: any[]): UserPreferences['communication_style'] {
  const stylePref = memoryData.find(m => m.key === 'communication_style');
  if (stylePref) return stylePref.value as UserPreferences['communication_style'];
  return 'casual'; // Default
}

function detectResponseLength(memoryData: any[]): UserPreferences['response_length'] {
  const lengthPref = memoryData.find(m => m.key === 'response_length');
  if (lengthPref) return lengthPref.value as UserPreferences['response_length'];
  return 'medium'; // Default
}

function getTopActions(data: any[]): { action: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of data) {
    counts.set(entry.action_type, (counts.get(entry.action_type) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function calculateAcceptanceRate(data: any[]): number {
  if (data.length === 0) return 0;
  const accepted = data.filter(d => d.accepted).length;
  return Math.round((accepted / data.length) * 100);
}

function calculateAvgSatisfaction(data: any[]): number {
  const withScore = data.filter(d => d.feedback_score);
  if (withScore.length === 0) return 0;
  const sum = withScore.reduce((acc, d) => acc + d.feedback_score, 0);
  return Math.round((sum / withScore.length) * 10) / 10;
}

function generateRecommendations(data: any[]): string[] {
  const recommendations: string[] = [];
  
  const acceptanceRate = calculateAcceptanceRate(data);
  if (acceptanceRate < 50) {
    recommendations.push('Considérez réduire le mode autonome pour obtenir plus de confirmations');
  } else if (acceptanceRate > 90) {
    recommendations.push('Excellent taux d\'acceptation ! Vous pouvez augmenter l\'autonomie de Jarvis');
  }

  const avgSat = calculateAvgSatisfaction(data);
  if (avgSat < 3) {
    recommendations.push('Les réponses semblent nécessiter des ajustements. Vérifiez vos préférences');
  }

  const topActions = getTopActions(data);
  if (topActions.length > 0) {
    recommendations.push(`Action la plus utilisée: "${topActions[0].action}" - créez un template pour gagner du temps`);
  }

  return recommendations;
}
