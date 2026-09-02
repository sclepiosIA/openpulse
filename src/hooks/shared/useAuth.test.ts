// @vitest-environment jsdom

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './useAuth';

const {
  AUTH_STATE,
  stableSignIn,
  stableSignUp,
  stableSignOut,
  mockUseAuth,
  mockFrom,
  builder,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => {
  const stableSignIn = vi.fn();
  const stableSignUp = vi.fn();
  const stableSignOut = vi.fn();
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    loading: false,
    signIn: stableSignIn,
    signUp: stableSignUp,
    signOut: stableSignOut,
  };

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
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    AUTH_STATE,
    stableSignIn,
    stableSignUp,
    stableSignOut,
    mockUseAuth: vi.fn(() => AUTH_STATE),
    mockFrom: vi.fn(() => builder),
    builder,
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: AUTH_STATE.user, session: AUTH_STATE.session }, error: null })),
      signUp: vi.fn(async () => ({ data: { user: AUTH_STATE.user, session: AUTH_STATE.session }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return Wrapper;
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockImplementation(() => AUTH_STATE);
  });

  it('re-exporte exactement le hook useAuth depuis AuthProvider', () => {
    expect(useAuth).toBe(mockUseAuth);
  });

  it('retourne l’état d’authentification métier attendu pour un utilisateur authentifié', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.user).toEqual({ id: 'u1', email: 'user@test.co' });
    expect(result.current.session).toEqual({ user: { id: 'u1' } });
    expect(result.current.loading).toBe(false);
    expect(result.current.signIn).toBe(stableSignIn);
    expect(result.current.signUp).toBe(stableSignUp);
    expect(result.current.signOut).toBe(stableSignOut);
    expect(mockUseAuth).toHaveBeenCalledTimes(1);
  });

  it('propage correctement un état de chargement', () => {
    mockUseAuth.mockImplementation(() => ({
      ...AUTH_STATE,
      loading: true,
    }));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toEqual({ id: 'u1', email: 'user@test.co' });
    expect(result.current.session).toEqual({ user: { id: 'u1' } });
  });

  it('propage correctement une erreur du provider', () => {
    const authError = new Error('x');

    mockUseAuth.mockImplementation(() => {
      throw authError;
    });

    expect(() =>
      renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      }),
    ).toThrow('x');
  });
});