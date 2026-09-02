import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title }: any) => <h1>{title}</h1>,
}))
vi.mock('@/components/people/PeopleMobileHeader', () => ({ PeopleMobileHeader: () => null }))
vi.mock('@/components/people/PeopleTabsCompact', () => ({
  PeopleTabsCompact: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/components/search/GlobalSearchDialog', () => ({ GlobalSearchDialog: () => null }))
vi.mock('@/components/people/PeopleOverview', () => ({
  PeopleOverview: () => <div data-testid="people-overview">Overview</div>,
}))
vi.mock('@/components/rh/RHSalairesTable', () => ({ RHSalairesTable: () => <div>Salaires</div> }))
vi.mock('@/components/rh/RHKPIsEnriched', () => ({ RHKPIsEnriched: () => <div>KPIs</div> }))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({ canAccessSalaires: true, team: 'direction' }),
}))
vi.mock('@/hooks/shared/useNavigationHistory', () => ({
  useNavigationHistory: () => ({ history: [], push: vi.fn(), back: vi.fn() }),
}))
vi.mock('@/hooks/shared/useVirtualBreadcrumb', () => ({ useVirtualBreadcrumb: () => {} }))
vi.mock('@/hooks/ui/useTabBreadcrumb', () => ({ useTabBreadcrumb: () => {} }))
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import People from '../People'

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('People Page', () => {
  it('renders without crashing', async () => {
    render(<People />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText('Gestion des Ressources')).toBeInTheDocument()
    })
  })

  it('shows overview section', async () => {
    render(<People />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByTestId('people-overview')).toBeInTheDocument()
    })
  })
})
