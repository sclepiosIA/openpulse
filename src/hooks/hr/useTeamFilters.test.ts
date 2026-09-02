// @vitest-environment jsdom

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamFilters } from './useTeamFilters';

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const resolved = { data: null, error: null } as const;

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      match: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      or: vi.fn(() => builder),
      not: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => resolved),
      maybeSingle: vi.fn(async () => resolved),
      then: (
        onFulfilled: (value: typeof resolved) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(resolved).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(resolved).catch(onRejected),
    };
    return builder;
  };

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => createBuilder()),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
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

  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useTeamFilters', () => {
  it('retourne les filtres par défaut', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    expect(result.current.filters).toEqual({
      search: '',
      role: 'all',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.role).toBe('all');
    expect(result.current.filters.status).toBe('all');
    expect(result.current.filters.workload).toBe('all');
    expect(result.current.filters.sortBy).toBe('name');
    expect(result.current.filters.sortOrder).toBe('asc');
    expect(typeof result.current.updateFilter).toBe('function');
    expect(typeof result.current.resetFilters).toBe('function');
  });

  it('met à jour chaque filtre avec les valeurs métier attendues', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('search', 'alice');
      result.current.updateFilter('role', 'manager');
      result.current.updateFilter('status', 'actif');
      result.current.updateFilter('workload', 'high');
      result.current.updateFilter('sortBy', 'completion');
      result.current.updateFilter('sortOrder', 'desc');
    });

    expect(result.current.filters).toEqual({
      search: 'alice',
      role: 'manager',
      status: 'actif',
      workload: 'high',
      sortBy: 'completion',
      sortOrder: 'desc',
    });
  });

  it('préserve les autres filtres lors de la mise à jour d’un seul champ', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('role', 'commercial');
    });

    expect(result.current.filters).toEqual({
      search: '',
      role: 'commercial',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.status).toBe('all');
    expect(result.current.filters.workload).toBe('all');
    expect(result.current.filters.sortBy).toBe('name');
    expect(result.current.filters.sortOrder).toBe('asc');
  });

  it('reset les filtres aux valeurs initiales après plusieurs modifications', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('search', 'pipeline');
      result.current.updateFilter('role', 'chef_projet');
      result.current.updateFilter('status', 'inactif');
      result.current.updateFilter('workload', 'medium');
      result.current.updateFilter('sortBy', 'lastActivity');
      result.current.updateFilter('sortOrder', 'desc');
    });

    expect(result.current.filters).toEqual({
      search: 'pipeline',
      role: 'chef_projet',
      status: 'inactif',
      workload: 'medium',
      sortBy: 'lastActivity',
      sortOrder: 'desc',
    });

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual({
      search: '',
      role: 'all',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('supporte plusieurs mises à jour successives du même filtre en gardant la dernière valeur', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('search', 'a');
      result.current.updateFilter('search', 'al');
      result.current.updateFilter('search', 'alice');
      result.current.updateFilter('sortOrder', 'desc');
      result.current.updateFilter('sortOrder', 'asc');
    });

    expect(result.current.filters.search).toBe('alice');
    expect(result.current.filters.sortOrder).toBe('asc');
  });

  it('met à jour un filtre puis un autre sans écraser la valeur précédente', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    await act(async () => {
      result.current.updateFilter('search', 'marie');
    });

    expect(result.current.filters).toEqual({
      search: 'marie',
      role: 'all',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    await act(async () => {
      result.current.updateFilter('workload', 'low');
    });

    expect(result.current.filters).toEqual({
      search: 'marie',
      role: 'all',
      status: 'all',
      workload: 'low',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('reset fonctionne même si les filtres sont déjà à leur valeur initiale', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTeamFilters(), { wrapper });

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual({
      search: '',
      role: 'all',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });
});