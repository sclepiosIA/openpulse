// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicRoutes } from './PublicRoutes'

const {
  mockFrom,
  mockNavigate,
  AUTH_STATE,
  routeRenderState,
} = vi.hoisted(() => {
  const createBuilder = () => {
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
    }
    return builder
  }

  return {
    mockFrom: vi.fn(() => createBuilder()),
    mockNavigate: vi.fn(),
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    routeRenderState: {
      resetPasswordShouldSuspend: false,
      resetPasswordShouldError: false,
      resetPasswordPromise: null as Promise<never> | null,
    },
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div data-testid="full-page-loader">Chargement...</div>,
}))

vi.mock('@/components/layouts/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="public-layout">{children}</div>
  ),
}))

vi.mock('./lazyPages', () => ({
  ResetPassword: () => {
    if (routeRenderState.resetPasswordShouldError) {
      throw new Error('x')
    }
    if (routeRenderState.resetPasswordShouldSuspend) {
      if (!routeRenderState.resetPasswordPromise) {
        routeRenderState.resetPasswordPromise = new Promise<never>(() => {})
      }
      throw routeRenderState.resetPasswordPromise
    }
    return <div data-testid="reset-password-page">ResetPassword page</div>
  },
  EnqueteSatisfactionSolution: () => (
    <div data-testid="enquete-satisfaction-page">EnqueteSatisfactionSolution page</div>
  ),
  EnqueteCES: () => <div data-testid="enquete-ces-page">EnqueteCES page</div>,
  EnqueteSatisfaction: () => (
    <div data-testid="enquete-satisfaction-token-page">EnqueteSatisfaction page</div>
  ),
  EnqueteSuiviCSM: () => <div data-testid="enquete-suivi-csm-page">EnqueteSuiviCSM page</div>,
  ForumPostDetail: ({ context }: { context: string }) => (
    <div data-testid="forum-post-detail-page">ForumPostDetail:{context}</div>
  ),
  PublicBooking: () => <div data-testid="public-booking-page">PublicBooking page</div>,
  MobileAppsInstall: () => <div data-testid="mobile-apps-install-page">MobileAppsInstall page</div>,
  MobileAppInstallPage: () => (
    <div data-testid="mobile-app-install-page">MobileAppInstallPage page</div>
  ),
  FormPublic: () => <div data-testid="form-public-page">FormPublic page</div>,
  DpoExemple: () => <div data-testid="dpo-exemple-page">DpoExemple page</div>,
  PublicLinkPlaceholder: ({
    title,
    description,
  }: {
    title: string
    description: string
  }) => (
    <div data-testid="public-link-placeholder">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
  MentionsLegales: () => <div data-testid="mentions-legales-page">MentionsLegales page</div>,
  PolitiqueConfidentialite: () => (
    <div data-testid="politique-confidentialite-page">PolitiqueConfidentialite page</div>
  ),
  PublicTransfer: () => <div data-testid="public-transfer-page">PublicTransfer page</div>,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="route-error">Route error</div>
    }
    return this.props.children
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderAt(path: string) {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <TestErrorBoundary>
          <PublicRoutes />
        </TestErrorBoundary>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicRoutes', () => {
  it('affiche le fallback de chargement quand une page lazy suspend', () => {
    routeRenderState.resetPasswordShouldSuspend = true
    routeRenderState.resetPasswordShouldError = false
    routeRenderState.resetPasswordPromise = null

    renderAt('/auth/reset-password')

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('reset-password-page')).not.toBeInTheDocument()

    routeRenderState.resetPasswordShouldSuspend = false
    routeRenderState.resetPasswordPromise = null
  })

  it('rend la page publique simple sans layout pour /auth/reset-password', () => {
    routeRenderState.resetPasswordShouldSuspend = false
    routeRenderState.resetPasswordShouldError = false

    renderAt('/auth/reset-password')

    expect(screen.getByTestId('reset-password-page')).toHaveTextContent('ResetPassword page')
    expect(screen.queryByTestId('public-layout')).not.toBeInTheDocument()
  })

  it('rend les routes avec PublicLayout et les bonnes pages métier', () => {
    const cases = [
      ['/enquete-satisfaction-solution', 'enquete-satisfaction-page', 'EnqueteSatisfactionSolution page'],
      ['/rdv/mon-slug', 'public-booking-page', 'PublicBooking page'],
      ['/dpo-exemple', 'dpo-exemple-page', 'DpoExemple page'],
      ['/mentions-legales', 'mentions-legales-page', 'MentionsLegales page'],
      ['/politique-confidentialite', 'politique-confidentialite-page', 'PolitiqueConfidentialite page'],
    ] as const

    for (const [path, testId, expectedText] of cases) {
      const { unmount } = renderAt(path)
      expect(screen.getByTestId('public-layout')).toBeInTheDocument()
      expect(screen.getByTestId(testId)).toHaveTextContent(expectedText)
      unmount()
    }
  })

  it('rend les placeholders avec les textes attendus pour les routes incomplètes', () => {
    const rdv = renderAt('/rdv')
    expect(screen.getByRole('heading', { name: 'Prise de rendez-vous' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Le lien de prise de rendez-vous nécessite un identifiant fourni par votre interlocuteur OpenPulse',
      ),
    ).toBeInTheDocument()
    rdv.unmount()

    const form = renderAt('/f')
    expect(screen.getByRole('heading', { name: 'Formulaire public' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ce formulaire nécessite un identifiant fourni par votre interlocuteur OpenPulse',
      ),
    ).toBeInTheDocument()
    form.unmount()

    const testPage = renderAt('/test')
    expect(screen.getByRole('heading', { name: 'Page de test' })).toBeInTheDocument()
    expect(
      screen.getByText('Cette URL est réservée aux tests internes OpenPulse'),
    ).toBeInTheDocument()
    testPage.unmount()
  })

  it('rend les pages publiques sans layout pour les routes dédiées', () => {
    const mobile = renderAt('/m/install')
    expect(screen.getByTestId('mobile-apps-install-page')).toHaveTextContent('MobileAppsInstall page')
    expect(screen.queryByTestId('public-layout')).not.toBeInTheDocument()
    mobile.unmount()

    const mobileApp = renderAt('/m/ios/install')
    expect(screen.getByTestId('mobile-app-install-page')).toHaveTextContent(
      'MobileAppInstallPage page',
    )
    expect(screen.queryByTestId('public-layout')).not.toBeInTheDocument()
    mobileApp.unmount()

    const formPublic = renderAt('/f/form-slug')
    expect(screen.getByTestId('form-public-page')).toHaveTextContent('FormPublic page')
    expect(screen.queryByTestId('public-layout')).not.toBeInTheDocument()
    formPublic.unmount()

    const transfer = renderAt('/transfer/abc123')
    expect(screen.getByTestId('public-transfer-page')).toHaveTextContent('PublicTransfer page')
    expect(screen.queryByTestId('public-layout')).not.toBeInTheDocument()
    transfer.unmount()

    const surveyCases = [
      ['/enquete/ces/token-2', 'enquete-ces-page', 'EnqueteCES page'],
      ['/enquete/satisfaction/token-3', 'enquete-satisfaction-token-page', 'EnqueteSatisfaction page'],
      ['/enquete/suivi-csm/token-4', 'enquete-suivi-csm-page', 'EnqueteSuiviCSM page'],
    ] as const

    for (const [path, testId, expectedText] of surveyCases) {
      const survey = renderAt(path)
      expect(screen.getByTestId(testId)).toHaveTextContent(expectedText)
      expect(screen.queryByTestId('public-layout')).not.toBeInTheDocument()
      survey.unmount()
    }
  })

  it('affiche une erreur si une page lazy lève une exception', () => {
    routeRenderState.resetPasswordShouldSuspend = false
    routeRenderState.resetPasswordShouldError = true

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderAt('/auth/reset-password')

    expect(screen.getByTestId('route-error')).toHaveTextContent('Route error')

    routeRenderState.resetPasswordShouldError = false
    spy.mockRestore()
  })
})