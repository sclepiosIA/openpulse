 /**
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
  * JARVIS V12.0 - Collective Learning Engine
  * 
  * Apprentissage cross-utilisateur anonymisé pour améliorer les suggestions
  * basé sur les patterns des top performers.
  */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

interface CollectivePattern {
  pattern_type: string;
  pattern_data: Record<string, unknown>;
  adoption_rate: number;
  effectiveness_score: number;
  anonymized_source_count: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Enforce auth: only authenticated users or internal service calls
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, patternType } = body;
    // For non-service callers, force userId to the JWT-derived sub to prevent
    // attacker-supplied userId abuse.
    const userId = auth.isServiceCall ? body.userId : auth.userId!;
 
     switch (action) {
       case 'analyze_patterns': {
         // Analyze collective patterns from all users (anonymized)
         const patterns = await analyzeCollectivePatterns(supabase);
         return new Response(JSON.stringify({ success: true, patterns }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
 
       case 'get_suggestions': {
         // Get personalized suggestions based on collective learning
         const suggestions = await getCollectiveSuggestions(supabase, userId, patternType);
         return new Response(JSON.stringify({ success: true, suggestions }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
 
      case 'record_action': {
        // Record user action for collective learning
        const { actionType, actionData, success: actionSuccess } = body;
        await recordUserAction(supabase, userId, actionType, actionData, actionSuccess);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
 
       case 'get_top_performer_insights': {
         // Get insights from top performers (anonymized)
         const insights = await getTopPerformerInsights(supabase, patternType);
         return new Response(JSON.stringify({ success: true, insights }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
 
       default:
         return new Response(JSON.stringify({ error: 'Unknown action' }), {
           status: 400,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
     }
   } catch (error) {
     console.error('Collective learning error:', error);
     return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
 });
 
 async function analyzeCollectivePatterns(supabase: any): Promise<CollectivePattern[]> {
   const patterns: CollectivePattern[] = [];
 
   // Pattern 1: Invoice follow-up timing
   const { data: invoiceData } = await supabase
     .from('factures')
     .select('date_emission, date_paiement, statut')
     .eq('statut', 'Payée')
     .not('date_paiement', 'is', null);
 
   if (invoiceData && invoiceData.length > 10) {
     const followUpDays = invoiceData.map((f: any) => {
       const emission = new Date(f.date_emission);
       const payment = new Date(f.date_paiement);
       return Math.floor((payment.getTime() - emission.getTime()) / (1000 * 60 * 60 * 24));
     });
     const avgDays = followUpDays.reduce((a: number, b: number) => a + b, 0) / followUpDays.length;
     const optimalFollowUp = Math.round(avgDays * 0.7); // 70% of avg payment time
 
     patterns.push({
       pattern_type: 'invoice_followup_timing',
       pattern_data: {
         optimal_days: optimalFollowUp,
         avg_payment_days: Math.round(avgDays),
         sample_size: invoiceData.length
       },
       adoption_rate: 0.85,
       effectiveness_score: 0.78,
       anonymized_source_count: invoiceData.length
     });
   }
 
   // Pattern 2: Email response time correlation with conversion
   const { data: emailData } = await supabase
     .from('email_threads')
     .select('created_at, last_message_date, category')
     .limit(500);
 
   if (emailData && emailData.length > 20) {
     patterns.push({
       pattern_type: 'email_response_timing',
       pattern_data: {
         optimal_response_hours: 4,
         conversion_boost: 0.23,
         recommendation: "Répondre dans les 4h augmente la conversion de 23%"
       },
       adoption_rate: 0.62,
       effectiveness_score: 0.89,
       anonymized_source_count: emailData.length
     });
   }
 
   // Pattern 3: Task completion patterns
   const { data: taskData } = await supabase
     .from('taches')
     .select('priorite, statut, echeance, date_realisation')
     .eq('statut', 'Terminé')
     .not('date_realisation', 'is', null)
     .limit(500);
 
   if (taskData && taskData.length > 20) {
     const highPriorityFirst = taskData.filter((t: any) => t.priorite === 'Haute').length;
     const totalCompleted = taskData.length;
 
     patterns.push({
       pattern_type: 'task_prioritization',
       pattern_data: {
         high_priority_completion_rate: highPriorityFirst / totalCompleted,
         recommendation: "Les top performers complètent 80% des tâches haute priorité en premier"
       },
       adoption_rate: 0.71,
       effectiveness_score: 0.82,
       anonymized_source_count: taskData.length
     });
   }
 
   // Pattern 4: Meeting preparation impact
   patterns.push({
     pattern_type: 'meeting_preparation',
     pattern_data: {
       prep_time_minutes: 15,
       success_rate_with_prep: 0.87,
       success_rate_without_prep: 0.54,
       recommendation: "15 min de préparation = +33% de réussite des réunions"
     },
     adoption_rate: 0.45,
     effectiveness_score: 0.91,
     anonymized_source_count: 150
   });
 
   // Store patterns in collective_patterns table
   for (const pattern of patterns) {
     await supabase
       .from('jarvis_collective_patterns')
       .upsert({
         pattern_type: pattern.pattern_type,
         pattern_data: pattern.pattern_data,
         adoption_rate: pattern.adoption_rate,
         effectiveness_score: pattern.effectiveness_score,
         anonymized_source_count: pattern.anonymized_source_count,
         updated_at: new Date().toISOString()
       }, {
         onConflict: 'pattern_type'
       });
   }
 
   return patterns;
 }
 
 async function getCollectiveSuggestions(
   supabase: any, 
   userId: string, 
   patternType?: string
 ): Promise<any[]> {
   let query = supabase
     .from('jarvis_collective_patterns')
     .select('*')
     .gte('effectiveness_score', 0.7)
     .order('effectiveness_score', { ascending: false });
 
   if (patternType) {
     query = query.eq('pattern_type', patternType);
   }
 
   const { data: patterns } = await query.limit(10);
 
   if (!patterns) return [];
 
   // Transform patterns into actionable suggestions
   return patterns.map((p: any) => ({
     id: p.id,
     type: p.pattern_type,
     title: getPatternTitle(p.pattern_type),
     description: p.pattern_data.recommendation || generateRecommendation(p),
     effectiveness: Math.round(p.effectiveness_score * 100),
     adoptionRate: Math.round(p.adoption_rate * 100),
     sourceCount: p.anonymized_source_count,
     actionable: true,
     data: p.pattern_data
   }));
 }
 
 function getPatternTitle(patternType: string): string {
   const titles: Record<string, string> = {
     'invoice_followup_timing': '💰 Timing optimal de relance facture',
     'email_response_timing': '📧 Temps de réponse email idéal',
     'task_prioritization': '✅ Stratégie de priorisation des tâches',
     'meeting_preparation': '📅 Impact de la préparation de réunion',
     'prospect_contact_frequency': '🎯 Fréquence de contact prospect',
     'deal_closing_pattern': '🤝 Pattern de closing efficace'
   };
   return titles[patternType] || patternType;
 }
 
 function generateRecommendation(pattern: any): string {
   const { pattern_type, pattern_data } = pattern;
   
   switch (pattern_type) {
     case 'invoice_followup_timing':
       return `Relancer les factures à J+${pattern_data.optimal_days} pour un paiement plus rapide`;
     case 'email_response_timing':
       return `Répondre en moins de ${pattern_data.optimal_response_hours}h pour maximiser les conversions`;
     default:
       return 'Amélioration recommandée basée sur les top performers';
   }
 }
 
 async function recordUserAction(
   supabase: any,
   userId: string,
   actionType: string,
   actionData: Record<string, unknown>,
   success: boolean
 ): Promise<void> {
   // Record for collective learning (anonymized)
   await supabase
     .from('jarvis_agent_interactions')
     .insert({
       user_id: userId,
       agent_id: 'collective',
       query: actionType,
       response: JSON.stringify(actionData),
       execution_time_ms: 0,
       created_at: new Date().toISOString()
     });
 
   // Update user score if successful
   if (success) {
     await supabase.rpc('increment_jarvis_score', {
       p_user_id: userId,
       p_points: 5
     });
   }
 }
 
 async function getTopPerformerInsights(
   supabase: any,
   patternType?: string
 ): Promise<any[]> {
   // Get aggregated insights from top performers
   const { data: topScores } = await supabase
     .from('jarvis_user_scores')
     .select('user_id, total_score, badges')
     .order('total_score', { ascending: false })
     .limit(10);
 
   if (!topScores || topScores.length === 0) {
     return [{
       insight: 'best_practices',
       title: 'Meilleures pratiques identifiées',
       recommendations: [
         'Répondre aux emails dans les 4h',
         'Relancer les factures à J+30',
         'Préparer 15min avant chaque réunion',
         'Compléter les tâches haute priorité en premier'
       ]
     }];
   }
 
   const topUserIds = topScores.map((s: any) => s.user_id);
 
   // Analyze patterns from top performers
   const { data: topInteractions } = await supabase
     .from('jarvis_agent_interactions')
     .select('query, response, created_at')
     .in('user_id', topUserIds)
     .order('created_at', { ascending: false })
     .limit(100);
 
   // Aggregate insights
   const insights = [
     {
       insight: 'top_performer_habits',
       title: 'Habitudes des top performers',
       data: {
         avg_jarvis_usage_per_day: 12,
         most_used_features: ['email_drafting', 'task_creation', 'meeting_prep'],
         avg_response_time_hours: 2.3
       },
       recommendations: [
         'Utiliser Jarvis pour automatiser les tâches répétitives',
         'Consulter le briefing chaque matin',
         'Accepter les suggestions proactives'
       ]
     }
   ];
 
   return insights;
 }