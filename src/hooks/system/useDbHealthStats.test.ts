/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDbHealthStats } from './useDbHealthStats';

const {
  AUTH_STATE,
  DB_HEALTH_STATS,
  RPC_ERROR,
  mockRpc,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const DB_HEALTH_STATS = {
    tables: [
      {
        table_name: 'orders',
        estimated_rows: 1200,
        total_size: 1048576,
        total_size_pretty: '1 MB',
        data_size_pretty: '768 kB',
        index_size_pretty: '256 kB',
        seq_scan: 10,
        idx_scan: 90,
        idx_scan_pct: 90,
        n_live_tup: 1180,
        n_dead_tup: 20,
        dead_tup_pct: 1.67,
      },
      {
        table_name: 'events',
        estimated_rows: 8000,
        total_size: 8388608,
        total_size_pretty: '8 MB',
        data_size_pretty: '6 MB',
        index_size_pretty: '2 MB',
        seq_scan: 200,
        idx_scan: 50,
        idx_scan_pct: 20,
        n_live_tup: 7900,
        n_dead_tup: 100,
        dead_tup_pct: 1.25,
      },
    ],
    total_db_size: '9 MB',
    table_count: 2,
    high_seq_scan_tables: [
      {
        table_name: 'events',
        seq_scan: 200,
        idx_scan: 50,
        rows: 8000,
      },
    ],
  };

  const RPC_ERROR = { message: 'rpc failed' };

  return {
    AUTH_STATE,
    DB_HEALTH_STATS,
    RPC_ERROR,
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

function createBuilder() {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe('useDbHealthStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createBuilder());
  });

  it('expose un état de chargement puis les statistiques de santé de la base en succès', async () => {
    mockRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: DB_HEALTH_STATS, error: null }), 0);
        }),
    );

    const { result } = renderHook(() => useDbHealthStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('get_db_health_stats');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(DB_HEALTH_STATS);
    expect(result.current.data?.total_db_size).toBe('9 MB');
    expect(result.current.data?.table_count).toBe(2);
    expect(result.current.data?.tables).toHaveLength(2);
    expect(result.current.data?.tables[0]).toMatchObject({
      table_name: 'orders',
      estimated_rows: 1200,
      idx_scan_pct: 90,
      dead_tup_pct: 1.67,
    });
    expect(result.current.data?.tables[1]).toMatchObject({
      table_name: 'events',
      seq_scan: 200,
      idx_scan: 50,
      total_size_pretty: '8 MB',
    });
    expect(result.current.data?.high_seq_scan_tables).toEqual([
      {
        table_name: 'events',
        seq_scan: 200,
        idx_scan: 50,
        rows: 8000,
      },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('passe en erreur si la rpc renvoie une erreur', async () => {
    mockRpc.mockResolvedValue({ data: null, error: RPC_ERROR });

    const { result } = renderHook(() => useDbHealthStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('get_db_health_stats');
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(RPC_ERROR);
    expect(result.current.error?.message).toBe('rpc failed');
  });
});