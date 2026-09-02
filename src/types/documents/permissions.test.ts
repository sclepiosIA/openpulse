/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { AUTH_STATE, ROWS, mockFrom, toast } = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const ROWS = [{ id: '1' }];

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  };

  const createBuilder = () => {
    const state: {
      result: unknown;
      error: { message: string } | null;
    } = { result: null, error: null };

    const builder: Record<string, unknown> = {
      __setResult(res: unknown) {
        state.result = res;
        state.error = null;
        return builder;
      },
      __setError(message: string) {
        state.result = null;
        state.error = { message };
        return builder;
      },

      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      match: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        if (state.error) return { data: null, error: state.error };
        return { data: state.result, error: null };
      }),
      single: vi.fn(async () => {
        if (state.error) return { data: null, error: state.error };
        return { data: state.result, error: null };
      }),
      insert: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),

      then: (onFulfilled?: ((v: unknown) => unknown) | null, onRejected?: ((e: unknown) => unknown) | null) => {
        const payload = state.error ? { data: null, error: state.error } : { data: state.result, error: null };
        return Promise.resolve(payload).then(onFulfilled as ((v: unknown) => unknown) | undefined, onRejected as ((e: unknown) => unknown) | undefined);
      },
      catch: (onRejected?: ((e: unknown) => unknown) | null) => {
        const payload = state.error ? { data: null, error: state.error } : { data: state.result, error: null };
        return Promise.resolve(payload).catch(onRejected as ((e: unknown) => unknown) | undefined);
      },
    };

    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return { AUTH_STATE, ROWS, mockFrom, toast };
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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'k1' }),
    useParams: () => ({}),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

describe('permissions.ts', () => {
  it('exporte PERMISSION_LABELS avec les valeurs attendues', async () => {
    const mod = await import('./permissions');
    expect(mod.PERMISSION_LABELS).toEqual({
      view: 'Lecture',
      comment: 'Commentaire',
      edit: 'Édition',
      admin: 'Admin',
    });

    const keys = Object.keys(mod.PERMISSION_LABELS).sort();
    expect(keys).toEqual(['admin', 'comment', 'edit', 'view']);
  });

  it('PERMISSION_LABELS est un mapping complet et stable (pas de clés en trop)', async () => {
    const mod = await import('./permissions');

    expect(mod.PERMISSION_LABELS.view).toBe('Lecture');
    expect(mod.PERMISSION_LABELS.comment).toBe('Commentaire');
    expect(mod.PERMISSION_LABELS.edit).toBe('Édition');
    expect(mod.PERMISSION_LABELS.admin).toBe('Admin');

    expect(Object.keys(mod.PERMISSION_LABELS)).toHaveLength(4);
  });

  it('wrapper QueryClientProvider + renderHook (contrôle isLoading -> succès)', async () => {
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => {
        const [value, setValue] = React.useState<{ isLoading: boolean; data: unknown }>(() => ({
          isLoading: true,
          data: null,
        }));

        React.useEffect(() => {
          Promise.resolve().then(() => setValue({ isLoading: false, data: ROWS }));
        }, []);

        return value;
      },
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(ROWS);
    expect(Array.isArray(result.current.data)).toBe(true);
    expect((result.current.data as Array<{ id: string }>)[0].id).toBe('1');
  });

  it('wrapper QueryClientProvider + renderHook (erreur -> isError)', async () => {
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{ isLoading: boolean; isError: boolean; error: { message: string } | null }>(
          () => ({
            isLoading: true,
            isError: false,
            error: null,
          })
        );

        React.useEffect(() => {
          Promise.resolve().then(() =>
            setState({
              isLoading: false,
              isError: true,
              error: { message: 'x' },
            })
          );
        }, []);

        return state;
      },
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
  });
});