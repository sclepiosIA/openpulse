import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";


/**
 * JARVIS V11.0 - Objective Tracker
 * 
 * CRON quotidien qui:
 * - Calcule la progression vers les objectifs
 * - Détecte les retards
 * - Déclenche des actions automatiques
 * - Génère des suggestions d'actions correctives
 */

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Métriques supportées et leurs requêtes SQL
const METRIC_QUERIES: Record<string, (userId: string, startDate: string, endDate: string) => { table: string; query: any }> = {
  // Revenue metrics
  'ca_mensuel': (userId, startDate, endDate) => ({
    table: 'tresorerie_revenus',
    query: { select: 'montant_ttc', gte: { date_paiement: startDate }, lte: { date_paiement: endDate } }
  }),
  'factures_emises': (userId, startDate, endDate) => ({
    table: 'factures',
    query: { select: 'montant_ttc', gte: { date_emission: startDate }, lte: { date_emission: endDate } }
  }),
  
  // Productivity metrics
  'taches_completees': (userId, startDate, endDate) => ({
    table: 'taches',
    query: { select: 'id', eq: { statut: 'Terminé' }, gte: { date_realisation: startDate }, lte: { date_realisation: endDate } }
  }),
  'emails_traites': (userId, startDate, endDate) => ({
    table: 'email_threads',
    query: { select: 'id', eq: { is_archived: true }, gte: { updated_at: startDate }, lte: { updated_at: endDate } }
  }),
  
  // Quality metrics
  'satisfaction_moyenne': (userId, startDate, endDate) => ({
    table: 'enquetes_satisfaction',
    query: { select: 'note_globale', gte: { created_at: startDate }, lte: { created_at: endDate } }
  }),
  'tickets_resolus': (userId, startDate, endDate) => ({
    table: 'support_tickets',
    query: { select: 'id', eq: { statut: 'resolved' }, gte: { resolved_at: startDate }, lte: { resolved_at: endDate } }
  }),
  
  // Growth metrics
  'nouveaux_etablissements': (userId, startDate, endDate) => ({
    table: 'etablissements',
    query: { select: 'id', gte: { date_signature: startDate }, lte: { date_signature: endDate } }
  }),
  'prospects_convertis': (userId, startDate, endDate) => ({
    table: 'etablissements',
    query: { select: 'id', eq: { statut: 'Contractuel' }, gte: { date_passage_contractuel: startDate }, lte: { date_passage_contractuel: endDate } }
  }),
};

interface ObjectiveProgress {
  objectiveId: string;
  previousValue: number;
  currentValue: number;
  progressPercent: number;
  expectedPercent: number;
  isOnTrack: boolean;
  daysRemaining: number;
  suggestedActions: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // CRON-only — internal secret required
  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;


  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Récupérer tous les objectifs actifs
    const { data: objectives, error: objError } = await supabase
      .from('jarvis_objectives')
      .select('*')
      .eq('status', 'active');
    
    if (objError) throw objError;
    
    console.log(`[Objective Tracker] Processing ${objectives?.length || 0} active objectives`);
    
    const results: ObjectiveProgress[] = [];
    const now = new Date();
    
    for (const objective of objectives || []) {
      try {
        const startDate = new Date(objective.start_date);
        const endDate = new Date(objective.end_date);
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculer la progression attendue (linéaire)
        const expectedPercent = Math.min(100, (daysElapsed / totalDays) * 100);
        
        // Calculer la valeur actuelle selon la métrique
        let currentValue = objective.current_value || 0;
        
        if (METRIC_QUERIES[objective.target_metric]) {
          const metricConfig = METRIC_QUERIES[objective.target_metric](
            objective.user_id,
            objective.start_date,
            endDate.toISOString().split('T')[0]
          );
          
          let query = supabase.from(metricConfig.table).select(metricConfig.query.select);
          
          if (metricConfig.query.eq) {
            for (const [key, value] of Object.entries(metricConfig.query.eq)) {
              query = query.eq(key, value);
            }
          }
          if (metricConfig.query.gte) {
            for (const [key, value] of Object.entries(metricConfig.query.gte)) {
              query = query.gte(key, value);
            }
          }
          if (metricConfig.query.lte) {
            for (const [key, value] of Object.entries(metricConfig.query.lte)) {
              query = query.lte(key, value);
            }
          }
          
          const { data: metricData, error: metricError } = await query;
          
          if (!metricError && metricData) {
            // Calculer la valeur selon le type de métrique
            if (objective.target_metric.includes('moyenne')) {
              // Pour les moyennes
              const values = metricData.map((d: any) => d.note_globale || d.satisfaction || 0).filter((v: number) => v > 0);
              currentValue = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
            } else if (objective.target_metric.includes('ca') || objective.target_metric.includes('factures')) {
              // Pour les montants
              currentValue = metricData.reduce((sum: number, d: any) => sum + (d.montant_ttc || d.montant_ht || 0), 0);
            } else {
              // Pour les comptages
              currentValue = metricData.length;
            }
          }
        }
        
        const progressPercent = objective.target_value > 0 
          ? (currentValue / objective.target_value) * 100 
          : 0;
        const isOnTrack = progressPercent >= expectedPercent * 0.9; // 10% de marge
        
        // Générer des suggestions d'actions
        const suggestedActions: string[] = [];
        
        if (!isOnTrack && daysRemaining > 0) {
          const gapPercent = expectedPercent - progressPercent;
          const dailyTargetNeeded = ((objective.target_value - currentValue) / daysRemaining);
          
          if (gapPercent > 20) {
            suggestedActions.push(`⚠️ Retard critique de ${gapPercent.toFixed(0)}% sur l'objectif "${objective.title}"`);
            suggestedActions.push(`Rythme nécessaire: ${dailyTargetNeeded.toFixed(1)} ${objective.unit}/jour`);
          } else if (gapPercent > 10) {
            suggestedActions.push(`📊 Léger retard de ${gapPercent.toFixed(0)}% - ajustement recommandé`);
          }
        }
        
        if (progressPercent >= 100 && objective.status === 'active') {
          suggestedActions.push(`🎉 Objectif "${objective.title}" atteint ! Félicitations !`);
        }
        
        if (daysRemaining <= 0 && progressPercent < 100) {
          suggestedActions.push(`❌ Objectif "${objective.title}" expiré à ${progressPercent.toFixed(0)}%`);
        }
        
        // Mettre à jour la valeur dans la base
        const previousValue = objective.current_value || 0;
        const progressHistory = objective.progress_history || [];
        
        // Ajouter à l'historique si la valeur a changé significativement
        if (Math.abs(currentValue - previousValue) > 0.01) {
          progressHistory.push({
            date: now.toISOString(),
            value: currentValue,
            delta: currentValue - previousValue,
            expected: (expectedPercent / 100) * objective.target_value
          });
          
          // Garder seulement les 90 derniers points
          if (progressHistory.length > 90) {
            progressHistory.splice(0, progressHistory.length - 90);
          }
        }
        
        // Mettre à jour les milestones
        const milestones = objective.milestones || [];
        for (const milestone of milestones) {
          if (!milestone.achieved && currentValue >= milestone.value) {
            milestone.achieved = true;
            milestone.achieved_at = now.toISOString();
          }
        }
        
        // Déterminer le nouveau statut
        let newStatus = objective.status;
        if (progressPercent >= 100) {
          newStatus = 'completed';
        } else if (daysRemaining <= 0) {
          newStatus = 'failed';
        }
        
        // Sauvegarder les mises à jour
        await supabase
          .from('jarvis_objectives')
          .update({
            current_value: currentValue,
            progress_history: progressHistory,
            milestones: milestones,
            status: newStatus,
          })
          .eq('id', objective.id);
        
        results.push({
          objectiveId: objective.id,
          previousValue,
          currentValue,
          progressPercent,
          expectedPercent,
          isOnTrack,
          daysRemaining: Math.max(0, daysRemaining),
          suggestedActions,
        });
        
        // Créer des alertes proactives si nécessaire
        if (suggestedActions.length > 0) {
          await supabase.from('jarvis_proactive_alerts').insert({
            user_id: objective.user_id,
            type: isOnTrack ? 'objective_milestone' : 'objective_behind',
            priority: isOnTrack ? 'low' : (progressPercent < expectedPercent - 20 ? 'high' : 'medium'),
            message: suggestedActions[0],
            context: {
              objectiveId: objective.id,
              objectiveTitle: objective.title,
              currentValue,
              targetValue: objective.target_value,
              progressPercent,
              expectedPercent,
            },
            suggested_action: isOnTrack ? null : `Analyser l'objectif "${objective.title}" et ajuster la stratégie`,
          });
        }
        
      } catch (objErr: unknown) {
        console.error(`[Objective Tracker] Error processing objective ${objective.id}:`, objErr);
      }
    }
    
    console.log(`[Objective Tracker] Completed. ${results.filter(r => r.isOnTrack).length}/${results.length} objectives on track`);

    return new Response(JSON.stringify({
      success: true,
      objectives_processed: results.length,
      on_track: results.filter(r => r.isOnTrack).length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return buildErrorResponse('jarvis-objective-tracker', error, corsHeaders, 500);
  }
});

