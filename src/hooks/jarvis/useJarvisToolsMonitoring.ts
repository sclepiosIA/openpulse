/**
 * useJarvisToolsMonitoring - Hook pour le monitoring détaillé des outils Jarvis
 * 
 * Fournit des métriques complètes par outil : latence (P50, P90, P99), taux de succès, coûts
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

// Pricing Azure GPT-5 (estimations)
const PRICE_PER_1K_INPUT_TOKENS = 0.01;
const PRICE_PER_1K_OUTPUT_TOKENS = 0.03;

export interface ToolMetrics {
  toolName: string;
  displayName: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  totalTokens: number;
  avgTokensPerCall: number;
  estimatedCost: number;
  lastUsed: string | null;
  trend: {
    latencyChange: number; // % change vs previous period
    successRateChange: number;
    callCountChange: number;
  };
}

export interface DailyToolMetric {
  date: string;
  toolName: string;
  calls: number;
  successRate: number;
  avgLatency: number;
  tokens: number;
}

export interface ToolsMonitoringData {
  tools: ToolMetrics[];
  totals: {
    totalCalls: number;
    totalSuccess: number;
    overallSuccessRate: number;
    avgLatency: number;
    p90Latency: number;
    totalTokens: number;
    estimatedCost: number;
  };
  dailyMetrics: DailyToolMetric[];
  latencyDistribution: { bucket: string; count: number }[];
  topErrorTools: { toolName: string; errorCount: number; errorRate: number }[];
  recentErrors: { toolName: string; errorMessage: string; timestamp: string }[];
}

interface ProcessingLog {
  processing_type: string;
  processing_duration_ms: number | null;
  success: boolean;
  error_message: string | null;
  total_tokens: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  processed_at: string;
}

// Map des noms techniques vers des noms lisibles
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // Core Jarvis tools
  'query_database': 'Requête base de données',
  'create_task': 'Création de tâche',
  'update_task': 'Mise à jour tâche',
  'web_scrape': 'Extraction web',
  'web_search': 'Recherche web',
  'search_knowledge_base': 'Recherche KB',
  'get_user_context': 'Contexte utilisateur',
  'calculate_metrics': 'Calcul métriques',
  'generate_briefing': 'Génération briefing',
  'suggest_actions': 'Suggestions actions',
  'get_dashboard_summary': 'Résumé dashboard',
  'send_email': 'Envoi email',
  'draft_email': 'Brouillon email',
  // Email processing
  'extraction': 'Classification email',
  'email_spelling': 'Correction orthographique',
  'email_reformulate': 'Reformulation email',
  'email_translate': 'Traduction email',
  'email_title_generation': 'Génération titre',
  'email_suggestion': 'Suggestion réponse',
  'email_summary': 'Résumé thread',
  // Jarvis Brain
  'jarvis_brain': 'Jarvis Brain',
  'jarvis_chat': 'Jarvis Chat',
  'jarvis_streaming': 'Jarvis Streaming',
  // R&D
  'rd_assist': 'Assistance R&D',
  // CRM
  'suggestion_generation': 'Suggestions IA CRM',
  'rapports_insights': 'Analyse rapports',
  'data_query': 'Requête données',
  // RH
  'rh_bulletin_parsing': 'Parsing bulletin paie',
  // Calendar
  'calendar_detection': 'Détection calendrier',
  'calendar_ai_create': 'Création événement IA',
  // Other
  'audio_transcription': 'Transcription audio',
  'medical_economic_study_analysis': 'Analyse médico-éco',
};

function getDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function useJarvisToolsMonitoring(periodDays: number = 30) {
  return useQuery({
    queryKey: ['jarvis-tools-monitoring', periodDays],
    queryFn: async (): Promise<ToolsMonitoringData> => {
      const now = new Date();
      const periodStart = subDays(now, periodDays);
      const previousPeriodStart = subDays(now, periodDays * 2);

      // Fetch current period logs
      const { data: currentLogs, error: currentError } = await supabase
        .from('ai_processing_log')
        .select('processing_type, processing_duration_ms, success, error_message, total_tokens, prompt_tokens, completion_tokens, processed_at')
        .gte('processed_at', periodStart.toISOString())
        .order('processed_at', { ascending: false });

      if (currentError) throw currentError;

      // Fetch previous period for trends
      const { data: previousLogs, error: previousError } = await supabase
        .from('ai_processing_log')
        .select('processing_type, processing_duration_ms, success, total_tokens')
        .gte('processed_at', previousPeriodStart.toISOString())
        .lt('processed_at', periodStart.toISOString());

      if (previousError) throw previousError;

      const logs = (currentLogs || []) as ProcessingLog[];
      const prevLogs = (previousLogs || []) as ProcessingLog[];

      // Group by tool
      const toolsMap = new Map<string, ProcessingLog[]>();
      logs.forEach(log => {
        const toolName = log.processing_type || 'unknown';
        if (!toolsMap.has(toolName)) {
          toolsMap.set(toolName, []);
        }
        toolsMap.get(toolName)!.push(log);
      });

      // Previous period metrics for trends
      const prevToolsMap = new Map<string, ProcessingLog[]>();
      prevLogs.forEach(log => {
        const toolName = log.processing_type || 'unknown';
        if (!prevToolsMap.has(toolName)) {
          prevToolsMap.set(toolName, []);
        }
        prevToolsMap.get(toolName)!.push(log);
      });

      // Calculate metrics per tool
      const tools: ToolMetrics[] = Array.from(toolsMap.entries()).map(([toolName, toolLogs]) => {
        const latencies = toolLogs
          .map(l => l.processing_duration_ms)
          .filter((l): l is number => l !== null && l > 0);

        const successCount = toolLogs.filter(l => l.success).length;
        const failureCount = toolLogs.length - successCount;
        const successRate = toolLogs.length > 0 ? (successCount / toolLogs.length) * 100 : 0;

        const totalTokens = toolLogs.reduce((sum, l) => sum + (l.total_tokens || 0), 0);
        const promptTokens = toolLogs.reduce((sum, l) => sum + (l.prompt_tokens || 0), 0);
        const completionTokens = toolLogs.reduce((sum, l) => sum + (l.completion_tokens || 0), 0);

        const estimatedCost = 
          (promptTokens / 1000) * PRICE_PER_1K_INPUT_TOKENS +
          (completionTokens / 1000) * PRICE_PER_1K_OUTPUT_TOKENS;

        // Previous period for trends
        const prevToolLogs = prevToolsMap.get(toolName) || [];
        const prevLatencies = prevToolLogs
          .map(l => l.processing_duration_ms)
          .filter((l): l is number => l !== null && l > 0);
        const prevAvgLatency = prevLatencies.length > 0 
          ? prevLatencies.reduce((a, b) => a + b, 0) / prevLatencies.length 
          : 0;
        const prevSuccessRate = prevToolLogs.length > 0 
          ? (prevToolLogs.filter(l => l.success).length / prevToolLogs.length) * 100 
          : 0;

        const avgLatency = latencies.length > 0 
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
          : 0;

        const latestLog = toolLogs[0];

        return {
          toolName,
          displayName: getDisplayName(toolName),
          callCount: toolLogs.length,
          successCount,
          failureCount,
          successRate,
          avgLatencyMs: avgLatency,
          p50LatencyMs: calculatePercentile(latencies, 50),
          p90LatencyMs: calculatePercentile(latencies, 90),
          p99LatencyMs: calculatePercentile(latencies, 99),
          minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
          maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
          totalTokens,
          avgTokensPerCall: toolLogs.length > 0 ? totalTokens / toolLogs.length : 0,
          estimatedCost,
          lastUsed: latestLog?.processed_at || null,
          trend: {
            latencyChange: prevAvgLatency > 0 
              ? ((avgLatency - prevAvgLatency) / prevAvgLatency) * 100 
              : 0,
            successRateChange: prevSuccessRate > 0 
              ? successRate - prevSuccessRate 
              : 0,
            callCountChange: prevToolLogs.length > 0 
              ? ((toolLogs.length - prevToolLogs.length) / prevToolLogs.length) * 100 
              : 0,
          },
        };
      }).sort((a, b) => b.callCount - a.callCount);

      // Calculate totals
      const allLatencies = logs
        .map(l => l.processing_duration_ms)
        .filter((l): l is number => l !== null && l > 0);

      const totalTokens = logs.reduce((sum, l) => sum + (l.total_tokens || 0), 0);
      const totalPromptTokens = logs.reduce((sum, l) => sum + (l.prompt_tokens || 0), 0);
      const totalCompletionTokens = logs.reduce((sum, l) => sum + (l.completion_tokens || 0), 0);

      const totals = {
        totalCalls: logs.length,
        totalSuccess: logs.filter(l => l.success).length,
        overallSuccessRate: logs.length > 0 
          ? (logs.filter(l => l.success).length / logs.length) * 100 
          : 0,
        avgLatency: allLatencies.length > 0 
          ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length 
          : 0,
        p90Latency: calculatePercentile(allLatencies, 90),
        totalTokens,
        estimatedCost: 
          (totalPromptTokens / 1000) * PRICE_PER_1K_INPUT_TOKENS +
          (totalCompletionTokens / 1000) * PRICE_PER_1K_OUTPUT_TOKENS,
      };

      // Daily metrics
      const dailyMap = new Map<string, Map<string, ProcessingLog[]>>();
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(now, i), 'yyyy-MM-dd');
        dailyMap.set(date, new Map());
      }

      logs.forEach(log => {
        const date = format(new Date(log.processed_at), 'yyyy-MM-dd');
        if (dailyMap.has(date)) {
          const toolName = log.processing_type || 'unknown';
          const dateTools = dailyMap.get(date)!;
          if (!dateTools.has(toolName)) {
            dateTools.set(toolName, []);
          }
          dateTools.get(toolName)!.push(log);
        }
      });

      const dailyMetrics: DailyToolMetric[] = [];
      dailyMap.forEach((toolsForDay, date) => {
        toolsForDay.forEach((toolLogs, toolName) => {
          const latencies = toolLogs
            .map(l => l.processing_duration_ms)
            .filter((l): l is number => l !== null);
          
          dailyMetrics.push({
            date,
            toolName,
            calls: toolLogs.length,
            successRate: toolLogs.length > 0 
              ? (toolLogs.filter(l => l.success).length / toolLogs.length) * 100 
              : 0,
            avgLatency: latencies.length > 0 
              ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
              : 0,
            tokens: toolLogs.reduce((sum, l) => sum + (l.total_tokens || 0), 0),
          });
        });
      });

      // Latency distribution buckets
      const buckets = [
        { min: 0, max: 500, label: '<500ms' },
        { min: 500, max: 1000, label: '500-1s' },
        { min: 1000, max: 2000, label: '1-2s' },
        { min: 2000, max: 5000, label: '2-5s' },
        { min: 5000, max: 10000, label: '5-10s' },
        { min: 10000, max: Infinity, label: '>10s' },
      ];

      const latencyDistribution = buckets.map(bucket => ({
        bucket: bucket.label,
        count: allLatencies.filter(l => l >= bucket.min && l < bucket.max).length,
      }));

      // Top error tools
      const topErrorTools = tools
        .filter(t => t.failureCount > 0)
        .map(t => ({
          toolName: t.displayName,
          errorCount: t.failureCount,
          errorRate: 100 - t.successRate,
        }))
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 5);

      // Recent errors
      const recentErrors = logs
        .filter(l => !l.success && l.error_message)
        .slice(0, 10)
        .map(l => ({
          toolName: getDisplayName(l.processing_type),
          errorMessage: l.error_message || 'Erreur inconnue',
          timestamp: l.processed_at,
        }));

      return {
        tools,
        totals,
        dailyMetrics,
        latencyDistribution,
        topErrorTools,
        recentErrors,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

// Helpers
export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function getHealthStatus(successRate: number, avgLatency: number): 'excellent' | 'good' | 'degraded' | 'critical' {
  if (successRate >= 98 && avgLatency < 2000) return 'excellent';
  if (successRate >= 95 && avgLatency < 5000) return 'good';
  if (successRate >= 90 && avgLatency < 10000) return 'degraded';
  return 'critical';
}
