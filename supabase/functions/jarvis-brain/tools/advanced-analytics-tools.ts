/**
 * JARVIS 12.0 - Advanced Analytics Tools
 * 
 * Prédictions, détection d'anomalies, corrélations
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executePredictTrend(ctx: ToolContext, args: {
  metric: string;
  period_months?: number;
  forecast_months?: number;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodMonths = args.period_months || 6;
    const forecastMonths = args.forecast_months || 3;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    let historicalData: Array<{ month: string; value: number }> = [];

    switch (args.metric) {
      case 'revenue': {
        const { data } = await ctx.supabase
          .from('tresorerie_revenus')
          .select('montant, date_reception')
          .gte('date_reception', startDate.toISOString());

        // Agréger par mois
        const byMonth: Record<string, number> = {};
        (data || []).forEach(r => {
          const month = r.date_reception.substring(0, 7);
          byMonth[month] = (byMonth[month] || 0) + (r.montant || 0);
        });
        historicalData = Object.entries(byMonth).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));
        break;
      }
      case 'new_clients': {
        const { data } = await ctx.supabase
          .from('etablissements')
          .select('created_at')
          .gte('created_at', startDate.toISOString())
          .eq('statut', 'production');

        const byMonth: Record<string, number> = {};
        (data || []).forEach(e => {
          const month = e.created_at.substring(0, 7);
          byMonth[month] = (byMonth[month] || 0) + 1;
        });
        historicalData = Object.entries(byMonth).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));
        break;
      }
      case 'support_tickets': {
        const { data } = await ctx.supabase
          .from('support_tickets')
          .select('created_at')
          .gte('created_at', startDate.toISOString());

        const byMonth: Record<string, number> = {};
        (data || []).forEach(t => {
          const month = t.created_at.substring(0, 7);
          byMonth[month] = (byMonth[month] || 0) + 1;
        });
        historicalData = Object.entries(byMonth).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));
        break;
      }
      default:
        return { success: false, error: `Métrique '${args.metric}' non supportée. Valides: revenue, new_clients, support_tickets`, execution_time_ms: Date.now() - start };
    }

    if (historicalData.length < 3) {
      return { success: false, error: 'Données insuffisantes pour une prédiction fiable', execution_time_ms: Date.now() - start };
    }

    // Calcul de tendance linéaire simple
    const n = historicalData.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = historicalData.reduce((sum, d) => sum + d.value, 0);
    const sumXY = historicalData.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Générer les prévisions
    const forecast: Array<{ month: string; predicted: number; confidence: string }> = [];
    // L'arithmetique de mois se fait en UTC. `new Date('AAAA-MM-01')` situe
    // l'instant a minuit UTC, alors que getMonth/setMonth travaillent en heure
    // LOCALE : sur un fuseau dont l'offset change entre les deux mois
    // (Europe/Paris, mars -> avril), l'heure murale est conservee et l'instant
    // recule sous minuit du 1er. toISOString rendait alors le mois PRECEDENT --
    // la prevision annoncait le dernier mois deja observe.
    const lastMonth = new Date(historicalData[historicalData.length - 1].month + '-01');
    
    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(lastMonth);
      forecastDate.setUTCMonth(forecastDate.getUTCMonth() + i);
      const monthStr = forecastDate.toISOString().substring(0, 7);
      const predicted = Math.max(0, Math.round(intercept + slope * (n + i - 1)));
      
      forecast.push({
        month: monthStr,
        predicted,
        confidence: i <= 1 ? 'high' : i <= 2 ? 'medium' : 'low'
      });
    }

    // Calculer le changement de tendance
    const avgFirst = historicalData.slice(0, Math.floor(n / 2)).reduce((sum, d) => sum + d.value, 0) / Math.floor(n / 2);
    const avgSecond = historicalData.slice(Math.floor(n / 2)).reduce((sum, d) => sum + d.value, 0) / (n - Math.floor(n / 2));
    const trendDirection = avgSecond > avgFirst * 1.1 ? 'upward' : avgSecond < avgFirst * 0.9 ? 'downward' : 'stable';

    return { 
      success: true, 
      data: { 
        metric: args.metric,
        historical: historicalData,
        forecast,
        trend: {
          direction: trendDirection,
          slope: Math.round(slope * 100) / 100,
          avg_growth_rate: n > 1 ? Math.round(((avgSecond / avgFirst - 1) * 100) * 10) / 10 : 0
        },
        analysis: `Tendance ${trendDirection === 'upward' ? 'à la hausse' : trendDirection === 'downward' ? 'à la baisse' : 'stable'} pour ${args.metric}`
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Prediction failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeDetectAnomalies(ctx: ToolContext, args: {
  data_source: string;
  threshold?: number;
  period_days?: number;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodDays = args.period_days || 30;
    const threshold = args.threshold || 2; // Écart-type
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    let dataPoints: Array<{ date: string; value: number; label?: string }> = [];

    switch (args.data_source) {
      case 'daily_revenue': {
        const { data } = await ctx.supabase
          .from('tresorerie_revenus')
          .select('montant, date_reception')
          .gte('date_reception', startDate.toISOString());

        const byDay: Record<string, number> = {};
        (data || []).forEach(r => {
          const day = r.date_reception.substring(0, 10);
          byDay[day] = (byDay[day] || 0) + (r.montant || 0);
        });
        dataPoints = Object.entries(byDay).map(([date, value]) => ({ date, value }));
        break;
      }
      case 'daily_tickets': {
        const { data } = await ctx.supabase
          .from('support_tickets')
          .select('created_at')
          .gte('created_at', startDate.toISOString());

        const byDay: Record<string, number> = {};
        (data || []).forEach(t => {
          const day = t.created_at.substring(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        });
        dataPoints = Object.entries(byDay).map(([date, value]) => ({ date, value }));
        break;
      }
      case 'daily_tasks': {
        const { data } = await ctx.supabase
          .from('taches')
          .select('created_at')
          .gte('created_at', startDate.toISOString());

        const byDay: Record<string, number> = {};
        (data || []).forEach(t => {
          const day = t.created_at.substring(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        });
        dataPoints = Object.entries(byDay).map(([date, value]) => ({ date, value }));
        break;
      }
      default:
        return { success: false, error: `Source '${args.data_source}' non supportée. Valides: daily_revenue, daily_tickets, daily_tasks`, execution_time_ms: Date.now() - start };
    }

    if (dataPoints.length < 5) {
      return { success: false, error: 'Données insuffisantes pour détecter des anomalies', execution_time_ms: Date.now() - start };
    }

    // Calcul statistique
    const values = dataPoints.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Détecter les anomalies
    const anomalies = dataPoints.filter(d => Math.abs(d.value - mean) > threshold * stdDev).map(d => ({
      ...d,
      deviation: Math.round(((d.value - mean) / stdDev) * 100) / 100,
      type: d.value > mean ? 'high' : 'low'
    }));

    return { 
      success: true, 
      data: { 
        data_source: args.data_source,
        period_days: periodDays,
        statistics: {
          mean: Math.round(mean * 100) / 100,
          std_dev: Math.round(stdDev * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values)
        },
        anomalies,
        anomaly_count: anomalies.length,
        threshold_used: threshold
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Anomaly detection failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCorrelationAnalysis(ctx: ToolContext, args: {
  metric_a: string;
  metric_b: string;
  period_months?: number;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodMonths = args.period_months || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    // Récupérer les données pour les deux métriques
    const getMonthlyData = async (metric: string): Promise<Record<string, number>> => {
      const byMonth: Record<string, number> = {};
      
      switch (metric) {
        case 'revenue': {
          const { data } = await ctx.supabase.from('tresorerie_revenus').select('montant, date_reception').gte('date_reception', startDate.toISOString());
          (data || []).forEach(r => { const m = r.date_reception.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + (r.montant || 0); });
          break;
        }
        case 'tickets': {
          const { data } = await ctx.supabase.from('support_tickets').select('created_at').gte('created_at', startDate.toISOString());
          (data || []).forEach(t => { const m = t.created_at.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
          break;
        }
        case 'new_clients': {
          const { data } = await ctx.supabase.from('etablissements').select('created_at').gte('created_at', startDate.toISOString()).eq('statut', 'production');
          (data || []).forEach(e => { const m = e.created_at.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
          break;
        }
        case 'tasks_completed': {
          const { data } = await ctx.supabase.from('taches').select('updated_at').eq('statut', 'termine').gte('updated_at', startDate.toISOString());
          (data || []).forEach(t => { const m = t.updated_at.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
          break;
        }
        case 'emails': {
          const { data } = await ctx.supabase.from('email_messages').select('received_at').gte('received_at', startDate.toISOString());
          (data || []).forEach(e => { const m = e.received_at.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
          break;
        }
      }
      return byMonth;
    };

    const dataA = await getMonthlyData(args.metric_a);
    const dataB = await getMonthlyData(args.metric_b);

    // Aligner les mois
    const allMonths = [...new Set([...Object.keys(dataA), ...Object.keys(dataB)])].sort();
    const paired = allMonths.map(m => ({ month: m, a: dataA[m] || 0, b: dataB[m] || 0 }));

    if (paired.length < 3) {
      return { success: false, error: 'Données insuffisantes pour une analyse de corrélation', execution_time_ms: Date.now() - start };
    }

    // Calcul du coefficient de corrélation de Pearson
    const n = paired.length;
    const sumA = paired.reduce((s, p) => s + p.a, 0);
    const sumB = paired.reduce((s, p) => s + p.b, 0);
    const sumAB = paired.reduce((s, p) => s + p.a * p.b, 0);
    const sumA2 = paired.reduce((s, p) => s + p.a * p.a, 0);
    const sumB2 = paired.reduce((s, p) => s + p.b * p.b, 0);

    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    const correlation = denominator !== 0 ? numerator / denominator : 0;

    // Interprétation
    let interpretation = '';
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.7) interpretation = correlation > 0 ? 'Forte corrélation positive' : 'Forte corrélation négative';
    else if (absCorr >= 0.4) interpretation = correlation > 0 ? 'Corrélation positive modérée' : 'Corrélation négative modérée';
    else if (absCorr >= 0.2) interpretation = correlation > 0 ? 'Faible corrélation positive' : 'Faible corrélation négative';
    else interpretation = 'Pas de corrélation significative';

    return { 
      success: true, 
      data: { 
        metric_a: args.metric_a,
        metric_b: args.metric_b,
        correlation_coefficient: Math.round(correlation * 1000) / 1000,
        interpretation,
        data_points: paired,
        period_months: periodMonths,
        sample_size: n
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Correlation analysis failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetPerformanceScore(ctx: ToolContext, args: { scope?: string; entity_id?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const scores: Record<string, { score: number; factors: Record<string, number> }> = {};

    if (!args.scope || args.scope === 'global') {
      // Score global de l'organisation
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [tasks, tickets, revenue] = await Promise.all([
        ctx.supabase.from('taches').select('statut').gte('created_at', monthStart.toISOString()),
        ctx.supabase.from('support_tickets').select('status, resolved_at, created_at').gte('created_at', monthStart.toISOString()),
        ctx.supabase.from('tresorerie_revenus').select('montant').gte('date_reception', monthStart.toISOString())
      ]);

      const taskCompletion = tasks.data?.length ? (tasks.data.filter(t => t.statut === 'termine').length / tasks.data.length) * 100 : 50;
      const ticketResolution = tickets.data?.length ? (tickets.data.filter(t => ['resolved', 'closed'].includes(t.status)).length / tickets.data.length) * 100 : 50;
      
      scores.global = {
        score: Math.round((taskCompletion * 0.4 + ticketResolution * 0.4 + 50 * 0.2)),
        factors: {
          task_completion: Math.round(taskCompletion),
          ticket_resolution: Math.round(ticketResolution),
          revenue_health: 50 // Placeholder
        }
      };
    }

    if (args.scope === 'team_member' && args.entity_id) {
      const [tasks, tickets] = await Promise.all([
        ctx.supabase.from('taches').select('statut').eq('responsable_id', args.entity_id),
        ctx.supabase.from('support_tickets').select('status').eq('assigned_to', args.entity_id)
      ]);

      const taskCompletion = tasks.data?.length ? (tasks.data.filter(t => t.statut === 'termine').length / tasks.data.length) * 100 : 50;
      const ticketResolution = tickets.data?.length ? (tickets.data.filter(t => ['resolved', 'closed'].includes(t.status)).length / tickets.data.length) * 100 : 50;

      scores.team_member = {
        score: Math.round((taskCompletion * 0.5 + ticketResolution * 0.5)),
        factors: {
          task_completion: Math.round(taskCompletion),
          ticket_resolution: Math.round(ticketResolution)
        }
      };
    }

    return { 
      success: true, 
      data: { 
        scores,
        calculated_at: new Date().toISOString()
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Performance score failed', execution_time_ms: Date.now() - start };
  }
}
