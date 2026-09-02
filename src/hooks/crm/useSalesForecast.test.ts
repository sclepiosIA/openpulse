import React from 'react';
import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { SALES_DATA, mockFrom, mockRpc } = vi.hoisted(() => {
  type RpcResponse<T> = { data: T | null; error: { message: string } | null };

  const SALES_DATA = {
    range: { start: '2024-01-01', end: '2024-12-31' },
    kpis: {
      pipeline_raw: 10,
      pipeline_weighted: 20,
      current_quarter: 2,
      next_quarter: 3,
      won_total: 5,
      target_total: 6,
      current_quarter_target: 7,
    },
    by_quarter: [] as Array<unknown>,
    by_commercial: [] as Array<unknown>,
    by_phase: [] as Array<unknown>,
    top_deals: [] as Array<unknown>,
  };

  interface Builder {
    select: (..._args: unknown[]) => Builder;
    eq: (..._args: unknown[]) => Builder;
    gte: (..._args: unknown[]) => Builder;
    lte: (..._args: unknown[]) => Builder;
    in: (..._args: unknown[]) => Builder;
    order: (..._args: unknown[]) => Builder;
    limit: (..._args: unknown[]) => Builder;
    insert: (..._args: unknown[]) => Builder;
    update: (..._args: unknown[]) => Builder;
    delete: (..._args: unknown[]) => Builder;
    single: () => Promise<RpcResponse<unknown>>;
    maybeSingle: () => Promise<RpcResponse<unknown>>;
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: RpcResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null
    ) => Promise<RpcResponse<unknown> | TResult>;
  }

  const createBuilder = (): Builder => {
    const response: RpcResponse<unknown> = { data: [], error: null };
    const promise = Promise.resolve(response);
    const builder: Builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve({ data: {}, error: null }),
      maybeSingle: () => Promise.resolve({ data: {}, error: null }),
      then: (onfulfilled, onrejected) => promise.then(onfulfilled as (value: RpcResponse<unknown>) => unknown, onrejected),
      catch: (onrejected) => promise.catch(onrejected as (reason: unknown) => unknown),
    };
    return builder;
  };

  const mockFrom = vi.fn((_table: string) => createBuilder());
  const mockRpc = vi.fn((_fnName: string, _args: Record<string, unknown>) =>
    Promise.resolve({ data: SALES_DATA, error: null })
  );

  return { SALES_DATA, mockFrom, mockRpc };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { useSalesForecast } from './useSalesForecast';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(
    QueryClientProvider,
    {
      client: new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      }),
    },
    children
  );

describe('useSalesForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: SALES_DATA, error: null });
  });

  it('loads data successfully and returns business values', async () => {
    const currentYear = new Date().getFullYear();
    const expectedArgs = { p_start: `${currentYear}-01-01`, p_end: `${currentYear}-12-31` };

    const { result } = renderHook(() => useSalesForecast('year'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const callArgs = (mockRpc.mock.calls[0] ?? [])[1] as Record<string, string>;
    expect(mockRpc).toHaveBeenCalledWith('get_sales_forecast', expect.any(Object));
    expect(callArgs.p_start).toBe(expectedArgs.p_start);
    expect(callArgs.p_end).toBe(expectedArgs.p_end);

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.kpis.pipeline_raw).toBe(10);
    expect(result.current.data?.kpis.pipeline_weighted).toBe(20);
    expect(result.current.data?.kpis.won_total).toBe(5);
    expect(result.current.data?.top_deals.length).toBe(0);
  });

  it('handles rpc error and exposes isError with message', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(() => useSalesForecast('year'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect((result.current.error as Error).message).toBe('boom');
  });
})