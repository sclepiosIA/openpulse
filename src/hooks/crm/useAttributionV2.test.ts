/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAttributionV2 } from './useAttributionV2';

const {
  ATTRIBUTION_DATA,
  RPC_SUCCESS_RESULT,
  RPC_ERROR_RESULT,
  mockRpc,
} = vi.hoisted(() => {
  const ATTRIBUTION_DATA = {
    model: 'time-decay' as const,
    range: { start: '2024-01-01', end: '2024-01-31' },
    computed_at: '2024-02-01T10:00:00Z',
    channels: [
      {
        channel: 'Google Ads',
        touchpoints: 10,
        etablissements: 4,
        signed: 2,
        conversion_rate: 0.2,
        attributed_value: 1200,
        attributed_touches: 6,
        value_per_touch: 200,
      },
      {
        channel: 'Email',
        touchpoints: 5,
        etablissements: 3,
        signed: 1,
        conversion_rate: 0.2,
        attributed_value: 300,
        attributed_touches: 2,
        value_per_touch: 150,
      },
    ],
    totals: {
      touchpoints: 15,
      etablissements: 7,
      signed: 3,
      attributed_value: 1500,
    },
  };

  return {
    ATTRIBUTION_DATA,
    RPC_SUCCESS_RESULT: { data: ATTRIBUTION_DATA, error: null },
    RPC_ERROR_RESULT: { data: null, error: { message: 'x' } },
    mockRpc: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
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

describe('useAttributionV2', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('charge puis retourne les données métier attendues avec les bons paramètres rpc', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS_RESULT);

    const { result } = renderHook(
      () => useAttributionV2('time-decay', '2024-01-01', '2024-01-31'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('compute_attribution_v2', {
      p_model: 'time-decay',
      p_start: '2024-01-01',
      p_end: '2024-01-31',
    });

    expect(result.current.data).toEqual(ATTRIBUTION_DATA);
    expect(result.current.data?.model).toBe('time-decay');
    expect(result.current.data?.range).toEqual({ start: '2024-01-01', end: '2024-01-31' });
    expect(result.current.data?.channels).toHaveLength(2);
    expect(result.current.data?.channels[0]).toEqual({
      channel: 'Google Ads',
      touchpoints: 10,
      etablissements: 4,
      signed: 2,
      conversion_rate: 0.2,
      attributed_value: 1200,
      attributed_touches: 6,
      value_per_touch: 200,
    });
    expect(result.current.data?.channels[1].channel).toBe('Email');
    expect(result.current.data?.totals.touchpoints).toBe(15);
    expect(result.current.data?.totals.etablissements).toBe(7);
    expect(result.current.data?.totals.signed).toBe(3);
    expect(result.current.data?.totals.attributed_value).toBe(1500);
  });

  it('utilise les valeurs par défaut quand start et end sont absents', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS_RESULT);

    const { result } = renderHook(() => useAttributionV2(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('compute_attribution_v2', {
      p_model: 'time-decay',
      p_start: undefined,
      p_end: undefined,
    });
    expect(result.current.data?.model).toBe('time-decay');
    expect(result.current.data?.totals.attributed_value).toBe(1500);
  });

  it('passe en erreur si le rpc retourne une erreur', async () => {
    mockRpc.mockResolvedValue(RPC_ERROR_RESULT);

    const { result } = renderHook(
      () => useAttributionV2('linear', '2024-03-01', '2024-03-31'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('compute_attribution_v2', {
      p_model: 'linear',
      p_start: '2024-03-01',
      p_end: '2024-03-31',
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual({ message: 'x' });
  });
});