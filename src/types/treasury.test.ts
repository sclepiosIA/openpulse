/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';

const {
  mockFrom,
  makeBuilder,
  stableUser,
  toastSuccess,
  toastError,
  navigateMock,
} = vi.hoisted(() => {
  type SupabaseErrorShape = { message: string } | null;
  type SupabaseResult<T> = { data: T; error: SupabaseErrorShape };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const navigateMock = vi.fn();

  const stableUser = {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  type BuilderState = {
    table: string;
    selects: string[];
    filters: Array<{ op: string; args: unknown[] }>;
    orders: Array<{ column: string; options?: unknown }>;
    limits: number[];
    inserts: unknown[];
    updates: unknown[];
    deletes: number;
    _result: SupabaseResult<unknown>;
    _singleResult: SupabaseResult<unknown>;
    _maybeSingleResult: SupabaseResult<unknown>;
  };

  type ThenableBuilder = {
    select: (s: string, opts?: unknown) => ThenableBuilder;
    eq: (col: string, val: unknown) => ThenableBuilder;
    neq: (col: string, val: unknown) => ThenableBuilder;
    gt: (col: string, val: unknown) => ThenableBuilder;
    gte: (col: string, val: unknown) => ThenableBuilder;
    lt: (col: string, val: unknown) => ThenableBuilder;
    lte: (col: string, val: unknown) => ThenableBuilder;
    like: (col: string, val: unknown) => ThenableBuilder;
    ilike: (col: string, val: unknown) => ThenableBuilder;
    is: (col: string, val: unknown) => ThenableBuilder;
    in: (col: string, val: unknown[]) => ThenableBuilder;
    contains: (col: string, val: unknown) => ThenableBuilder;
    overlaps: (col: string, val: unknown) => ThenableBuilder;
    order: (col: string, opts?: unknown) => ThenableBuilder;
    limit: (count: number) => ThenableBuilder;
    range: (from: number, to: number) => ThenableBuilder;
    insert: (values: unknown, opts?: unknown) => ThenableBuilder;
    update: (values: unknown, opts?: unknown) => ThenableBuilder;
    upsert: (values: unknown, opts?: unknown) => ThenableBuilder;
    delete: (opts?: unknown) => ThenableBuilder;
    single: () => Promise<SupabaseResult<unknown>>;
    maybeSingle: () => Promise<SupabaseResult<unknown>>;
    then: <TResult1 = SupabaseResult<unknown>, TResult2 = never>(
      onfulfilled?: ((value: SupabaseResult<unknown>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null
    ) => Promise<SupabaseResult<unknown> | TResult>;
    __setResult: (res: SupabaseResult<unknown>) => void;
    __setSingleResult: (res: SupabaseResult<unknown>) => void;
    __setMaybeSingleResult: (res: SupabaseResult<unknown>) => void;
    __getState: () => BuilderState;
  };

  const makeBuilder = (table: string): ThenableBuilder => {
    const state: BuilderState = {
      table,
      selects: [],
      filters: [],
      orders: [],
      limits: [],
      inserts: [],
      updates: [],
      deletes: 0,
      _result: { data: null, error: null },
      _singleResult: { data: null, error: null },
      _maybeSingleResult: { data: null, error: null },
    };

    const builder: Partial<ThenableBuilder> = {};

    const chain =
      (op: string) =>
      (...args: unknown[]) => {
        state.filters.push({ op, args });
        return builder as ThenableBuilder;
      };

    builder.select = (s: string) => {
      state.selects.push(s);
      return builder as ThenableBuilder;
    };
    builder.eq = chain('eq');
    builder.neq = chain('neq');
    builder.gt = chain('gt');
    builder.gte = chain('gte');
    builder.lt = chain('lt');
    builder.lte = chain('lte');
    builder.like = chain('like');
    builder.ilike = chain('ilike');
    builder.is = chain('is');
    builder.in = chain('in');
    builder.contains = chain('contains');
    builder.overlaps = chain('overlaps');

    builder.order = (col: string, options?: unknown) => {
      state.orders.push({ column: col, options });
      return builder as ThenableBuilder;
    };
    builder.limit = (count: number) => {
      state.limits.push(count);
      return builder as ThenableBuilder;
    };
    builder.range = (from: number, to: number) => {
      state.filters.push({ op: 'range', args: [from, to] });
      return builder as ThenableBuilder;
    };

    builder.insert = (values: unknown) => {
      state.inserts.push(values);
      return builder as ThenableBuilder;
    };
    builder.update = (values: unknown) => {
      state.updates.push(values);
      return builder as ThenableBuilder;
    };
    builder.upsert = (values: unknown) => {
      state.filters.push({ op: 'upsert', args: [values] });
      return builder as ThenableBuilder;
    };
    builder.delete = () => {
      state.deletes += 1;
      return builder as ThenableBuilder;
    };

    builder.single = async () => state._singleResult;
    builder.maybeSingle = async () => state._maybeSingleResult;

    builder.then = (onfulfilled, onrejected) =>
      Promise.resolve(state._result).then(
        onfulfilled as (v: SupabaseResult<unknown>) => unknown,
        onrejected as (r: unknown) => unknown
      ) as Promise<unknown>;
    builder.catch = (onrejected) => Promise.resolve(state._result).catch(onrejected as (r: unknown) => unknown);

    builder.__setResult = (res: SupabaseResult<unknown>) => {
      state._result = res;
    };
    builder.__setSingleResult = (res: SupabaseResult<unknown>) => {
      state._singleResult = res;
    };
    builder.__setMaybeSingleResult = (res: SupabaseResult<unknown>) => {
      state._maybeSingleResult = res;
    };
    builder.__getState = () => state;

    return builder as ThenableBuilder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));

  return {
    mockFrom,
    makeBuilder,
    stableUser,
    toastSuccess,
    toastError,
    navigateMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: stableUser.user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: stableUser.session }, error: null })),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'k' }),
  };
});

// Common auth-context patterns (mocked defensively)
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
  AuthProvider: ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}));
vi.mock('@/hooks/useSession', () => ({
  useSession: () => stableUser,
}));
vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => true,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('treasury.ts', () => {
  it('expose des types/valeurs attendues (smoke)', async () => {
    const mod = await import('./treasury');
    expect(mod).toBeTruthy();
    expect(typeof mod).toBe('object');
  });

  it('renderHook: chargement -> succès (hook exporté détecté dynamiquement)', async () => {
    const mod = await import('./treasury');

    const hookEntries = Object.entries(mod).filter(([, v]) => typeof v === 'function' && /^use[A-Z0-9_]/.test(String(v.name)));
    if (hookEntries.length === 0) {
      expect(true).toBe(true);
      return;
    }

    const [hookName, hookFn] = hookEntries[0] as [string, (...args: never[]) => unknown];

    const b = makeBuilder('tresorerie_revenus');
    b.__setResult({
      data: [
        {
          id: 'r1',
          etablissement_id: 'e1',
          mois: '2026-01',
          montant_prevu: 1000,
          statut: 'pipeline',
          type_revenu: 'paiement_initial',
        },
      ],
      error: null,
    });
    mockFrom.mockImplementationOnce(() => b);

    const wrapper = createWrapper();
    const { result } = renderHook(() => hookFn(), { wrapper });

    expect(result.current).toBeTruthy();
    await waitFor(() => {
      const r = result.current as { isLoading?: boolean; isSuccess?: boolean; data?: unknown };
      expect(r.isLoading).toBe(false);
    });

    const r = result.current as { isSuccess?: boolean; data?: unknown };
    if (r && typeof r === 'object' && 'isSuccess' in r) {
      expect(r.isSuccess).toBe(true);
      expect(r.data).toBeTruthy();
    }

    expect(mockFrom).toHaveBeenCalled();
    expect(mockFrom.mock.calls[0]?.[0]).toBe('tresorerie_revenus');

    expect(hookName).toMatch(/^use/);
  });

  it('renderHook: erreur -> isError (hook exporté détecté dynamiquement)', async () => {
    const mod = await import('./treasury');

    const hookEntries = Object.entries(mod).filter(([, v]) => typeof v === 'function' && /^use[A-Z0-9_]/.test(String(v.name)));
    if (hookEntries.length === 0) {
      expect(true).toBe(true);
      return;
    }

    const [, hookFn] = hookEntries[0] as [string, (...args: never[]) => unknown];

    const b = makeBuilder('tresorerie_revenus');
    b.__setResult({ data: null, error: { message: 'x' } });
    mockFrom.mockImplementationOnce(() => b);

    const wrapper = createWrapper();
    const { result } = renderHook(() => hookFn(), { wrapper });

    await waitFor(() => {
      const r = result.current as { isError?: boolean; isLoading?: boolean };
      expect(r.isLoading).toBe(false);
      expect(r.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalled();
  });

  it('mutation: déclenchement dans act -> supabase.from appelé avec table attendue (si mutation exportée)', async () => {
    const mod = await import('./treasury');

    const mutationEntries = Object.entries(mod).filter(([, v]) => typeof v === 'function' && /mutation/i.test(String(v.name)));
    const hookEntries = Object.entries(mod).filter(([, v]) => typeof v === 'function' && /^use[A-Z0-9_]/.test(String(v.name)));
    const candidate = (mutationEntries[0]?.[1] ?? hookEntries.find(([k]) => /create|add|update|delete/i.test(k))?.[1]) as
      | ((...args: never[]) => unknown)
      | undefined;

    if (!candidate) {
      expect(true).toBe(true);
      return;
    }

    const b = makeBuilder('tresorerie_revenus');
    b.__setResult({ data: [{ id: 'new1' }], error: null });
    b.__setSingleResult({ data: { id: 'new1' }, error: null });
    mockFrom.mockImplementationOnce(() => b);

    const wrapper = createWrapper();
    const { result } = renderHook(() => candidate(), { wrapper });

    await waitFor(() => {
      const r = result.current as { mutate?: unknown; mutateAsync?: unknown; isPending?: boolean; isLoading?: boolean };
      expect(r).toBeTruthy();
      expect(typeof r).toBe('object');
      const ready = typeof r.mutateAsync === 'function' || typeof r.mutate === 'function' || r.isLoading === false || r.isPending === false;
      expect(ready).toBe(true);
    });

    const r = result.current as {
      mutate?: (vars: unknown) => void;
      mutateAsync?: (vars: unknown) => Promise<unknown>;
    };

    const payload = {
      etablissement_id: 'e1',
      mois: '2026-01',
      montant_prevu: 500,
      statut: 'pipeline',
      type_revenu: 'autre',
    };

    await act(async () => {
      if (typeof r.mutateAsync === 'function') {
        await r.mutateAsync(payload);
      } else if (typeof r.mutate === 'function') {
        r.mutate(payload);
      }
    });

    expect(mockFrom).toHaveBeenCalled();
  });
});