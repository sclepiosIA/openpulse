// @vitest-environment jsdom
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGlobalSearch } from './useGlobalSearch';

const {
  EMPTY_RESULTS,
  CORE_SLICE,
  OPS_SLICE,
  BUSINESS_SLICE,
  ADMIN_SLICE,
  FINANCE_SLICE,
  USER,
  SESSION,
  DEBOUNCED_VALUE,
  mockUseDebounce,
  mockUseCoreSearch,
  mockUseOpsSearch,
  mockUseBusinessSearch,
  mockUseAdminSearch,
  mockUseFinanceSearch,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
  builderResultOk,
  builderResultError,
} = vi.hoisted(() => ({
  EMPTY_RESULTS: {
    clients: [],
    properties: [],
    contacts: [],
    projects: [],
    tasks: [],
    interventions: [],
    quotes: [],
    invoices: [],
    suppliers: [],
    purchaseOrders: [],
    users: [],
    teams: [],
    vehicles: [],
    settings: [],
    expenses: [],
    payroll: [],
  },
  CORE_SLICE: {
    clients: [{ id: 'c1', label: 'Client Alpha', type: 'client' }],
    properties: [{ id: 'p1', label: 'Property One', type: 'property' }],
  },
  OPS_SLICE: {
    tasks: [{ id: 't1', label: 'Task Open', type: 'task' }],
    interventions: [{ id: 'i1', label: 'Intervention A', type: 'intervention' }],
  },
  BUSINESS_SLICE: {
    quotes: [{ id: 'q1', label: 'Quote A', type: 'quote' }],
    invoices: [{ id: 'inv1', label: 'Invoice A', type: 'invoice' }],
  },
  ADMIN_SLICE: {
    users: [{ id: 'u2', label: 'User Two', type: 'user' }],
    settings: [{ id: 's1', label: 'Setting General', type: 'setting' }],
  },
  FINANCE_SLICE: {
    expenses: [{ id: 'e1', label: 'Expense A', type: 'expense' }],
    payroll: [{ id: 'pay1', label: 'Payroll A', type: 'payroll' }],
  },
  USER: { id: 'u1', email: 't@t.co' },
  SESSION: { user: { id: 'u1' } },
  DEBOUNCED_VALUE: 'debounced-value',
  mockUseDebounce: vi.fn(),
  mockUseCoreSearch: vi.fn(),
  mockUseOpsSearch: vi.fn(),
  mockUseBusinessSearch: vi.fn(),
  mockUseAdminSearch: vi.fn(),
  mockUseFinanceSearch: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  builderResultOk: { data: null, error: null },
  builderResultError: { data: null, error: { message: 'x' } },
}));

vi.mock('./useGlobalSearch.types', async () => {
  const actual = await vi.importActual<typeof import('./useGlobalSearch.types')>('./useGlobalSearch.types');
  return {
    ...actual,
    EMPTY_RESULTS,
  };
});

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: mockUseDebounce,
}));

vi.mock('./parts/useCoreSearch', () => ({
  useCoreSearch: mockUseCoreSearch,
}));

vi.mock('./parts/useOpsSearch', () => ({
  useOpsSearch: mockUseOpsSearch,
}));

vi.mock('./parts/useBusinessSearch', () => ({
  useBusinessSearch: mockUseBusinessSearch,
}));

vi.mock('./parts/useAdminSearch', () => ({
  useAdminSearch: mockUseAdminSearch,
}));

vi.mock('./parts/useFinanceSearch', () => ({
  useFinanceSearch: mockUseFinanceSearch,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: USER,
    session: SESSION,
    isLoading: false,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: USER,
    session: SESSION,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    session: SESSION,
    isLoading: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

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
    single: vi.fn(async () => builderResultOk),
    maybeSingle: vi.fn(async () => builderResultOk),
    then: (onFulfilled: (value: typeof builderResultOk) => unknown) =>
      Promise.resolve(builderResultOk).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(builderResultError).catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      rpc: vi.fn(() => builder),
      channel: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn(),
        })),
      })),
      removeChannel: vi.fn(),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: USER }, error: null })),
      },
    },
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

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDebounce.mockImplementation((value: string) => value);

    mockUseCoreSearch.mockReturnValue({
      slice: EMPTY_RESULTS,
      isLoading: false,
    });
    mockUseOpsSearch.mockReturnValue({
      slice: EMPTY_RESULTS,
      isLoading: false,
    });
    mockUseBusinessSearch.mockReturnValue({
      slice: EMPTY_RESULTS,
      isLoading: false,
    });
    mockUseAdminSearch.mockReturnValue({
      slice: EMPTY_RESULTS,
      isLoading: false,
    });
    mockUseFinanceSearch.mockReturnValue({
      slice: EMPTY_RESULTS,
      isLoading: false,
    });
  });

  it('retourne EMPTY_RESULTS et isLoading=false quand la recherche est trop courte', () => {
    const permissions = { canViewAdmin: true, canViewFinance: true };
    const wrapper = createWrapper();

    const { result } = renderHook(() => useGlobalSearch('a', true, permissions), { wrapper });

    expect(mockUseDebounce).toHaveBeenCalledWith('a', 300);
    expect(mockUseCoreSearch).toHaveBeenCalledWith('a', false, permissions);
    expect(mockUseOpsSearch).toHaveBeenCalledWith('a', false, permissions);
    expect(mockUseBusinessSearch).toHaveBeenCalledWith('a', false);
    expect(mockUseAdminSearch).toHaveBeenCalledWith('a', false, permissions);
    expect(mockUseFinanceSearch).toHaveBeenCalledWith('a', false);
    expect(result.current.results).toBe(EMPTY_RESULTS);
    expect(result.current.isLoading).toBe(false);
  });

  it('retourne EMPTY_RESULTS et isLoading=false quand enabled=false', () => {
    const permissions = { canViewAdmin: false };
    const wrapper = createWrapper();

    const { result } = renderHook(() => useGlobalSearch('alpha', false, permissions), { wrapper });

    expect(mockUseCoreSearch).toHaveBeenCalledWith('alpha', false, permissions);
    expect(mockUseOpsSearch).toHaveBeenCalledWith('alpha', false, permissions);
    expect(mockUseBusinessSearch).toHaveBeenCalledWith('alpha', false);
    expect(mockUseAdminSearch).toHaveBeenCalledWith('alpha', false, permissions);
    expect(mockUseFinanceSearch).toHaveBeenCalledWith('alpha', false);
    expect(result.current.results).toBe(EMPTY_RESULTS);
    expect(result.current.isLoading).toBe(false);
  });

  it('agrège les slices des cinq sous-hooks quand la recherche est active', async () => {
    const permissions = { canViewAdmin: true, canViewFinance: true };
    const wrapper = createWrapper();

    mockUseCoreSearch.mockReturnValue({
      slice: CORE_SLICE,
      isLoading: false,
    });
    mockUseOpsSearch.mockReturnValue({
      slice: OPS_SLICE,
      isLoading: false,
    });
    mockUseBusinessSearch.mockReturnValue({
      slice: BUSINESS_SLICE,
      isLoading: false,
    });
    mockUseAdminSearch.mockReturnValue({
      slice: ADMIN_SLICE,
      isLoading: false,
    });
    mockUseFinanceSearch.mockReturnValue({
      slice: FINANCE_SLICE,
      isLoading: false,
    });

    const { result } = renderHook(() => useGlobalSearch('alpha', true, permissions), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockUseCoreSearch).toHaveBeenCalledWith('alpha', true, permissions);
    expect(mockUseOpsSearch).toHaveBeenCalledWith('alpha', true, permissions);
    expect(mockUseBusinessSearch).toHaveBeenCalledWith('alpha', true);
    expect(mockUseAdminSearch).toHaveBeenCalledWith('alpha', true, permissions);
    expect(mockUseFinanceSearch).toHaveBeenCalledWith('alpha', true);

    expect(result.current.results.clients).toEqual(CORE_SLICE.clients);
    expect(result.current.results.properties).toEqual(CORE_SLICE.properties);
    expect(result.current.results.tasks).toEqual(OPS_SLICE.tasks);
    expect(result.current.results.interventions).toEqual(OPS_SLICE.interventions);
    expect(result.current.results.quotes).toEqual(BUSINESS_SLICE.quotes);
    expect(result.current.results.invoices).toEqual(BUSINESS_SLICE.invoices);
    expect(result.current.results.users).toEqual(ADMIN_SLICE.users);
    expect(result.current.results.settings).toEqual(ADMIN_SLICE.settings);
    expect(result.current.results.expenses).toEqual(FINANCE_SLICE.expenses);
    expect(result.current.results.payroll).toEqual(FINANCE_SLICE.payroll);
    expect(result.current.results.clients[0]).toEqual({ id: 'c1', label: 'Client Alpha', type: 'client' });
    expect(result.current.results.tasks[0]).toEqual({ id: 't1', label: 'Task Open', type: 'task' });
  });

  it('expose isLoading=true pendant le chargement si la recherche est active', async () => {
    const wrapper = createWrapper();

    mockUseCoreSearch.mockReturnValue({
      slice: CORE_SLICE,
      isLoading: true,
    });
    mockUseOpsSearch.mockReturnValue({
      slice: OPS_SLICE,
      isLoading: false,
    });
    mockUseBusinessSearch.mockReturnValue({
      slice: BUSINESS_SLICE,
      isLoading: false,
    });
    mockUseAdminSearch.mockReturnValue({
      slice: ADMIN_SLICE,
      isLoading: false,
    });
    mockUseFinanceSearch.mockReturnValue({
      slice: FINANCE_SLICE,
      isLoading: false,
    });

    const { result } = renderHook(() => useGlobalSearch('ab', true), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    expect(result.current.results.clients).toEqual(CORE_SLICE.clients);
    expect(result.current.results.tasks).toEqual(OPS_SLICE.tasks);
    expect(result.current.results.expenses).toEqual(FINANCE_SLICE.expenses);
  });

  it('utilise la valeur debounced pour piloter la recherche', () => {
    const wrapper = createWrapper();

    mockUseDebounce.mockReturnValue(DEBOUNCED_VALUE);

    renderHook(() => useGlobalSearch('raw', true, { canViewAdmin: true }), { wrapper });

    expect(mockUseDebounce).toHaveBeenCalledWith('raw', 300);
    expect(mockUseCoreSearch).toHaveBeenCalledWith(DEBOUNCED_VALUE, true, { canViewAdmin: true });
    expect(mockUseOpsSearch).toHaveBeenCalledWith(DEBOUNCED_VALUE, true, { canViewAdmin: true });
    expect(mockUseBusinessSearch).toHaveBeenCalledWith(DEBOUNCED_VALUE, true);
    expect(mockUseAdminSearch).toHaveBeenCalledWith(DEBOUNCED_VALUE, true, { canViewAdmin: true });
    expect(mockUseFinanceSearch).toHaveBeenCalledWith(DEBOUNCED_VALUE, true);
  });

  it('propage une erreur provenant d’un sous-hook', () => {
    const wrapper = createWrapper();

    mockUseCoreSearch.mockImplementation(() => {
      throw new Error('x');
    });

    expect(() => {
      renderHook(() => useGlobalSearch('alpha', true), { wrapper });
    }).toThrow('x');
  });
});