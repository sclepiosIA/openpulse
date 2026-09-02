import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  authUser: { id: 'user-1' } as null | { id: string },
}));

const chainFor = (result: { data: unknown; error: unknown }): any => {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') return (resolve: any) => Promise.resolve(result).then(resolve);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

import { useReportData } from '../analytics/useReportData';
import { useActivityPins } from '../activity/useActivityPins';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
};

describe('useReportData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appelle get_report_data avec une copie JSON des filtres', async () => {
    const response = { columns: ['nom'], rows: [{ nom: 'Alpha' }], total: 1 };
    mocks.rpc.mockResolvedValueOnce({ data: response, error: null });
    const filters = { period: '30d', ignored: undefined, nested: { status: 'Production' } } as any;

    const { result } = renderHook(
      () => useReportData({ source: 'etablissements' as any, filters }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.rpc).toHaveBeenCalledWith('get_report_data', {
      source_key: 'etablissements',
      params: { period: '30d', nested: { status: 'Production' } },
    });
    expect(result.current.data).toEqual(response);
  });

  it('ne lance pas le RPC sans source', () => {
    const { result } = renderHook(() => useReportData({ enabled: true }), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe('useActivityPins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authUser = { id: 'user-1' };
  });

  it('charge les pins utilisateur et expose les clés épinglées', async () => {
    mocks.from.mockReturnValue(chainFor({
      error: null,
      data: [
        { id: 'pin-1', user_id: 'user-1', activity_key: 'email:1', pinned_at: '2026-06-07T10:00:00Z' },
        { id: 'pin-2', user_id: 'user-1', activity_key: 'task:2', pinned_at: '2026-06-07T11:00:00Z' },
      ],
    }));

    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pins).toHaveLength(2);
    expect(result.current.pinnedKeys.has('email:1')).toBe(true);
    expect(result.current.pinnedKeys.has('task:2')).toBe(true);
  });

  it('déclenche le toggle d’un pin sans exposer la mutation au composant', async () => {
    mocks.from.mockReturnValue(chainFor({ error: null, data: [] }));

    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.togglePin('email:3', false));

    await waitFor(() => expect(mocks.from).toHaveBeenCalledWith('activity_feed_pins'));
    expect(result.current.pinnedKeys.has('email:3')).toBe(false);
  });
});