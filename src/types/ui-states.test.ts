declare module '@/hooks/profile/useProfilesWithRoles' {
  export type ProfileWithRole = {
    id: string;
    prenom?: string | null;
    nom?: string | null;
    role: string;
    email?: string | null;
  };
}

declare module '@/integrations/supabase/types' {
  export type Tables<T extends string = string> = Record<string, unknown>;
}

const { mockFrom, setResponse, builderMocks } = vi.hoisted(() => {
  let current: { data: unknown; error: unknown | null } = { data: null, error: null };

  const setResponse = (r: { data: unknown; error: unknown | null }) => {
    current = r;
    return current;
  };

  const select = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const gte = vi.fn().mockReturnThis();
  const lte = vi.fn().mockReturnThis();
  const inFn = vi.fn().mockReturnThis();
  const order = vi.fn().mockReturnThis();
  const limit = vi.fn().mockReturnThis();
  const insert = vi.fn().mockReturnThis();
  const update = vi.fn().mockReturnThis();
  const deleteFn = vi.fn().mockReturnThis();

  const maybeSingle = vi.fn(() => Promise.resolve(current));
  const single = vi.fn(() => Promise.resolve(current));

  const then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
    return Promise.resolve(current).then(onFulfilled, onRejected);
  };
  const catchFn = (onRejected?: (e: unknown) => unknown) => Promise.resolve(current).catch(onRejected);

  const builder = {
    select,
    eq,
    gte,
    lte,
    in: inFn,
    order,
    limit,
    insert,
    update,
    delete: deleteFn,
    maybeSingle,
    single,
    then,
    catch: catchFn,
  };

  const mockFrom = vi.fn(() => builder);

  return {
    mockFrom,
    setResponse,
    builderMocks: {
      select,
      eq,
      insert,
      update,
      delete: deleteFn,
      maybeSingle,
      single,
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

const { mockAuthReturn } = vi.hoisted(() => ({
  mockAuthReturn: {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuthReturn }));

const { toastMocks } = vi.hoisted(() => ({
  toastMocks: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: toastMocks }));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  CatalogueProduit,
  BookingStatus,
  BookingStatusUpdate,
  UserFormData,
  SelectedTache,
} from './ui-states';
import { supabase } from '@/integrations/supabase/client';

describe('ui-states - runtime and TypeScript contract checks', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children ?? null);

  it('CatalogueProduit type can be instantiated and has expected runtime values', () => {
    const produit: CatalogueProduit = {
      id: 'prod_123',
      code: 'C-123',
      nom: 'Test Produit',
      type: 'produit',
      prix_unitaire_ht: 199.99,
      taux_tva: 20,
      unite: 'pièce',
      est_actif: true,
      description: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    expect(produit.id).toBe('prod_123');
    expect(typeof produit.prix_unitaire_ht).toBe('number');
    expect(produit.type).toBe('produit');
    expect(produit.est_actif).toBeTruthy();
    expect(produit.code).toMatch(/^C-/);
  });

  it('BookingStatus union accepts allowed values at compile time and runtime equality check', () => {
    const confirmed: BookingStatus = 'confirmed';
    const pending: BookingStatus = 'pending';
    const cancelled: BookingStatus = 'cancelled';

    expect(confirmed).toBe('confirmed');
    expect(pending).toBe('pending');
    expect(cancelled).toBe('cancelled');

    const update: BookingStatusUpdate = { status: 'completed', confirmed_at: '2025-02-02T10:00:00Z' };
    expect(update.status).toBe('completed');
    expect(typeof update.confirmed_at).toBe('string');
  });

  it('UserFormData shape is enforced and values preserved at runtime', () => {
    const form: UserFormData = {
      prenom: 'Alice',
      nom: 'Doe',
      email: 'alice@example.test',
      role: 'admin' as unknown as UserFormData['role'],
      password: 'secure-pass-xyz',
      actif: true,
    };

    expect(form.prenom).toBe('Alice');
    expect(form.email).toContain('@');
    expect(form.actif).toBe(true);
  });

  it('fetch hook using mocked supabase goes through loading → success', async () => {
    setResponse({ data: { id: 't1', titre: 'Tache 1', statut: 'pending' }, error: null });

    function useFetchTache(id: string) {
      const [state, setState] = React.useState<{ isLoading: boolean; data: SelectedTache; isError: boolean }>({
        isLoading: true,
        data: null,
        isError: false,
      });

      React.useEffect(() => {
        let mounted = true;
        supabase
          .from('taches')
          .select()
          .eq('id', id)
          .maybeSingle()
          .then((res: unknown) => {
            if (!mounted) return;
            const payload = res as { data: SelectedTache; error: unknown | null } | null;
            if (payload && payload.error) {
              setState({ isLoading: false, data: null, isError: true });
            } else {
              setState({ isLoading: false, data: payload ? (payload.data as SelectedTache) : null, isError: false });
            }
          })
          .catch(() => {
            if (!mounted) return;
            setState({ isLoading: false, data: null, isError: true });
          });
        return () => {
          mounted = false;
        };
      }, [id]);

      return state;
    }

    const { result } = renderHook(() => useFetchTache('t1'), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.id).toBe('t1');
    expect(result.current.data?.titre).toBe('Tache 1');
  });

  it('fetch hook using mocked supabase handles error response (isError)', async () => {
    setResponse({ data: null, error: { message: 'fetch failed' } });

    function useFetchTacheError(id: string) {
      const [state, setState] = React.useState<{ isLoading: boolean; data: SelectedTache; isError: boolean }>({
        isLoading: true,
        data: null,
        isError: false,
      });

      React.useEffect(() => {
        let mounted = true;
        supabase
          .from('taches')
          .select()
          .eq('id', id)
          .maybeSingle()
          .then((res: unknown) => {
            if (!mounted) return;
            const payload = res as { data: SelectedTache; error: unknown | null } | null;
            if (payload && payload.error) {
              setState({ isLoading: false, data: null, isError: true });
            } else {
              setState({ isLoading: false, data: payload ? (payload.data as SelectedTache) : null, isError: false });
            }
          })
          .catch(() => {
            if (!mounted) return;
            setState({ isLoading: false, data: null, isError: true });
          });
        return () => {
          mounted = false;
        };
      }, [id]);

      return state;
    }

    const { result } = renderHook(() => useFetchTacheError('t1'), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('mutation (insert) calls supabase.from(...).insert with correct payload', async () => {
    setResponse({ data: [{ id: 'p_new', nom: 'New' }], error: null });

    function useCreateProduit() {
      return {
        create: async (payload: Partial<CatalogueProduit>) => {
          const res = await supabase.from('catalogue').insert(payload);
          const final = await (res as Promise<{ data: unknown; error: unknown | null }>);
          return final;
        },
      };
    }

    const { result } = renderHook(() => useCreateProduit(), { wrapper: Wrapper });

    const payload = { code: 'NEW1', nom: 'Produit Nouveau', type: 'service', prix_unitaire_ht: 10, taux_tva: 10, unite: 'u', est_actif: true };

    await act(async () => {
      // call the mutation and await its internal await
       
      const r = await result.current.create(payload);
      void r;
    });

    expect(mockFrom).toHaveBeenCalledWith('catalogue');
    expect(builderMocks.insert).toHaveBeenCalledWith(payload);
  });
});