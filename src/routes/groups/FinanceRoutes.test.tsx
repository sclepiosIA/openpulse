import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const { mockFrom } = vi.hoisted(() => {
  const createThenableBuilder = () => {
    const builder: Record<string, unknown> = {}

    const chainable = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'contains',
      'order',
      'limit',
      'range',
      'insert',
      'upsert',
      'update',
      'delete',
      'rpc',
      'or',
      'filter',
      'match',
    ] as const

    for (const name of chainable) {
      builder[name] = vi.fn(() => builder)
    }

    ;(builder as { single: unknown }).single = vi.fn(async () => ({ data: null, error: null }))
    ;(builder as { maybeSingle: unknown }).maybeSingle = vi.fn(async () => ({ data: null, error: null }))

    ;(builder as { then: unknown }).then = (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)

    ;(builder as { catch: unknown }).catch = (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected)

    return builder
  }

  const builder = createThenableBuilder()
  const mockFrom = vi.fn(() => builder)

  return { mockFrom }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

const {
  authState,
  routeGuardCalls,
  protectedRouteCalls,
  FullPageLoaderMock,
  ErrorBoundaryMock,
} = vi.hoisted(() => ({
  authState: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
    roles: ['direction'],
    teams: ['direction'],
    permissions: {
      canViewTresorerie: true,
    },
  },
  routeGuardCalls: [] as Array<{
    requiredPermission?: string
    allowedTeams?: string[]
    disallowedRoles?: string[]
    adminOnly?: boolean
  }>,
  protectedRouteCalls: [] as Array<{ called: true }>,
  FullPageLoaderMock: vi.fn(() => <div data-testid="fullpage-loader">loading</div>),
  ErrorBoundaryMock: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
}))

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => FullPageLoaderMock(),
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => ErrorBoundaryMock({ children }),
}))

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => {
    protectedRouteCalls.push({ called: true })
    return <div data-testid="protected-route">{children}</div>
  },
}))

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: ({
    children,
    requiredPermission,
    allowedTeams,
    disallowedRoles,
    adminOnly,
  }: {
    children: React.ReactNode
    requiredPermission?: string
    allowedTeams?: string[]
    disallowedRoles?: string[]
    adminOnly?: boolean
  }) => {
    routeGuardCalls.push({ requiredPermission, allowedTeams, disallowedRoles, adminOnly })

    const hasDisallowedRole = (disallowedRoles ?? []).some((r) => authState.roles.includes(r))
    if (hasDisallowedRole) return <div data-testid="routeguard-denied">denied</div>

    if (adminOnly) {
      const isAdmin = authState.roles.includes('admin')
      if (!isAdmin) return <div data-testid="routeguard-denied">denied</div>
    }

    if (requiredPermission) {
      const ok = Boolean((authState.permissions as Record<string, boolean>)[requiredPermission])
      if (!ok) return <div data-testid="routeguard-denied">denied</div>
    }

    if (allowedTeams && allowedTeams.length > 0) {
      const ok = allowedTeams.some((t) => authState.teams.includes(t))
      if (!ok) return <div data-testid="routeguard-denied">denied</div>
    }

    return <div data-testid="routeguard-allowed">{children}</div>
  },
}))

vi.mock('../lazyPages', () => ({
  Tresorerie: () => <div data-testid="page-tresorerie">Tresorerie</div>,
  Finances: () => <div data-testid="page-finances">Finances</div>,
  Facturation: () => <div data-testid="page-facturation">Facturation</div>,
  Contrats: () => <div data-testid="page-contrats">Contrats</div>,
  ContratDetail: () => <div data-testid="page-contrat-detail">ContratDetail</div>,
  CatalogueProduits: () => <div data-testid="page-catalogue-produits">CatalogueProduits</div>,
  Forecasting: () => <div data-testid="page-forecasting">Forecasting</div>,
  AttributionV2: () => <div data-testid="page-attribution">AttributionV2</div>,
  ChurnPredictor: () => <div data-testid="page-churn">ChurnPredictor</div>,
  PlaybooksCsm: () => <div data-testid="page-playbooks-csm">PlaybooksCsm</div>,
  SocialDashboard: () => <div data-testid="page-social-dashboard">SocialDashboard</div>,
  ParametresSocial: () => <div data-testid="page-parametres-social">ParametresSocial</div>,
  SocialComposer: () => <div data-testid="page-social-composer">SocialComposer</div>,
  SocialCalendar: () => <div data-testid="page-social-calendar">SocialCalendar</div>,
  SocialInbox: () => <div data-testid="page-social-inbox">SocialInbox</div>,
  Automatisations: () => <div data-testid="page-automatisations">Automatisations</div>,
  AutomationsHealth: () => <div data-testid="page-automations-health">AutomationsHealth</div>,
  AutomationsRunsExplorer: () => <div data-testid="page-automations-runs">AutomationsRunsExplorer</div>,
  AutomationsWebhooksAndAlerts: () => <div data-testid="page-automations-webhooks">AutomationsWebhooksAndAlerts</div>,
  AutomatisationBuilder: () => <div data-testid="page-automatisation-builder">AutomatisationBuilder</div>,
  ContractBuilder: () => <div data-testid="page-contract-builder">ContractBuilder</div>,
}))

import { FinanceRoutes } from './FinanceRoutes'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderAt(pathname: string) {
  const client = createQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          {FinanceRoutes()}
          <Route path="*" element={<div data-testid="no-match">no-match</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('FinanceRoutes', () => {
  it('rend la page Trésorerie sur /tresorerie avec le RouteGuard attendu', async () => {
    authState.roles = ['direction']
    authState.teams = ['direction']
    authState.permissions = { canViewTresorerie: true }
    routeGuardCalls.length = 0

    renderAt('/tresorerie')

    expect(await screen.findByTestId('page-tresorerie')).toBeTruthy()

    const call = routeGuardCalls.find((c) => c.requiredPermission === 'canViewTresorerie')
    expect(call).toEqual({
      requiredPermission: 'canViewTresorerie',
      allowedTeams: ['direction'],
      disallowedRoles: ['rh'],
      adminOnly: undefined,
    })
  })

  it('redirige /cfo vers /tresorerie', async () => {
    authState.roles = ['direction']
    authState.teams = ['direction']
    authState.permissions = { canViewTresorerie: true }
    routeGuardCalls.length = 0

    renderAt('/cfo')

    expect(await screen.findByTestId('page-tresorerie')).toBeTruthy()
  })

  it('redirige /csm vers /playbooks-csm', async () => {
    authState.roles = ['direction']
    authState.teams = ['direction']
    authState.permissions = { canViewTresorerie: true }
    routeGuardCalls.length = 0

    renderAt('/csm')

    expect(await screen.findByTestId('page-playbooks-csm')).toBeTruthy()
  })

  it('redirige /automatisations/:id vers /automatisations/:id/edit (BUG-042)', async () => {
    authState.roles = ['direction']
    authState.teams = ['direction']
    authState.permissions = { canViewTresorerie: true }
    routeGuardCalls.length = 0

    renderAt('/automatisations/42')

    expect(await screen.findByTestId('page-automatisation-builder')).toBeTruthy()
  })

  it("protège /parametres/social via adminOnly (refuse si non-admin)", async () => {
    authState.roles = ['direction']
    authState.teams = ['direction']
    authState.permissions = { canViewTresorerie: true }
    routeGuardCalls.length = 0

    renderAt('/parametres/social')

    expect(await screen.findByTestId('routeguard-denied')).toBeTruthy()

    const call = routeGuardCalls.find((c) => c.adminOnly === true)
    expect(call).toEqual({
      requiredPermission: undefined,
      allowedTeams: undefined,
      disallowedRoles: undefined,
      adminOnly: true,
    })
  })

  it('wrappe /contrats/builder/:id avec ProtectedRoute', async () => {
    authState.roles = ['direction']
    authState.teams = ['direction']
    authState.permissions = { canViewTresorerie: true }
    protectedRouteCalls.length = 0

    renderAt('/contrats/builder/7')

    expect(await screen.findByTestId('page-contract-builder')).toBeTruthy()
    expect(screen.getByTestId('protected-route')).toBeTruthy()
    expect(protectedRouteCalls.length).toBe(1)
  })
})