/* @vitest-environment jsdom */

import React, { Suspense } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportingRoutes } from './ReportingRoutes'

const {
  authState,
  navigateMock,
  toastSuccess,
  toastError,
  mockFrom,
  fullPageLoaderText,
  pageTexts,
  guardCalls,
} = vi.hoisted(() => {
  const builder: Record<string, unknown> = {}
  const chain = () => builder

  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.gte = vi.fn(chain)
  builder.lte = vi.fn(chain)
  builder.in = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.upsert = vi.fn(chain)
  builder.single = vi.fn(async () => ({ data: null, error: null }))
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  builder.then = (onFulfilled?: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)

  return {
    authState: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    mockFrom: vi.fn(() => builder),
    fullPageLoaderText: 'full-page-loader',
    pageTexts: {
      rapports: 'page-rapports',
      rapportsCustom: 'page-rapports-builder-list',
      rapportView: 'page-rapport-builder-view',
      rapportEdit: 'page-rapport-builder-edit',
      calendrier: 'page-calendrier',
      gantt: 'page-gantt',
      rd: 'page-rd',
    },
    guardCalls: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: authState.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div>{fullPageLoaderText}</div>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: ({
    children,
    requiredPermission,
    allowedTeams,
    disallowedRoles,
  }: {
    children: React.ReactNode
    requiredPermission?: string
    allowedTeams?: string[]
    disallowedRoles?: string[]
  }) => {
    guardCalls({ requiredPermission, allowedTeams, disallowedRoles })
    return <>{children}</>
  },
}))

vi.mock('../lazyPages', () => ({
  Rapports: () => <div>{pageTexts.rapports}</div>,
  RapportsBuilderList: () => <div>{pageTexts.rapportsCustom}</div>,
  RapportBuilderView: () => <div>{pageTexts.rapportView}</div>,
  RapportBuilderEdit: () => <div>{pageTexts.rapportEdit}</div>,
  BIStudio: () => null,
  TempsTracking: () => null,
  ITAssets: () => null,
  Comptabilite: () => null,
  Calendrier: () => <div>{pageTexts.calendrier}</div>,
  Gantt: () => <div>{pageTexts.gantt}</div>,
  RD: () => <div>{pageTexts.rd}</div>,
}))

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({
    children,
    initialPath,
  }: {
    children: React.ReactNode
    initialPath: string
  }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

function renderAt(path: string) {
  const Wrapper = createWrapper()

  return render(
    <Wrapper initialPath={path}>
      <Routes>{ReportingRoutes()}</Routes>
    </Wrapper>
  )
}

function renderWithSuspenseAt(path: string) {
  const Wrapper = createWrapper()

  const LazyLeaf = React.lazy(async () => ({
    default: () => <Routes>{ReportingRoutes()}</Routes>,
  }))

  return render(
    <Wrapper initialPath={path}>
      <Suspense fallback={<div>{fullPageLoaderText}</div>}>
        <LazyLeaf />
      </Suspense>
    </Wrapper>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReportingRoutes', () => {
  it('affiche la page rapports sur /rapports', () => {
    renderAt('/rapports')
    expect(screen.getByText(pageTexts.rapports)).toBeInTheDocument()
  })

  it('affiche la liste des rapports custom sur /rapports-custom', () => {
    renderAt('/rapports-custom')
    expect(screen.getByText(pageTexts.rapportsCustom)).toBeInTheDocument()
  })

  it('affiche la vue d’un rapport builder sur /rapports-custom/:id', () => {
    renderAt('/rapports-custom/42')
    expect(screen.getByText(pageTexts.rapportView)).toBeInTheDocument()
  })

  it('affiche l’édition d’un rapport builder sur /rapports-custom/:id/edit', () => {
    renderAt('/rapports-custom/42/edit')
    expect(screen.getByText(pageTexts.rapportEdit)).toBeInTheDocument()
  })

  it('affiche calendrier sur /calendrier', () => {
    renderAt('/calendrier')
    expect(screen.getByText(pageTexts.calendrier)).toBeInTheDocument()
  })

  it('protège /gantt via RouteGuard avec disallowedRoles rh', () => {
    renderAt('/gantt')
    expect(screen.getByText(pageTexts.gantt)).toBeInTheDocument()
    expect(guardCalls).toHaveBeenCalledWith({
      requiredPermission: undefined,
      allowedTeams: undefined,
      disallowedRoles: ['rh'],
    })
  })

  it('protège /rd via RouteGuard avec permission, équipes autorisées et rôle interdit', () => {
    renderAt('/rd')
    expect(screen.getByText(pageTexts.rd)).toBeInTheDocument()
    expect(guardCalls).toHaveBeenCalledWith({
      requiredPermission: 'canViewRD',
      allowedTeams: ['direction', 'technique'],
      disallowedRoles: ['rh'],
    })
  })

  it('montre un état de chargement via Suspense fallback pendant le chargement initial', async () => {
    renderWithSuspenseAt('/rapports')
    expect(screen.getByText(fullPageLoaderText)).toBeInTheDocument()
    expect(await screen.findByText(pageTexts.rapports)).toBeInTheDocument()
  })

  it('ne déclenche aucun accès réseau ou supabase pour simplement déclarer les routes', () => {
    renderAt('/rapports')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })
})
