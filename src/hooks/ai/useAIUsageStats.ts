import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DailyStat {
  date: string;
  calls: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

interface TypeStat {
  type: string;
  count: number;
  tokens: number;
  avgDuration: number;
  cost: number;
  avgCostPerCall: number;
  successRate?: number;
}

interface ModelStat {
  model: string;
  count: number;
  tokens: number;
  cost: number;
}

export interface ProcessingTypeStat {
  type: string;
  count: number;
  tokens: number;
  cost: number;
  successRate: number;
  avgDuration: number;
}

export interface ErrorStat {
  message: string;
  count: number;
  lastSeen: string;
}

export interface TopThreadConsumer {
  threadId: string;
  subject: string;
  passages: number;
  totalTokens: number;
  estimatedCost: number;
  lastProcessed: string;
}

export interface AIUsageStats {
  totalCalls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  successRate: number;
  avgProcessingTime: number;
  avgCostPerCall: number;
  
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  tokensToday: number;
  tokensThisWeek: number;
  tokensThisMonth: number;
  costToday: number;
  costThisWeek: number;
  costThisMonth: number;
  
  callsByType: TypeStat[];
  callsByModel: ModelStat[];
  dailyStats: DailyStat[];
  recentLogs: AIUsageLogLike[];

  callsByProcessingType: Map<string, ProcessingTypeStat>;
  errorsByModel: Map<string, { count: number; recent: AIUsageLogLike[] }>;
  topErrors: ErrorStat[];
  topThreadConsumers: TopThreadConsumer[];
}

// Logs IA bruts : champs hétérogènes selon le type d'appel (signature dynamique côté RPC).
// On reste permissif côté consommateur (`any` interne) sans exposer le `any` à l'API publique.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIUsageLogLike = Record<string, any>;
interface TypeStatRaw {
  type: string;
  count: number;
  tokens: number;
  cost: number;
  successRate?: number;
  avgDuration: number;
  [key: string]: unknown;
}

export function useAIUsageStats() {
  return useQuery({
    queryKey: ['ai-usage-stats'],
    queryFn: async (): Promise<AIUsageStats> => {
      // Timeout 20s pour éviter "Chargement..." infini si la RPC traîne
      // (audit v3-azure-verify 20260516T114510Z — /parametres/ia-usage stuck)
      const rpcPromise = supabase.rpc(
        'get_ai_usage_stats' as never,
        { p_days: 30 } as never
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Délai dépassé (20s) pour récupérer les statistiques IA. Réessayez.')), 20000)
      );
      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as Awaited<typeof rpcPromise>;
      if (error) throw error;

      const raw = data as Record<string, any> & {
        callsByType?: TypeStatRaw[];
        recentLogs?: AIUsageLogLike[];
      };

      // Build callsByType with avgCostPerCall
      const callsByType: TypeStat[] = (raw.callsByType || []).map((t: TypeStatRaw) => ({
        ...t,
        avgCostPerCall: t.count > 0 ? t.cost / t.count : 0,
      }));

      // Build callsByProcessingType Map from callsByType
      const callsByProcessingType = new Map<string, ProcessingTypeStat>();
      callsByType.forEach(t => {
        callsByProcessingType.set(t.type, {
          type: t.type,
          count: t.count,
          tokens: t.tokens,
          cost: t.cost,
          successRate: t.successRate || 100,
          avgDuration: t.avgDuration,
        });
      });

      // errorsByModel: derive from recentLogs errors grouped by model
      const errorsByModel = new Map<string, { count: number; recent: AIUsageLogLike[] }>();
      const failedLogs = (raw.recentLogs || []).filter((l) => !l.success);
      failedLogs.forEach((log) => {
        const model = log.model_used || 'unknown';
        const existing = errorsByModel.get(model) || { count: 0, recent: [] as AIUsageLogLike[] };
        existing.count += 1;
        if (existing.recent.length < 10) existing.recent.push(log);
        errorsByModel.set(model, existing);
      });

      return {
        totalCalls: raw.totalCalls || 0,
        totalTokens: raw.totalTokens || 0,
        promptTokens: raw.promptTokens || 0,
        completionTokens: raw.completionTokens || 0,
        estimatedCost: raw.estimatedCost || 0,
        successRate: raw.successRate || 100,
        avgProcessingTime: raw.avgProcessingTime || 0,
        avgCostPerCall: raw.avgCostPerCall || 0,

        callsToday: raw.callsToday || 0,
        callsThisWeek: raw.callsThisWeek || 0,
        callsThisMonth: raw.callsThisMonth || 0,
        tokensToday: raw.tokensToday || 0,
        tokensThisWeek: raw.tokensThisWeek || 0,
        tokensThisMonth: raw.tokensThisMonth || 0,
        costToday: raw.costToday || 0,
        costThisWeek: raw.costThisWeek || 0,
        costThisMonth: raw.costThisMonth || 0,

        callsByType,
        callsByModel: raw.callsByModel || [],
        dailyStats: raw.dailyStats || [],
        recentLogs: raw.recentLogs || [],

        callsByProcessingType,
        errorsByModel,
        topErrors: raw.topErrors || [],
        topThreadConsumers: raw.topThreadConsumers || [],
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

// Formatting helpers (kept as-is)
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

export function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

export function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function getProcessingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    extraction: 'Classification Email',
    email_spelling: 'Correction ortho.',
    email_reformulate: 'Reformulation',
    email_translate: 'Traduction',
    email_title_generation: 'Titre thread',
    email_suggestion: 'Suggestion email',
    email_summary: 'Résumé thread',
    pulse_chat: 'Pulse Chat',
    pulse_editor: 'Pulse Éditeur',
    pulse_summarize: 'Pulse Résumé',
    rd_assist: 'R&D Assistance',
    suggestion_generation: 'Suggestions IA',
    rapports_insights: 'Analyse rapports',
    data_query: 'Requête données',
    smart_tasks: 'Tâches intelligentes',
    rh_bulletin_parsing: 'Parsing bulletin',
    calendar_detection: 'Détection agenda',
    calendar_ai_create: 'Création agenda IA',
    visio_summary: 'Résumé visio',
    'jarvis-chat': 'Jarvis Chat',
    'jarvis-vision-screenshot': 'Jarvis Vision',
    'jarvis-vision-document': 'Jarvis Doc Vision',
    audio_transcription: 'Transcription audio',
    simulator_data_analysis: 'Analyse simulateur',
    medical_economic_study_analysis: 'Étude médico-éco',
  };
  return labels[type] || type;
}
