import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useCallback } from "react";
import { subDays, subHours, isAfter, format } from "date-fns";

export type MonitorSource = 'frontend' | 'ai' | 'email_sync' | 'api' | 'security' | 'feedback';

export interface MonitorLogEntry {
  id: string;
  timestamp: string;
  source: MonitorSource;
  severity: 'critical' | 'error' | 'warning' | 'info';
  type: string;
  message: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
}

export type MonitorPeriod = '24h' | '7d' | '30d';
export type MonitorSeverity = 'all' | 'critical' | 'error' | 'warning' | 'info';

export interface MonitorKPIs {
  errors24h: number;
  aiSuccessRate: number;
  syncErrors: number;
  feedbackBugs: number;
  securityAlerts: number;
  frontendErrors: number;
  apiErrors: number;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  frontend: number;
  ai: number;
  email: number;
  api: number;
  security: number;
  feedback: number;
}

export interface RecurringPattern {
  fingerprint: string;
  message: string;
  source: MonitorSource;
  count: number;
  lastSeen: string;
  firstSeen: string;
}

export interface MonitorErrorInfo {
  source: string;
  message: string;
}

function getSinceDateISO(period: MonitorPeriod): string {
  const now = new Date();
  switch (period) {
    case '24h': return subHours(now, 24).toISOString();
    case '7d': return subDays(now, 7).toISOString();
    case '30d': return subDays(now, 30).toISOString();
  }
}

const REFETCH_INTERVAL = 60_000;
const STALE_TIME = 2 * 60 * 1000;
const DEFAULT_DISPLAY_COUNT = 100;
const DISPLAY_INCREMENT = 100;

export function useMonitorLogs() {
  const [period, setPeriod] = useState<MonitorPeriod>('7d');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<MonitorSeverity>('all');
  const [activeTab, setActiveTab] = useState('global');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<MonitorSource | 'all'>('all');
  const [displayCount, setDisplayCount] = useState(DEFAULT_DISPLAY_COUNT);

  const queryClient = useQueryClient();
  const sinceDate = getSinceDateISO(period);

  // Reset displayCount when filters change
  const setPeriodWrapped = useCallback((p: MonitorPeriod) => { setPeriod(p); setDisplayCount(DEFAULT_DISPLAY_COUNT); }, []);
  const setActiveTabWrapped = useCallback((t: string) => { setActiveTab(t); setDisplayCount(DEFAULT_DISPLAY_COUNT); }, []);

  const queryOpts = { staleTime: STALE_TIME, refetchInterval: REFETCH_INTERVAL };

  // Frontend errors
  const frontendQuery = useQuery({
    queryKey: ['monitor-frontend-errors', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frontend_error_logs')
        .select('id, created_at, user_id, error_message, error_stack, error_type, component_name, current_route, browser_info, metadata, fingerprint')
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    ...queryOpts,
  });

  // AI errors
  const aiQuery = useQuery({
    queryKey: ['monitor-ai-errors', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_processing_log')
        .select('id, processed_at, processing_type, error_message, processing_duration_ms, processed_by, model_used, prompt_tokens, completion_tokens, total_tokens, context_type')
        .eq('success', false)
        .gte('processed_at', sinceDate)
        .order('processed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    ...queryOpts,
  });

  // AI total for success rate
  const aiTotalQuery = useQuery({
    queryKey: ['monitor-ai-total', period],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ai_processing_log')
        .select('id', { count: 'exact', head: true })
        .gte('processed_at', sinceDate);
      if (error) throw error;
      return count || 0;
    },
    ...queryOpts,
  });

  // Email sync errors
  const emailSyncQuery = useQuery({
    queryKey: ['monitor-email-sync-errors', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sync_logs')
        .select('id, execution_start, execution_end, error_details, status, emails_fetched')
        .eq('status', 'error')
        .gte('execution_start', sinceDate)
        .order('execution_start', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    ...queryOpts,
  });

  // API errors (status >= 400)
  const apiQuery = useQuery({
    queryKey: ['monitor-api-errors', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_logs')
        .select('id, created_at, endpoint, method, status_code, error_message, duration_ms, user_agent')
        .gte('status_code', 400)
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    ...queryOpts,
  });

  // Security logs
  const securityQuery = useQuery({
    queryKey: ['monitor-security-logs', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_logs')
        .select('id, created_at, user_id, user_email, log_type, risk_level, ip_address, metadata')
        .in('risk_level', ['high', 'medium'])
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    ...queryOpts,
  });

  // User feedbacks (bugs)
  const feedbackQuery = useQuery({
    queryKey: ['monitor-feedbacks-bugs', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_feedbacks')
        .select('id, created_at, user_id, type, title, description, status, console_logs, current_route, browser_info, priority')
        .eq('type', 'bug')
        .neq('status', 'resolved')
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    ...queryOpts,
  });

  // Error aggregation
  const queries = [
    { name: 'Frontend', query: frontendQuery },
    { name: 'IA', query: aiQuery },
    { name: 'AI Total', query: aiTotalQuery },
    { name: 'Email Sync', query: emailSyncQuery },
    { name: 'API', query: apiQuery },
    { name: 'Sécurité', query: securityQuery },
    { name: 'Feedbacks', query: feedbackQuery },
  ];

  const errorInfos = useMemo<MonitorErrorInfo[]>(() => {
    return queries
      .filter(q => q.query.isError)
      .map(q => ({
        source: q.name,
        message: q.query.error instanceof Error ? q.query.error.message : 'Erreur inconnue',
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontendQuery.isError, aiQuery.isError, aiTotalQuery.isError, emailSyncQuery.isError, apiQuery.isError, securityQuery.isError, feedbackQuery.isError]);

  const hasError = errorInfos.length > 0;

  const retryAll = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('monitor-');
      },
    });
    for (const q of queries) {
      if (q.query.isError) {
        q.query.refetch();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // Unified logs
  const allLogs = useMemo<MonitorLogEntry[]>(() => {
    const logs: MonitorLogEntry[] = [];

    for (const fe of frontendQuery.data || []) {
      logs.push({
        id: `fe-${fe.id}`,
        timestamp: fe.created_at,
        source: 'frontend',
        severity: fe.error_type === 'react_boundary' ? 'critical' : 'error',
        type: fe.error_type || 'runtime',
        message: fe.error_message,
        userId: fe.user_id || undefined,
        metadata: {
          stack: fe.error_stack,
          component: fe.component_name,
          route: fe.current_route,
          browser: fe.browser_info,
          fingerprint: fe.fingerprint,
          ...(fe.metadata as Record<string, unknown> || {}),
        },
      });
    }

    for (const ai of aiQuery.data || []) {
      logs.push({
        id: `ai-${ai.id}`,
        timestamp: ai.processed_at,
        source: 'ai',
        severity: (ai.processing_duration_ms && ai.processing_duration_ms > 80000) ? 'critical' : 'error',
        type: ai.processing_type,
        message: ai.error_message || 'Erreur inconnue',
        userId: ai.processed_by || undefined,
        metadata: {
          duration_ms: ai.processing_duration_ms,
          model: ai.model_used,
          prompt_tokens: ai.prompt_tokens,
          completion_tokens: ai.completion_tokens,
          total_tokens: ai.total_tokens,
          context_type: ai.context_type,
        },
      });
    }

    for (const es of emailSyncQuery.data || []) {
      logs.push({
        id: `email-${es.id}`,
        timestamp: es.execution_start || es.execution_end || new Date().toISOString(),
        source: 'email_sync',
        severity: 'error',
        type: 'sync_error',
        message: typeof es.error_details === 'string' ? es.error_details : (es.error_details ? JSON.stringify(es.error_details) : 'Erreur de synchronisation'),
        metadata: {
          emails_fetched: es.emails_fetched,
          error_details: es.error_details,
        },
      });
    }

    for (const api of apiQuery.data || []) {
      const statusCode = api.status_code || 500;
      logs.push({
        id: `api-${api.id}`,
        timestamp: api.created_at || new Date().toISOString(),
        source: 'api',
        severity: statusCode >= 500 ? 'critical' : 'error',
        type: `${api.method} ${statusCode}`,
        message: api.error_message || `${api.method} ${api.endpoint} → ${statusCode}`,
        metadata: {
          endpoint: api.endpoint,
          method: api.method,
          status_code: statusCode,
          duration_ms: api.duration_ms,
          user_agent: api.user_agent,
        },
      });
    }

    for (const sec of securityQuery.data || []) {
      logs.push({
        id: `sec-${sec.id}`,
        timestamp: sec.created_at,
        source: 'security',
        severity: sec.risk_level === 'high' ? 'critical' : 'warning',
        type: sec.log_type,
        message: sec.log_type,
        userId: sec.user_id || undefined,
        userEmail: sec.user_email || undefined,
        metadata: {
          ip_address: sec.ip_address,
          metadata: sec.metadata,
        },
      });
    }

    for (const fb of feedbackQuery.data || []) {
      logs.push({
        id: `fb-${fb.id}`,
        timestamp: fb.created_at,
        source: 'feedback',
        severity: fb.priority === 'critical' ? 'critical' : fb.priority === 'high' ? 'error' : 'warning',
        type: 'bug_report',
        message: fb.title || fb.description || 'Bug signalé',
        userId: fb.user_id || undefined,
        metadata: {
          description: fb.description,
          console_logs: fb.console_logs,
          current_route: fb.current_route,
          browser_info: fb.browser_info,
          status: fb.status,
        },
      });
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs;
  }, [frontendQuery.data, aiQuery.data, emailSyncQuery.data, apiQuery.data, securityQuery.data, feedbackQuery.data]);

  // Extract unique users for filter
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map<string, string>();
    for (const log of allLogs) {
      const key = log.userId || log.userEmail;
      if (key && !usersMap.has(key)) {
        usersMap.set(key, log.userEmail || log.userId || key);
      }
    }
    return Array.from(usersMap.entries()).map(([id, label]) => ({ id, label }));
  }, [allLogs]);

  // Recurring patterns detection
  const recurringPatterns = useMemo<RecurringPattern[]>(() => {
    const patterns = new Map<string, { message: string; source: MonitorSource; count: number; firstSeen: string; lastSeen: string }>();

    for (const log of allLogs) {
      const fp = `${log.source}:${log.message.slice(0, 100)}`;
      const existing = patterns.get(fp);
      if (existing) {
        existing.count++;
        if (log.timestamp < existing.firstSeen) existing.firstSeen = log.timestamp;
        if (log.timestamp > existing.lastSeen) existing.lastSeen = log.timestamp;
      } else {
        patterns.set(fp, {
          message: log.message.slice(0, 150),
          source: log.source,
          count: 1,
          firstSeen: log.timestamp,
          lastSeen: log.timestamp,
        });
      }
    }

    return Array.from(patterns.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([fingerprint, v]) => ({
        fingerprint,
        message: v.message,
        source: v.source,
        count: v.count,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
      }))
      .sort((a, b) => b.count - a.count);
  }, [allLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let filtered = allLogs;

    if (activeTab === 'frontend') filtered = filtered.filter(l => l.source === 'frontend');
    else if (activeTab === 'ai') filtered = filtered.filter(l => l.source === 'ai');
    else if (activeTab === 'email') filtered = filtered.filter(l => l.source === 'email_sync');
    else if (activeTab === 'api') filtered = filtered.filter(l => l.source === 'api');
    else if (activeTab === 'security') filtered = filtered.filter(l => l.source === 'security');
    else if (activeTab === 'feedback') filtered = filtered.filter(l => l.source === 'feedback');
    else if (activeTab === 'global' && sourceFilter !== 'all') {
      filtered = filtered.filter(l => l.source === sourceFilter);
    }

    if (userFilter !== 'all') {
      filtered = filtered.filter(l => l.userId === userFilter || l.userEmail === userFilter);
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter(l => l.severity === severityFilter);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(lower) ||
        l.type.toLowerCase().includes(lower) ||
        l.userEmail?.toLowerCase().includes(lower) ||
        l.userId?.toLowerCase().includes(lower) ||
        l.source.toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [allLogs, activeTab, severityFilter, searchTerm, userFilter, sourceFilter]);

  // KPIs
  const kpis = useMemo<MonitorKPIs>(() => {
    const now24h = subHours(new Date(), 24);
    const errors24h = allLogs.filter(l =>
      (l.severity === 'error' || l.severity === 'critical') &&
      isAfter(new Date(l.timestamp), now24h)
    ).length;

    const aiErrorCount = aiQuery.data?.length || 0;
    const aiTotal = aiTotalQuery.data || 0;
    const aiSuccessRate = aiTotal > 0 ? ((aiTotal - aiErrorCount) / aiTotal) * 100 : 100;

    return {
      errors24h,
      aiSuccessRate: Math.round(aiSuccessRate * 10) / 10,
      syncErrors: emailSyncQuery.data?.length || 0,
      feedbackBugs: feedbackQuery.data?.length || 0,
      securityAlerts: securityQuery.data?.length || 0,
      frontendErrors: frontendQuery.data?.length || 0,
      apiErrors: apiQuery.data?.length || 0,
    };
  }, [allLogs, aiQuery.data, aiTotalQuery.data, emailSyncQuery.data, feedbackQuery.data, securityQuery.data, frontendQuery.data, apiQuery.data]);

  // Chart data — hourly for 24h, daily for 7d/30d
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (period === '24h') {
      // 24 hourly points
      const points: ChartDataPoint[] = [];
      for (let i = 23; i >= 0; i--) {
        const hourStart = subHours(new Date(), i);
        const hourStr = format(hourStart, 'yyyy-MM-dd HH');
        const hourLabel = format(hourStart, 'HH:mm');
        const hourLogs = allLogs.filter(l => format(new Date(l.timestamp), 'yyyy-MM-dd HH') === hourStr);
        points.push({
          date: hourStart.toISOString(),
          label: hourLabel,
          frontend: hourLogs.filter(l => l.source === 'frontend').length,
          ai: hourLogs.filter(l => l.source === 'ai').length,
          email: hourLogs.filter(l => l.source === 'email_sync').length,
          api: hourLogs.filter(l => l.source === 'api').length,
          security: hourLogs.filter(l => l.source === 'security').length,
          feedback: hourLogs.filter(l => l.source === 'feedback').length,
        });
      }
      return points;
    }

    // Daily points for 7d/30d
    const numDays = period === '7d' ? 7 : 30;
    const days: ChartDataPoint[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = day.toISOString().slice(0, 10);
      const dayLogs = allLogs.filter(l => l.timestamp.slice(0, 10) === dayStr);
      days.push({
        date: dayStr,
        label: format(day, 'dd/MM'),
        frontend: dayLogs.filter(l => l.source === 'frontend').length,
        ai: dayLogs.filter(l => l.source === 'ai').length,
        email: dayLogs.filter(l => l.source === 'email_sync').length,
        api: dayLogs.filter(l => l.source === 'api').length,
        security: dayLogs.filter(l => l.source === 'security').length,
        feedback: dayLogs.filter(l => l.source === 'feedback').length,
      });
    }
    return days;
  }, [allLogs, period]);

  const isLoading = frontendQuery.isLoading || aiQuery.isLoading || emailSyncQuery.isLoading || apiQuery.isLoading || securityQuery.isLoading || feedbackQuery.isLoading;

  const lastUpdatedAt = useMemo(() => {
    const timestamps = [
      frontendQuery.dataUpdatedAt,
      aiQuery.dataUpdatedAt,
      emailSyncQuery.dataUpdatedAt,
      apiQuery.dataUpdatedAt,
      securityQuery.dataUpdatedAt,
      feedbackQuery.dataUpdatedAt,
    ].filter(Boolean);
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }, [frontendQuery.dataUpdatedAt, aiQuery.dataUpdatedAt, emailSyncQuery.dataUpdatedAt, apiQuery.dataUpdatedAt, securityQuery.dataUpdatedAt, feedbackQuery.dataUpdatedAt]);

  const loadMore = useCallback(() => {
    setDisplayCount(prev => prev + DISPLAY_INCREMENT);
  }, []);

  return {
    filteredLogs,
    allLogs,
    kpis,
    chartData,
    recurringPatterns,
    uniqueUsers,
    isLoading,
    hasError,
    errorInfos,
    retryAll,
    displayCount,
    loadMore,
    lastUpdatedAt,
    period, setPeriod: setPeriodWrapped,
    searchTerm, setSearchTerm,
    severityFilter, setSeverityFilter,
    activeTab, setActiveTab: setActiveTabWrapped,
    userFilter, setUserFilter,
    sourceFilter, setSourceFilter,
    // Raw data for specialized tabs
    frontendErrors: frontendQuery.data || [],
    aiErrors: aiQuery.data || [],
    emailSyncErrors: emailSyncQuery.data || [],
    apiErrors: apiQuery.data || [],
    securityLogs: securityQuery.data || [],
    feedbacks: feedbackQuery.data || [],
  };
}
