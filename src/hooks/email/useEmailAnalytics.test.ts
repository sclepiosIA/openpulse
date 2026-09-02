/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmailAnalytics } from './useEmailAnalytics';

const {
  ANALYTICS_SUCCESS,
  ANALYTICS_ERROR,
  mockRpc,
} = vi.hoisted(() => ({
  ANALYTICS_SUCCESS: {
    volume: [
      { date: '2024-01-01', count: 12 },
      { date: '2024-01-02', count: 8 },
    ],
    commercial: {
      totalEtablissements: 42,
      suggestions: {
        accepted: 8,
        rejected: 1,
        pending: 1,
        total: 10,
        avg_confidence: 0.873,
      },
    },
    aiQuality: {
      avgProcessingTime: 2.4,
      totalTokens: 1500,
      estimatedCost: 12.34,
      successRate: 98.7,
      recentLogs: [
        { id: 'log-1', status: 'ok' },
        { id: 'log-2', status: 'ok' },
      ],
    },
    threads: [
      { id: 'thread-1', subject: 'Hello' },
      { id: 'thread-2', subject: 'World' },
    ],
  },
  ANALYTICS_ERROR: { message: 'x' },
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
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

describe('useEmailAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose isLoading puis mappe correctement les données métier au succès', async () => {
    mockRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: ANALYTICS_SUCCESS, error: null }), 0);
        })
    );

    const { result } = renderHook(() => useEmailAnalytics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.volumeData).toEqual([]);
    expect(result.current.commercialData).toBeUndefined();
    expect(result.current.aiQualityData).toBeUndefined();
    expect(result.current.threadsData).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_email_analytics', { p_days: 30 });

    expect(result.current.isError).toBe(false);
    expect(result.current.volumeData).toEqual(ANALYTICS_SUCCESS.volume);
    expect(result.current.threadsData).toEqual(ANALYTICS_SUCCESS.threads);

    expect(result.current.commercialData).toEqual({
      totalEtablissements: 42,
      conversionRate: '80.0',
      suggestions: {
        accepted: 8,
        rejected: 1,
        pending: 1,
        total: 10,
      },
      avgConfidence: '87.3',
    });

    expect(result.current.aiQualityData).toEqual({
      avgProcessingTime: '2.4',
      totalTokens: 1500,
      estimatedCost: '12.34',
      successRate: '98.7',
      recentLogs: ANALYTICS_SUCCESS.aiQuality.recentLogs,
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('retourne isError à true quand la rpc renvoie une erreur', async () => {
    mockRpc.mockResolvedValue({ data: null, error: ANALYTICS_ERROR });

    const { result } = renderHook(() => useEmailAnalytics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_email_analytics', { p_days: 30 });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.volumeData).toEqual([]);
    expect(result.current.commercialData).toBeUndefined();
    expect(result.current.aiQualityData).toBeUndefined();
    expect(result.current.threadsData).toEqual([]);
  });

  it('applique les valeurs par défaut quand certaines sous-propriétés sont absentes', async () => {
    const partialAnalytics = {
      volume: [],
      commercial: {
        totalEtablissements: 3,
        suggestions: {
          accepted: 0,
          rejected: 0,
          pending: 0,
          total: 0,
        },
      },
      aiQuality: {
        avgProcessingTime: 0,
        totalTokens: 0,
        estimatedCost: 0,
        successRate: 0,
        recentLogs: [],
      },
      threads: [],
    };

    mockRpc.mockResolvedValue({ data: partialAnalytics, error: null });

    const { result } = renderHook(() => useEmailAnalytics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.commercialData).toEqual({
      totalEtablissements: 3,
      conversionRate: '0',
      suggestions: {
        accepted: 0,
        rejected: 0,
        pending: 0,
        total: 0,
      },
      avgConfidence: '0',
    });

    expect(result.current.aiQualityData).toEqual({
      avgProcessingTime: '0',
      totalTokens: 0,
      estimatedCost: '0.00',
      successRate: '100',
      recentLogs: [],
    });
  });
});