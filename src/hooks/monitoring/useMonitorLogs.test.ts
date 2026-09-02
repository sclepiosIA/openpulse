import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMonitorLogs } from './useMonitorLogs';
import type { MonitorSeverity } from './useMonitorLogs';

const h = vi.hoisted(() => {
  const NOW = Date.now();
  const ts = (hoursAgo: number) => new Date(NOW - hoursAgo * 3600000).toISOString();

  const DATA: Record<string, Array<Record<string, unknown>>> = {
    frontend_error_logs: [
      {
        id: 'fe1',
        created_at: ts(1),
        user_id: 'u1',
        error_message: 'Boom',
        error_stack: 'stack-trace',
        error_type: 'react_boundary',
        component_name: 'App',
        current_route: '/',
        browser_info: null,
        metadata: null,
        fingerprint: 'fp1',
      },
      {
        id: 'fe2',
        created_at: ts(2),
        user_id: 'u1',
        error_message: 'Boom',
        error_stack: null,
        error_type: 'runtime',
        component_name: null,
        current_route: '/',
        browser_info: null,
        metadata: null,
        fingerprint: 'fp1',
      },
    ],
    ai_processing_log: [
      {
        id: 'ai1',
        processed_at: ts(3),
        processing_type: 'summarize',
        error_message: 'AI timeout',
        processing_duration_ms: 90000,
        processed_by: 'u2',
        model_used: 'gpt',
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        context_type: 'email',
      },
    ],
    email_sync_logs: [
      {
        id: 'es1',
        execution_start: ts(4),
        execution_end: ts(4),
        error_details: 'IMAP down',
        status: 'error',
        emails_fetched: 0,
      },
    ],
    api_logs: [
      {
        id: 'api1',
        created_at: ts(5),
        endpoint: '/v1/x',
        method: 'POST',
        status_code: 500,
        error_message: null,
        duration_ms: 120,
        user_agent: 'ua',
      },
    ],
    security_logs: [
      {
        id: 'sec1',
        created_at: ts(6),
        user_id: 'u3',
        user_email: 'sec@test.co',
        log_type: 'login_fail',
        risk_level: 'high',
        ip_address: '1.2.3.4',
        metadata: null,
      },
    ],
    user_feedbacks: [
      {
        id: 'fb1',
        created_at: ts(7),
        user_id: 'u1',
        type: 'bug',
        title: 'Crash app',
        description: 'desc',
        status: 'open',
        console_logs: null,
        current_route: '/',
        browser_info: null,
        priority: 'critical',
      },
    ],
  };

  const COUNTS: Record<string, number> = {
    ai_processing_log: 10,
  };

  const state: { error: Error | null } = { error: null };

  const mockFrom = vi.fn((table: string) => {
    let isCount = false;
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) isCount = true;
      return builder;
    });
    for (const m of ['eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete', 'single', 'maybeSingle']) {
      if (!builder[m]) builder[m] = vi.fn(chain);
    }
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      const res = isCount
        ? { count: state.error ? null : COUNTS[table] ?? 0, error: state.error }
        : { data: state.error ? null : DATA[table] ?? [], error: state.error };
      return Promise.resolve(res).then(resolve, reject);
    };
    builder.catch = (reject: (e: unknown) => unknown) => Promise.resolve(undefined).catch(reject);
    return builder;
  });

  return { mockFrom, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: h.mockFrom },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  h.state.error = null;
  h.mockFrom.mockClear();
});

describe('useMonitorLogs', () => {
  it('démarre sans logs puis agrège les 7 sources avec des KPIs corrects', async () => {
    const { result } = renderHook(() => useMonitorLogs(), { wrapper: createWrapper() });

    expect(result.current.allLogs).toHaveLength(0);
    expect(result.current.kpis.errors24h).toBe(0);
    expect(result.current.kpis.aiSuccessRate).toBe(100);

    await waitFor(() => {
      expect(result.current.allLogs).toHaveLength(7);
    });

    const tables = h.mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).toContain('frontend_error_logs');
    expect(tables).toContain('ai_processing_log');
    expect(tables).toContain('email_sync_logs');
    expect(tables).toContain('api_logs');
    expect(tables).toContain('security_logs');
    expect(tables).toContain('user_feedbacks');

    // KPIs métier
    expect(result.current.kpis.frontendErrors).toBe(2);
    expect(result.current.kpis.syncErrors).toBe(1);
    expect(result.current.kpis.feedbackBugs).toBe(1);
    expect(result.current.kpis.securityAlerts).toBe(1);
    expect(result.current.kpis.apiErrors).toBe(1);
    // 10 total IA, 1 erreur → 90%
    expect(result.current.kpis.aiSuccessRate).toBe(90);
    // Tous les logs sont dans les dernières 24h ; severities error/critical sauf 'feedback' critical compté aussi
    // fe1 critical, fe2 error, ai1 critical, es1 error, api1 critical, fb1 critical = 6 ; sec1 = critical = 7
    expect(result.current.kpis.errors24h).toBe(7);

    expect(result.current.hasError).toBe(false);
    expect(result.current.errorInfos).toHaveLength(0);
  });

  it('mappe correctement les logs unifiés (sévérités, ids, tri décroissant)', async () => {
    const { result } = renderHook(() => useMonitorLogs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.allLogs).toHaveLength(7);
    });

    const logs = result.current.allLogs;

    // Tri décroissant par timestamp : fe1 (1h) en premier, fb1 (7h) en dernier
    expect(logs[0].id).toBe('fe-fe1');
    expect(logs[logs.length - 1].id).toBe('fb-fb1');

    const byId = new Map(logs.map((l) => [l.id, l]));

    const fe1 = byId.get('fe-fe1');
    expect(fe1?.severity).toBe('critical'); // react_boundary
    expect(fe1?.source).toBe('frontend');
    expect(fe1?.message).toBe('Boom');

    const fe2 = byId.get('fe-fe2');
    expect(fe2?.severity).toBe('error');

    const ai1 = byId.get('ai-ai1');
    expect(ai1?.severity).toBe('critical'); // > 80000ms
    expect(ai1?.message).toBe('AI timeout');
    expect(ai1?.metadata?.model).toBe('gpt');

    const api1 = byId.get('api-api1');
    expect(api1?.severity).toBe('critical'); // 500
    expect(api1?.type).toBe('POST 500');
    expect(api1?.message).toBe('POST /v1/x → 500');

    const sec1 = byId.get('sec-sec1');
    expect(sec1?.severity).toBe('critical'); // risk_level high
    expect(sec1?.userEmail).toBe('sec@test.co');

    const es1 = byId.get('email-es1');
    expect(es1?.message).toBe('IMAP down');

    const fb1 = byId.get('fb-fb1');
    expect(fb1?.severity).toBe('critical'); // priority critical
    expect(fb1?.message).toBe('Crash app');
  });

  it('détecte les patterns récurrents (fingerprint avec count >= 2)', async () => {
    const { result } = renderHook(() => useMonitorLogs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.allLogs).toHaveLength(7);
    });

    expect(result.current.recurringPatterns).toHaveLength(1);
    const pattern = result.current.recurringPatterns[0];
    expect(pattern.fingerprint).toBe('frontend:Boom');
    expect(pattern.count).toBe(2);
    expect(pattern.source).toBe('frontend');
    expect(pattern.message).toBe('Boom');
  });

  it('expose les utilisateurs uniques extraits des logs', async () => {
    const { result } = renderHook(() => useMonitorLogs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.allLogs).toHaveLength(7);
    });

    const ids = result.current.uniqueUsers.map((u: { id: string }) => u.id);
    expect(ids).toContain('u1');
    expect(ids).toContain('u2');
    expect(ids).toContain('u3');
    expect(ids).toHaveLength(3);
  });

  it('filtre les logs par onglet, sévérité et recherche', async () => {
    const { result } = renderHook(() => useMonitorLogs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.allLogs).toHaveLength(7);
    });

    // Onglet frontend
    await act(async () => {
      result.current.setActiveTab('frontend');
    });
    expect(result.current.filteredLogs).toHaveLength(2);
    expect(result.current.filteredLogs.every((l) => l.source === 'frontend')).toBe(true);

    // Sévérité critical dans l'onglet frontend → fe1 uniquement
    await act(async () => {
      result.current.setSeverityFilter('critical' as MonitorSeverity);
    });
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].id).toBe('fe-fe1');

    // Retour global + recherche
    await act(async () => {
      result.current.setActiveTab('global');
      result.current.setSeverityFilter('all' as MonitorSeverity);
      result.current.setSearchTerm('imap');
    });
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].id).toBe('email-es1');
  });

  it('signale les erreurs de requête via hasError et errorInfos', async () => {
    h.state.error = new Error('connexion refusée');

    const { result } = renderHook(() => useMonitorLogs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });

    expect(result.current.errorInfos.length).toBeGreaterThan(0);
    expect(result.current.errorInfos[0].message).toBe('connexion refusée');
    const sources = result.current.errorInfos.map((e: { source: string }) => e.source);
    expect(sources).toContain('Frontend');
    expect(result.current.allLogs).toHaveLength(0);
  });
});