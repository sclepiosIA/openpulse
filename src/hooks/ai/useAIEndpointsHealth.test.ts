import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAIEndpointsHealth } from './useAIEndpointsHealth';

const { HEALTH_RESULT, mockInvoke, mockFrom } = vi.hoisted(() => {
  const HEALTH_RESULT = {
    success: true,
    checked_at: '2024-01-15T10:00:00Z',
    endpoints: [
      {
        model: 'gpt-4o',
        status: 'ok',
        latency_ms: 120,
        endpoint_configured: true,
      },
      {
        model: 'claude-3',
        status: 'unconfigured',
        latency_ms: null,
        endpoint_configured: false,
      },
    ],
  };
  return {
    HEALTH_RESULT,
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
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
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useAIEndpointsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne déclenche pas la requête quand enabled=false (par défaut)', async () => {
    const { result } = renderHook(() => useAIEndpointsHealth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('passe par isLoading puis retourne les données de santé en succès', async () => {
    mockInvoke.mockResolvedValue({ data: HEALTH_RESULT, error: null });

    const { result } = renderHook(() => useAIEndpointsHealth(true), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInvoke).toHaveBeenCalledWith('ai-health-check');
    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.checked_at).toBe('2024-01-15T10:00:00Z');
    expect(result.current.data?.endpoints).toHaveLength(2);
    expect(result.current.data?.endpoints[0]).toEqual({
      model: 'gpt-4o',
      status: 'ok',
      latency_ms: 120,
      endpoint_configured: true,
    });
    expect(result.current.data?.endpoints[1].status).toBe('unconfigured');
    expect(result.current.data?.endpoints[1].latency_ms).toBeNull();
  });

  it('expose isError quand la edge function retourne une erreur (après le retry interne retry:1)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'x' },
    });

    const { result } = renderHook(() => useAIEndpointsHealth(true), {
      wrapper: createWrapper(),
    });

    // Le hook définit retry: 1, donc react-query refait un essai
    // avec un délai exponentiel (~1s) avant de passer en erreur.
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 8000 }
    );

    // 1 appel initial + 1 retry défini dans le hook (retry: 1)
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual({ message: 'x' });
  }, 12000);

  it('utilise la queryKey ai-endpoints-health (une seule invocation en succès)', async () => {
    mockInvoke.mockResolvedValue({ data: HEALTH_RESULT, error: null });

    const { result, rerender } = renderHook(() => useAIEndpointsHealth(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    rerender();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.current.data?.endpoints.map((e) => e.model)).toEqual([
      'gpt-4o',
      'claude-3',
    ]);
  });
});