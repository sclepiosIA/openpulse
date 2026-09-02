import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useJarvisPredictions, type Prediction } from './useJarvisPredictions';

const { PREDICTIONS_RESPONSE, mockInvoke, mockFrom, AUTH } = vi.hoisted(() => {
  const PREDICTIONS_RESPONSE = {
    success: true,
    predictions: [
      {
        action_type: 'daily_briefing',
        description: 'Briefing du matin',
        confidence: 0.92,
        reason: 'morning-routine',
      },
      {
        action_type: 'check_emails',
        description: 'Vérifier les emails',
        confidence: 0.8,
        reason: 'unread-emails',
      },
      {
        action_type: 'check_pipeline',
        description: 'Vérifier le pipeline',
        confidence: 0.55,
        reason: 'weekly-pipeline',
      },
    ],
    behavior_stats: {
      total_actions: 42,
      peak_hours: [9, 14],
      peak_days: [1, 3],
      most_common_actions: [{ action: 'check_emails', count: 12 }],
    },
    generated_at: '2025-01-08T09:00:00Z',
  };

  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'eq', 'gte', 'lte', 'in', 'order', 'limit',
    'insert', 'update', 'delete', 'upsert', 'neq', 'is', 'range',
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  builder.catch = () => Promise.resolve({ data: [], error: null });

  return {
    PREDICTIONS_RESPONSE,
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(() => builder),
    AUTH: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' }, access_token: 'tok' },
      isLoading: false,
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH,
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useJarvisPredictions', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: PREDICTIONS_RESPONSE, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('charge puis retourne les prédictions avec les stats comportementales', async () => {
    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.predictions).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.predictions).toHaveLength(3);
    expect(result.current.topPrediction?.action_type).toBe('daily_briefing');
    expect(result.current.topPrediction?.confidence).toBe(0.92);
    expect(result.current.behaviorStats?.total_actions).toBe(42);
    expect(result.current.behaviorStats?.peak_hours).toEqual([9, 14]);
    expect(result.current.generatedAt).toBe('2025-01-08T09:00:00Z');
    expect(mockInvoke).toHaveBeenCalledWith('jarvis-predictive-engine', {
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('dismissPrediction retire la prédiction de la liste active', async () => {
    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.predictions).toHaveLength(3);
    });

    const top = result.current.topPrediction as Prediction;
    expect(top.action_type).toBe('daily_briefing');

    await act(async () => {
      await result.current.dismissPrediction(top);
    });

    expect(result.current.dismissedCount).toBe(1);
    expect(result.current.predictions).toHaveLength(2);
    expect(result.current.topPrediction?.action_type).toBe('check_emails');
  });

  it('acceptPrediction incrémente le compteur acceptedCount', async () => {
    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.predictions).toHaveLength(3);
    });

    expect(result.current.acceptedCount).toBe(0);

    await act(async () => {
      await result.current.acceptPrediction(result.current.predictions[0]);
    });

    expect(result.current.acceptedCount).toBe(1);
  });

  it('getContextualSuggestions filtre les prédictions selon le chemin courant', async () => {
    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.predictions).toHaveLength(3);
    });

    const emailSuggestions = result.current.getContextualSuggestions('/emails');
    expect(emailSuggestions.map((p) => p.action_type)).toEqual([
      'daily_briefing',
      'check_emails',
    ]);

    const pipelineSuggestions = result.current.getContextualSuggestions('/etablissements');
    expect(pipelineSuggestions.map((p) => p.action_type)).toEqual([
      'check_pipeline',
      'daily_briefing',
    ]);
  });

  it('getPredictionCommand retourne la commande mappée ou la description en fallback', async () => {
    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(
      result.current.getPredictionCommand({
        action_type: 'daily_briefing',
        description: 'desc',
        confidence: 0.9,
        reason: 'r',
      })
    ).toBe('Donne-moi un briefing de ma journée');

    expect(
      result.current.getPredictionCommand({
        action_type: 'unknown_action',
        description: 'Description de repli',
        confidence: 0.5,
        reason: 'r',
      })
    ).toBe('Description de repli');
  });

  it('getConfidenceLabel retourne le bon libellé selon le score', async () => {
    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getConfidenceLabel(0.95)).toBe('Très pertinent');
    expect(result.current.getConfidenceLabel(0.9)).toBe('Très pertinent');
    expect(result.current.getConfidenceLabel(0.8)).toBe('Pertinent');
    expect(result.current.getConfidenceLabel(0.6)).toBe('Suggéré');
    expect(result.current.getConfidenceLabel(0.3)).toBe('Peut-être utile');
  });

  it('shouldShowPredictions retourne true en heures ouvrées et false le week-end', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-08T10:00:00'));

    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.predictions).toHaveLength(3);
    });

    expect(result.current.shouldShowPredictions()).toBe(true);

    vi.setSystemTime(new Date('2025-01-05T10:00:00'));
    expect(result.current.shouldShowPredictions()).toBe(false);
  });

  it("passe en erreur quand l'edge function échoue", async () => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useJarvisPredictions(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
      },
      { timeout: 10000 }
    );

    expect(result.current.predictions).toEqual([]);
    expect(result.current.topPrediction).toBeNull();
    expect(result.current.behaviorStats).toBeUndefined();
  }, 15000);
});