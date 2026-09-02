/**
 * Shared render helper that wraps components with the providers most pages
 * depend on:
 *   - AuthProvider (mocked via `mockAuthModule()` — see below)
 *   - MemoryRouter (for components using <Link>, useNavigate, useLocation)
 *   - QueryClientProvider (for components using @tanstack/react-query)
 *
 * AuthProvider is NOT used directly because it has Supabase side-effects on
 * mount. Instead, tests should call `mockAuthModule()` at the top of the file:
 *
 *   import { mockAuthModule } from '@/test-utils/renderWithProviders';
 *   vi.mock('@/components/AuthProvider', () => mockAuthModule());
 *
 * Then use `renderWithProviders(<Component />)` to get a MemoryRouter +
 * QueryClient wrapper. Pass `routes` for routing tests.
 */
import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial entries for MemoryRouter (defaults to ['/']) */
  initialEntries?: string[];
  /** Optional QueryClient. A fresh one is created by default. */
  queryClient?: QueryClient;
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function AllProviders({
  children,
  initialEntries = ['/'],
  queryClient,
}: {
  children: ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries, queryClient, ...options }: RenderWithProvidersOptions = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries} queryClient={queryClient}>
        {children}
      </AllProviders>
    ),
    ...options,
  });
}

/**
 * Default mock user for tests
 */
export const TEST_USER = {
  id: 'test-user-id',
  email: 'test@test.com',
  app_metadata: {},
  user_metadata: { prenom: 'Test', nom: 'User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

/**
 * Returns a module-shaped mock for @/components/AuthProvider.
 * Usage:
 *   vi.mock('@/components/AuthProvider', () => mockAuthModule());
 *   // or with overrides:
 *   vi.mock('@/components/AuthProvider', () => mockAuthModule({ user: null }));
 */
export function mockAuthModule(overrides?: {
  user?: typeof TEST_USER | null;
  session?: { access_token: string; user: typeof TEST_USER } | null;
  loading?: boolean;
}) {
  const user = overrides?.user === undefined ? TEST_USER : overrides.user;
  const session =
    overrides?.session !== undefined
      ? overrides.session
      : user
      ? { access_token: 'mock-token', user }
      : null;
  const loading = overrides?.loading ?? false;

  const authContextValue = {
    user,
    session,
    loading,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
  };

  return {
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useAuth: () => authContextValue,
    useAuthSafe: () => authContextValue,
  };
}

/**
 * Returns a module-shaped mock for @/hooks/shared/useUserRole.
 * Addresses class-5 fails from the 2026-07 triage catalog (useAuth mocked
 * but user_roles/has_role never mocked, causing loading spinners forever).
 *
 * Usage:
 *   vi.mock('@/hooks/shared/useUserRole', () => mockUserRoleModule('admin'));
 *   // or default (admin):
 *   vi.mock('@/hooks/shared/useUserRole', () => mockUserRoleModule());
 */
export function mockUserRoleModule(
  role: 'admin' | 'direction' | 'copil' | 'rh' | 'chef_projet' | 'csm' | 'commercial' | 'user' | null = 'admin',
) {
  return {
    useUserRole: () => ({
      userRole: role,
      isLoading: false,
      isPending: false,
      isAdmin: role === 'admin',
      isDirection: role === 'direction',
      isRH: role === 'rh' || role === 'admin',
      isCSM: role === 'csm',
      isCommercial: role === 'commercial',
    }),
  };
}

/**
 * Returns a module-shaped mock for @/hooks/auth/useRolePermissions.
 * Grants all permissions by default (admin-like).
 */
export function mockRolePermissionsModule(overrides?: Record<string, boolean>) {
  return {
    useRolePermissions: () => ({
      canManageRH: true,
      canManageTresorerie: true,
      canViewSalaires: true,
      canManageEtablissements: true,
      canManageParametres: true,
      isLoading: false,
      ...overrides,
    }),
  };
}
