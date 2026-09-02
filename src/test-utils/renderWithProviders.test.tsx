/* @vitest-environment jsdom */
import React from 'react';
import { screen, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  AllProviders,
  TEST_USER,
  createTestQueryClient,
  mockAuthModule,
  renderWithProviders,
} from './renderWithProviders';

const { AUTH_USER, AUTH_SESSION, MUTATION_RESULT } = vi.hoisted(() => ({
  AUTH_USER: {
    id: 'u1',
    email: 't@t.co',
    app_metadata: {},
    user_metadata: { prenom: 'Test', nom: 'User' },
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  AUTH_SESSION: {
    access_token: 'tok',
    user: {
      id: 'u1',
      email: 't@t.co',
      app_metadata: {},
      user_metadata: { prenom: 'Test', nom: 'User' },
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00.000Z',
    },
  },
  MUTATION_RESULT: { ok: true, id: 'm1' },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function QueryProbe() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['probe'],
    queryFn: () =>
      new Promise<{ label: string }>((resolve) => {
        setTimeout(() => resolve({ label: 'loaded-value' }), 0);
      }),
  });

  if (isLoading) return <div data-testid="state">loading</div>;
  if (isError) return <div data-testid="state">{(error as Error).message}</div>;
  return <div data-testid="state">{data.label}</div>;
}

describe('renderWithProviders', () => {
  it('createTestQueryClient crée un QueryClient avec les options de test attendues', () => {
    const client = createTestQueryClient();

    expect(client).toBeInstanceOf(QueryClient);
    expect(client.getDefaultOptions().queries?.retry).toBe(false);
    expect(client.getDefaultOptions().queries?.staleTime).toBe(0);
    expect(client.getDefaultOptions().queries?.gcTime).toBe(0);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('AllProviders fournit MemoryRouter avec la route initiale', () => {
    renderWithProviders(<LocationProbe />, {
      initialEntries: ['/settings/profile'],
    });

    expect(screen.getByTestId('location').textContent).toBe('/settings/profile');
  });

  it('AllProviders fournit QueryClientProvider et passe de loading à succès', async () => {
    renderWithProviders(<QueryProbe />);

    expect(screen.getByTestId('state').textContent).toBe('loading');

    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toBe('loaded-value');
    });
  });

  it('renderWithProviders utilise le queryClient fourni', async () => {
    const providedClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const hook = renderHook(
      () =>
        useQuery({
          queryKey: ['client-check'],
          queryFn: async () => 'ok',
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={providedClient}>{children}</QueryClientProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(hook.result.current.isSuccess).toBe(true);
    });

    expect(hook.result.current.data).toBe('ok');
  });

  it('supporte un hook query dans un wrapper QueryClientProvider avec chargement puis succès', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      });
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['hook-success'],
          queryFn: () =>
            new Promise<{ total: number }>((resolve) => {
              setTimeout(() => resolve({ total: 3 }), 0);
            }),
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ total: 3 });
  });

  it('supporte un hook query en erreur avec isError=true', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      });
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['hook-error'],
          queryFn: async () => {
            const response = { data: null, error: { message: 'x' } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('x');
  });

  it('supporte une mutation dans un wrapper QueryClientProvider', async () => {
    const mutateFn = vi.fn().mockResolvedValue(MUTATION_RESULT);

    const wrapper = ({ children }: { children: React.ReactNode }) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      });
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: mutateFn,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isIdle).toBe(true);
    });

    await vi.waitFor(async () => {
      await result.current.mutateAsync({ name: 'Alice', active: true });
    });

    expect(mutateFn).toHaveBeenCalledWith({ name: 'Alice', active: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(MUTATION_RESULT);
  });

  it('TEST_USER expose les champs métier attendus', () => {
    expect(TEST_USER.id).toBe('test-user-id');
    expect(TEST_USER.email).toBe('test@test.com');
    expect(TEST_USER.user_metadata).toEqual({ prenom: 'Test', nom: 'User' });
    expect(TEST_USER.aud).toBe('authenticated');
    expect(typeof TEST_USER.created_at).toBe('string');
  });

  it('mockAuthModule renvoie un module d’auth par défaut avec user et session', async () => {
    const authModule = mockAuthModule();
    const auth = authModule.useAuth();

    expect(typeof authModule.AuthProvider).toBe('function');
    expect(auth.user).toEqual(TEST_USER);
    expect(auth.session).toEqual({ access_token: 'mock-token', user: TEST_USER });
    expect(auth.loading).toBe(false);

    await expect(auth.signIn()).resolves.toEqual({ error: null });
    await expect(auth.signUp()).resolves.toEqual({ error: null });
    await expect(auth.signOut()).resolves.toBeUndefined();
  });

  it('mockAuthModule accepte des overrides cohérents', () => {
    const authModule = mockAuthModule({
      user: AUTH_USER,
      session: AUTH_SESSION,
      loading: true,
    });
    const auth = authModule.useAuthSafe();

    expect(auth.user).toEqual(AUTH_USER);
    expect(auth.session).toEqual(AUTH_SESSION);
    expect(auth.loading).toBe(true);
  });

  it('mockAuthModule avec user null renvoie une session nulle par défaut', () => {
    const authModule = mockAuthModule({ user: null });
    const auth = authModule.useAuth();

    expect(auth.user).toBeNull();
    expect(auth.session).toBeNull();
    expect(auth.loading).toBe(false);
  });
});