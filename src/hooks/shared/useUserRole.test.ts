import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUserRole } from './useUserRole';

const { mockFrom, mockMaybeSingle, mockListResult, authState } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockListResult = { current: { data: null as unknown, error: null as unknown } };
  const builder: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete'];
  chain.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.maybeSingle = mockMaybeSingle;
  builder.single = mockMaybeSingle;
  builder.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(mockListResult.current).then(resolve, reject);
  builder.catch = () => builder;
  const mockFrom = vi.fn(() => builder);
  const authState = {
    user: { id: 'u1', email: 't@t.co' } as { id: string; email: string } | null,
    loading: false,
  };
  return { mockFrom, mockMaybeSingle, mockListResult, authState };
});


vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: { reference: { staleTime: 1800000 } },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'u1', email: 't@t.co' };
    authState.loading = false;
    mockListResult.current = { data: null, error: null };
  });


  it('est en chargement pendant que la query du rôle est pending', () => {
    mockMaybeSingle.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.role).toBeUndefined();
    expect(result.current.isAdmin).toBe(false);
  });

  it('retourne role=admin avec isAdmin=true et isDirection=false', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('admin');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isDirection).toBe(false);
    expect(result.current.isCopil).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('user_roles');
  });

  it('retourne role=direction avec isAdmin=true et isDirection=true', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'direction' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('direction');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isDirection).toBe(true);
    expect(result.current.isCopil).toBe(false);
  });

  it('retourne role=copil avec isCopil=true et isAdmin=false', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'copil' }, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('copil');
    expect(result.current.isCopil).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isDirection).toBe(false);
  });

  it('retourne role=null quand aucun rôle trouvé (data null)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isDirection).toBe(false);
    expect(result.current.isCopil).toBe(false);
  });

  it('retourne role=null en cas d\'erreur supabase (gérée par le hook)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'x' } });
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it('ne déclenche pas la query sans utilisateur et isLoading=false', () => {
    authState.user = null;
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.role).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('isLoading=true tant que l\'auth charge', () => {
    authState.user = null;
    authState.loading = true;
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('résout le rôle par priorité (admin > direction) sur fallback PGRST116', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'multiple rows' } });
    mockListResult.current = {
      data: [{ role: 'direction' }, { role: 'admin' }, { role: 'commercial' }],
      error: null,
    };
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('admin');
    expect(result.current.isAdmin).toBe(true);
  });

  it('résout direction quand admin absent (priorité direction > rh > commercial)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'multiple rows' } });
    mockListResult.current = {
      data: [{ role: 'commercial' }, { role: 'rh' }, { role: 'direction' }],
      error: null,
    };
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('direction');
    expect(result.current.isDirection).toBe(true);
  });

  it('respecte toute la priorité PGRST116: admin > direction > copil > rh > chef_projet > csm > commercial', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'multiple rows' } });
    mockListResult.current = {
      data: [
        { role: 'commercial' },
        { role: 'csm' },
        { role: 'chef_projet' },
        { role: 'rh' },
        { role: 'copil' },
      ],
      error: null,
    };
    const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('copil');
    expect(result.current.isCopil).toBe(true);
  });
});
