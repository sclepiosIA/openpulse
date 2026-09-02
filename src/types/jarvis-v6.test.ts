/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

const { AUTH_STATE } = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
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
vi.mock('@/hooks/useSession', () => ({
  useSession: () => AUTH_STATE,
}));
vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => true,
}));

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast }));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

type SupabaseError = { message: string } | null;
type SupabaseResponse<T> = { data: T; error: SupabaseError };

type BuilderResult =
  | SupabaseResponse<unknown>
  | Promise<SupabaseResponse<unknown>>
  | (() => SupabaseResponse<unknown> | Promise<SupabaseResponse<unknown>>);

const { mockFrom, setSupabaseResult, resetSupabaseMocks } = vi.hoisted(() => {
  let nextResult: BuilderResult = { data: null, error: null };

  const makeThenableBuilder = () => {
    const builder: Record<string, unknown> = {};

    const chainMethods = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'contains',
      'overlaps',
      'ilike',
      'like',
      'is',
      'or',
      'order',
      'limit',
      'range',
      'filter',
      'match',
      'textSearch',
      'insert',
      'upsert',
      'update',
      'delete',
      'rpc',
      'throwOnError',
    ] as const;

    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder);
    }

    const resolveResult = async (): Promise<SupabaseResponse<unknown>> => {
      const r = nextResult;
      const value = typeof r === 'function' ? r() : r;
      return value instanceof Promise ? await value : value;
    };

    builder.single = vi.fn(async () => resolveResult());
    builder.maybeSingle = vi.fn(async () => resolveResult());

    builder.then = (
      onFulfilled: (v: SupabaseResponse<unknown>) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => resolveResult().then(onFulfilled, onRejected);
    builder.catch = (onRejected: (e: unknown) => unknown) => resolveResult().catch(onRejected);

    return builder;
  };

  const mockFromInner = vi.fn(() => makeThenableBuilder());

  return {
    mockFrom: mockFromInner,
    setSupabaseResult: (result: BuilderResult) => {
      nextResult = result;
    },
    resetSupabaseMocks: () => {
      mockFromInner.mockClear();
      nextResult = { data: null, error: null };
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
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

  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

describe('jarvis-v6.ts', () => {
  it('exporte le mapping de voix attendu', async () => {
    const mod = await import('./jarvis-v6');

    expect(mod.AGENT_VOICE_MAP.prime).toBe('coral');
    expect(mod.AGENT_VOICE_MAP.sophia).toBe('shimmer');
    expect(mod.AGENT_VOICE_MAP.marcus).toBe('echo');
    expect(mod.AGENT_VOICE_MAP.olivia).toBe('alloy');
    expect(mod.AGENT_VOICE_MAP.noah).toBe('nova');
    expect(mod.AGENT_VOICE_MAP.emma).toBe('fable');
    expect(mod.AGENT_VOICE_MAP.alex).toBe('onyx');

    expect(Object.keys(mod.AGENT_VOICE_MAP).sort()).toEqual(
      ['alex', 'emma', 'marcus', 'noah', 'olivia', 'prime', 'sophia'].sort(),
    );
  });

  it('définit les niveaux d’autonomie et les types d’actions autorisés (assertions métier)', async () => {
    const mod = await import('./jarvis-v6');

    expect(mod.AUTONOMY_LEVELS[0]).toEqual({
      name: 'Off',
      description: 'Aucune action automatique',
      allowedActionTypes: [],
    });

    expect(mod.AUTONOMY_LEVELS[1].allowedActionTypes).toEqual(['notification']);
    expect(mod.AUTONOMY_LEVELS[2].allowedActionTypes).toEqual(['notification', 'archive', 'reminder', 'tag']);
    expect(mod.AUTONOMY_LEVELS[3]).toMatchObject({
      name: 'Moderate',
      allowedActionTypes: ['notification', 'archive', 'reminder', 'tag', 'followup', 'draft'],
    });
    expect(mod.AUTONOMY_LEVELS[4]).toEqual({
      name: 'Full',
      description: 'Autonomie totale',
      allowedActionTypes: ['*'],
    });
  });

  it('ne dépend pas de Supabase (sanity: aucun appel supabase.from au chargement)', async () => {
    resetSupabaseMocks();
    setSupabaseResult({ data: [], error: null });

    await import('./jarvis-v6');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('renderHook + QueryClientProvider: le module ne doit exposer aucun hook React', async () => {
    const { Wrapper } = createWrapper();
    const mod = await import('./jarvis-v6');

    const exportedHookNames = Object.keys(mod).filter((k) => k.startsWith('use'));
    expect(exportedHookNames).toEqual([]);

    const { result } = renderHook(() => ({ ok: true }), { wrapper: Wrapper });
    expect(result.current.ok).toBe(true);
  });
});