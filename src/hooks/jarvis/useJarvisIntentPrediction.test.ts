import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisIntentPrediction } from './useJarvisIntentPrediction';

const { mockFrom, tableResults, LOC, AUTH, mockNavigate, mockDebugError, CONVS } = vi.hoisted(() => {
  const tableResults: Record<string, unknown> = {};

  const mockFrom = vi.fn((table: string) => {
    const result = tableResults[table] ?? { data: [], error: null, count: 0 };
    const builder: Record<string, unknown> = {};
    const chain = [
      'select', 'eq', 'neq', 'gt', 'gte', 'lte', 'in', 'order',
      'limit', 'range', 'insert', 'update', 'delete', 'upsert'
    ];
    for (const m of chain) {
      builder[m] = vi.fn(() => builder);
    }
    const resolve = () =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    builder.single = vi.fn(() => resolve());
    builder.maybeSingle = vi.fn(() => resolve());
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => resolve().then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) => resolve().catch(onRejected);
    return builder;
  });

  const CONVS = [
    {
      created_at: '2025-01-15T09:00:00',
      messages: [
        { role: 'user', content: 'Résume mes emails du jour' },
        { role: 'user', content: 'Envoie un email à Paul' }
      ]
    },
    {
      created_at: '2025-01-15T10:00:00',
      messages: [{ role: 'user', content: 'Crée une tâche pour demain' }]
    }
  ];

  return {
    mockFrom,
    tableResults,
    LOC: { pathname: '/' },
    AUTH: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false
    },
    mockNavigate: vi.fn(),
    mockDebugError: vi.fn(),
    CONVS
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom }
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => LOC,
  useNavigate: () => mockNavigate
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } }
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

async function setup(pathname: string, options?: { enabled?: boolean }) {
  LOC.pathname = pathname;
  const { result } = renderHook(() => useJarvisIntentPrediction(options), {
    wrapper: createWrapper()
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return result;
}

describe('useJarvisIntentPrediction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mercredi 15 janvier 2025, 14h00 (afternoon, jour neutre)
    vi.setSystemTime(new Date(2025, 0, 15, 14, 0, 0));
    sessionStorage.clear();
    for (const key of Object.keys(tableResults)) {
      delete tableResults[key];
    }
    tableResults['jarvis_conversations'] = { data: CONVS, error: null };
    tableResults['jarvis_pending_actions'] = { data: [], error: null };
    mockFrom.mockClear();
    mockDebugError.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('expose un état initial vide puis analyse les patterns au montage', async () => {
    const result = await setup('/');

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.predictions).toEqual([]);
    expect(result.current.topPrediction).toBeNull();
    expect(result.current.hasPredictions).toBe(false);

    expect(mockFrom).toHaveBeenCalledWith('jarvis_conversations');
    expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');

    expect(result.current.behaviorPattern).not.toBeNull();
    expect(result.current.behaviorPattern?.preferredQuickActions).toEqual(['emails', 'tasks']);
    expect(result.current.behaviorPattern?.averageSessionDuration).toBe(30);
    expect(result.current.behaviorPattern?.hourlyActivity[9]).toBe(1);
    expect(result.current.behaviorPattern?.hourlyActivity[10]).toBe(1);
  });

  it('génère une prédiction trésorerie après le délai de 5s sur /tresorerie', async () => {
    const result = await setup('/tresorerie');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.hasPredictions).toBe(true);
    expect(result.current.predictions).toHaveLength(1);
    expect(result.current.topPrediction?.id).toBe('treasury_analysis');
    expect(result.current.topPrediction?.intent).toBe('financial_analysis');
    expect(result.current.topPrediction?.confidence).toBe(0.75);
    expect(result.current.topPrediction?.suggestedPrompt).toBe('Analyse ma situation financière');
    expect(result.current.topPrediction?.suggestedAction?.type).toBe('open_jarvis');
    expect(result.current.topPrediction?.context.timeOfDay).toBe('afternoon');
    expect(result.current.topPrediction?.context.currentPage).toBe('/tresorerie');
    expect(result.current.highConfidencePredictions).toHaveLength(1);
  });

  it('génère une prédiction email_summary quand le compteur d emails non lus dépasse 5', async () => {
    tableResults['email_threads'] = { data: [], error: null, count: 12 };
    const result = await setup('/emails');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(result.current.topPrediction?.id).toBe('email_summary');
    expect(result.current.topPrediction?.intent).toBe('summarize_emails');
    expect(result.current.topPrediction?.confidence).toBe(0.78);
    expect(result.current.topPrediction?.reasoning).toContain('12 emails non lus');
    expect(result.current.topPrediction?.suggestedAction?.data.prompt).toContain('12 emails non lus');
  });

  it('ne génère pas de prédiction email_summary quand le compteur est faible', async () => {
    tableResults['email_threads'] = { data: [], error: null, count: 2 };
    const result = await setup('/emails');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.predictions).toEqual([]);
    expect(result.current.hasPredictions).toBe(false);
  });

  it('génère une prédiction CRM pour une page établissement', async () => {
    const result = await setup('/etablissements/etab-42');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.topPrediction?.id).toBe('crm_actions_etab-42');
    expect(result.current.topPrediction?.intent).toBe('crm_analysis');
    expect(result.current.topPrediction?.confidence).toBe(0.72);
    expect(result.current.topPrediction?.suggestedPrompt).toBe('Analyse la santé de ce client');
  });

  it('dismissPrediction retire la prédiction et la persiste dans sessionStorage', async () => {
    const result = await setup('/tresorerie');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.topPrediction?.id).toBe('treasury_analysis');

    await act(async () => {
      result.current.dismissPrediction('treasury_analysis');
    });

    expect(result.current.predictions).toEqual([]);
    expect(result.current.topPrediction).toBeNull();

    const raw = sessionStorage.getItem('jarvis_dismissed_predictions');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}') as { ids: string[]; timestamp: number };
    expect(parsed.ids).toContain('treasury_analysis');
  });

  it('filtre les prédictions déjà dismissées (persistées en sessionStorage)', async () => {
    sessionStorage.setItem(
      'jarvis_dismissed_predictions',
      JSON.stringify({ ids: ['treasury_analysis'], timestamp: Date.now() })
    );
    const result = await setup('/tresorerie');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.predictions).toEqual([]);
    expect(result.current.hasPredictions).toBe(false);
  });

  it('ne génère aucune prédiction quand enabled=false', async () => {
    const result = await setup('/tresorerie', { enabled: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(result.current.predictions).toEqual([]);
    expect(result.current.behaviorPattern).toBeNull();
  });

  it('logue une erreur via debug.error quand l analyse des patterns échoue', async () => {
    tableResults['jarvis_conversations'] = new Error('boom');
    const result = await setup('/');

    expect(mockDebugError).toHaveBeenCalledWith(
      '[IntentPrediction] Pattern analysis error:',
      expect.any(Error)
    );
    expect(result.current.behaviorPattern).toBeNull();
  });
});