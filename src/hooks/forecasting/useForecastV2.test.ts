// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useForecastV2, type ForecastV2 } from './useForecastV2';

const {
  FORECAST_DATA,
  RPC_SUCCESS,
  RPC_ERROR,
  mockRpc,
  mockFrom,
} = vi.hoisted(() => {
  const FORECAST_DATA: ForecastV2 = {
    range: { start: '2024-01-01', end: '2024-03-31' },
    kpis: {
      pipeline_raw: 150000,
      pipeline_weighted_v1: 90000,
      pipeline_weighted_v2: 102500,
      current_quarter_v2: 64000,
      won_total: 25000,
    },
    top_deals: [
      {
        id: 'deal-1',
        nom: 'Acme Expansion',
        statut: 'proposal',
        probability_v1: 60,
        probability_v2: 75,
        delta: 15,
        deal_value: 50000,
        weighted_v1: 30000,
        weighted_v2: 37500,
        closing_date: '2024-02-15',
        factors: [
          { label: 'Engagement', points: 10 },
          { label: 'Budget confirmed', points: 5 },
        ],
      },
      {
        id: 'deal-2',
        nom: 'Beta Renewal',
        statut: 'negotiation',
        probability_v1: 40,
        probability_v2: 52,
        delta: 12,
        deal_value: 100000,
        weighted_v1: 40000,
        weighted_v2: 52000,
        closing_date: '2024-03-20',
        factors: [{ label: 'Champion identified', points: 12 }],
      },
    ],
    model_version: 'v2',
    computed_at: '2024-01-10T12:00:00Z',
  };

  const RPC_SUCCESS = { data: FORECAST_DATA, error: null };
  const RPC_ERROR = { data: null, error: { message: 'x' } };

  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  return {
    FORECAST_DATA,
    RPC_SUCCESS,
    RPC_ERROR,
    mockRpc,
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useForecastV2', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockClear();
  });

  it('charge puis retourne les données métier de forecast avec les paramètres fournis', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS);

    const { result } = renderHook(() => useForecastV2('2024-01-01', '2024-03-31'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_sales_forecast_v2', {
      p_start: '2024-01-01',
      p_end: '2024-03-31',
    });

    expect(result.current.data).toEqual(FORECAST_DATA);
    expect(result.current.data?.range).toEqual({ start: '2024-01-01', end: '2024-03-31' });
    expect(result.current.data?.kpis.pipeline_raw).toBe(150000);
    expect(result.current.data?.kpis.pipeline_weighted_v1).toBe(90000);
    expect(result.current.data?.kpis.pipeline_weighted_v2).toBe(102500);
    expect(result.current.data?.kpis.current_quarter_v2).toBe(64000);
    expect(result.current.data?.kpis.won_total).toBe(25000);
    expect(result.current.data?.top_deals).toHaveLength(2);
    expect(result.current.data?.top_deals[0]).toMatchObject({
      id: 'deal-1',
      nom: 'Acme Expansion',
      statut: 'proposal',
      probability_v1: 60,
      probability_v2: 75,
      delta: 15,
      deal_value: 50000,
      weighted_v1: 30000,
      weighted_v2: 37500,
      closing_date: '2024-02-15',
    });
    expect(result.current.data?.top_deals[0].factors).toEqual([
      { label: 'Engagement', points: 10 },
      { label: 'Budget confirmed', points: 5 },
    ]);
    expect(result.current.data?.top_deals[1]).toMatchObject({
      id: 'deal-2',
      nom: 'Beta Renewal',
      weighted_v2: 52000,
      delta: 12,
    });
    expect(result.current.data?.model_version).toBe('v2');
    expect(result.current.data?.computed_at).toBe('2024-01-10T12:00:00Z');
  });

  it('appelle la rpc avec undefined quand start et end sont absents', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS);

    const { result } = renderHook(() => useForecastV2(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('get_sales_forecast_v2', {
      p_start: undefined,
      p_end: undefined,
    });
  });

  it('passe en erreur si la rpc renvoie une erreur', async () => {
    mockRpc.mockResolvedValue(RPC_ERROR);

    const { result } = renderHook(() => useForecastV2('2024-04-01', '2024-06-30'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('get_sales_forecast_v2', {
      p_start: '2024-04-01',
      p_end: '2024-06-30',
    });
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
  });
});