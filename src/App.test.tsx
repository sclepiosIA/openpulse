// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const {
  AUTH_LOADING,
  AUTH_PUBLIC,
  AUTH_PRIVATE,
  SERVICE_WORKER_STATE,
  ROUTE_STATE,
  PAGE_HEADER_STATE,
  MOBILE_DRAWER_STATE,
  APP_BADGE_STATE,
  PWA_BADGE_STATE,
  INSTALLATION_STATE,
  OBSERVABILITY_TRACK_NAVIGATION,
  mockFrom,
  INIT_SENTRY_MOCK,
  INSTALL_SANDBOX_GUARD_MOCK,
  DESKTOP_DRIVE_AUTH_RESPONDER,
  DEBUG_LOG_MOCK,
  DEBUG_ERROR_MOCK,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.gte.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.upsert.mockReturnValue(builder)
  builder.single.mockResolvedValue({ data: null, error: null })
  builder.maybeSingle.mockResolvedValue({ data: null, error: null })
  builder.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(onFulfilled({ data: null, error: null }))
  )
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }))

  return {
    AUTH_LOADING: {
      user: null as null | { id: string; email: string },
      session: null as null | { access_token: string },
      loading: true,
    },
    AUTH_PUBLIC: {
      user: null as null | { id: string; email: string },
      session: null as null | { access_token: string },
      loading: false,
    },
    AUTH_PRIVATE: {
      user: { id: 'u1', email: 'user@test.co' },
      session: { access_token: 'web-access-token' } as null | { access_token: string },
      loading: false,
    },
    SERVICE_WORKER_STATE: { needRefresh: false, updateServiceWorker: vi.fn() },
    ROUTE_STATE: {
      pathname: '/',
      search: '',
      isPublicRoute: false,
      hideMobileHeader: false,
      hideDesktopHeader: false,
    },
    PAGE_HEADER_STATE: { headerContent: null as React.ReactNode },
    MOBILE_DRAWER_STATE: { isOpen: false, setOpen: vi.fn() },
    APP_BADGE_STATE: { setBadge: vi.fn(), clearBadge: vi.fn() },
    PWA_BADGE_STATE: { count: 0 },
    INSTALLATION_STATE: { requise: false },
    OBSERVABILITY_TRACK_NAVIGATION: vi.fn(),
    mockFrom: vi.fn(() => builder),
    INIT_SENTRY_MOCK: vi.fn(),
    INSTALL_SANDBOX_GUARD_MOCK: vi.fn(),
    DESKTOP_DRIVE_AUTH_RESPONDER: vi.fn(),
    DEBUG_LOG_MOCK: vi.fn(),
    DEBUG_ERROR_MOCK: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

vi.mock('@/lib/sandboxGuard', () => ({
  installSandboxGuard: INSTALL_SANDBOX_GUARD_MOCK,
}))

vi.mock('@/lib/sentry', () => ({
  initSentry: INIT_SENTRY_MOCK,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: DEBUG_LOG_MOCK,
    error: DEBUG_ERROR_MOCK,
  },
}))

vi.mock('./lib/observability', () => ({
  observability: {
    trackNavigation: OBSERVABILITY_TRACK_NAVIGATION,
  },
}))

vi.mock('@/lib/lazyWithRetry', () => ({
  lazyWithRetry: (factory: () => Promise<{ default: React.ComponentType<object> }>) =>
    React.lazy(factory),
}))

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="sonner" />,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ScrollToTop', () => ({
  default: () => <div data-testid="scroll-to-top" />,
}))

vi.mock('@/components/ui/sidebar', () => ({
  // Exporté par le module réel : App lit la préférence de repli au montage.
  getSidebarStateFromCookie: () => true,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarInset: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
}))

vi.mock('lucide-react', () => ({
  Menu: () => <svg data-testid="menu-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
}))

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(() => AUTH_PRIVATE),
}))

vi.mock('@/hooks/system/useServiceWorker', () => ({
  useServiceWorker: vi.fn(() => SERVICE_WORKER_STATE),
}))

vi.mock('@/hooks/ui/useActiveEditingGuard', () => ({
  useActiveEditingGuard: vi.fn(),
}))

vi.mock('@/hooks/presence/useGlobalPresenceHeartbeat', () => ({
  useGlobalPresenceHeartbeat: vi.fn(),
}))

vi.mock('@/hooks/shared/useAppBadge', () => ({
  useAppBadge: vi.fn(() => APP_BADGE_STATE),
}))

vi.mock('@/hooks/shared/useTitleBadge', () => ({
  useTitleBadge: vi.fn(),
}))

vi.mock('@/hooks/ui/useNavigationBadges', () => ({
  usePWABadgeCount: vi.fn(() => PWA_BADGE_STATE.count),
}))

vi.mock('@/hooks/shared/useDynamicManifest', () => ({
  useDynamicManifest: vi.fn(),
}))

vi.mock('@/hooks/desktop/useDesktopDriveAuthResponder', () => ({
  useDesktopDriveAuthResponder: DESKTOP_DRIVE_AUTH_RESPONDER,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div data-testid="full-page-loader">loading app</div>,
}))

vi.mock('@/components/ui/router-error-boundary', () => ({
  RouterErrorBoundary: ({
    children,
  }: {
    children: React.ReactNode
    fallback?: React.ReactNode
  }) => <>{children}</>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/debug/DebugBanner', () => ({
  DebugBanner: () => <div data-testid="debug-banner" />,
}))

vi.mock('@/contexts/EmailFiltersContext', () => ({
  EmailFiltersProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/RealtimeEmailContext', () => ({
  RealtimeEmailProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/shared/usePublicRoute', () => ({
  usePublicRoute: vi.fn(() => ROUTE_STATE.isPublicRoute),
}))

vi.mock('@/contexts/NavigationHistoryContext', () => ({
  NavigationHistoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/TranscriptionContext', () => ({
  TranscriptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/navigation/GlobalBreadcrumb', () => ({
  GlobalBreadcrumb: () => <div data-testid="breadcrumb">breadcrumb</div>,
}))

vi.mock('@/components/accessibility/SkipLinks', () => ({
  SkipLinks: () => <div data-testid="skip-links" />,
}))

vi.mock('@/contexts/PageHeaderSlotContext', () => ({
  PageHeaderSlotProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePageHeaderSlot: vi.fn(() => PAGE_HEADER_STATE),
}))

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/JarvisProactiveAlertsContext', () => ({
  JarvisProactiveAlertsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/MobileDrawerContext', () => ({
  MobileDrawerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMobileDrawer: vi.fn(() => MOBILE_DRAWER_STATE),
}))

vi.mock('@/components/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode; providers?: unknown[] }) => (
    <>{children}</>
  ),
}))

vi.mock('@/components/shared/DeferredProvider', () => ({
  createDeferredProvider:
    (Provider: React.ComponentType<{ children: React.ReactNode }>) =>
    ({ children }: { children: React.ReactNode }) => <Provider>{children}</Provider>,
}))

vi.mock('@/contexts/CallContext', () => ({
  CallProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/SandboxBanner', () => ({
  SandboxBanner: () => <div data-testid="sandbox-banner" />,
}))

vi.mock('@/routes/routeConfig', () => ({
  shouldHideMobileHeader: vi.fn(() => ROUTE_STATE.hideMobileHeader),
  shouldHideDesktopHeader: vi.fn(() => ROUTE_STATE.hideDesktopHeader),
}))

vi.mock('@/routes/AuthenticatedRoutes', () => ({
  AuthenticatedRoutes: () => <div>authenticated routes content</div>,
}))

// La garde de premier lancement laisse passer : son comportement propre est
// verifie par son propre fichier d'epreuves, pas ici.
vi.mock('@/components/onboarding/GardePremierLancement', () => ({
  GardePremierLancement: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/routes/PublicRoutes', () => ({
  PublicRoutes: () => <div>public routes content</div>,
}))

vi.mock('@/routes/UnauthenticatedRoutes', () => ({
  UnauthenticatedRoutes: ({ authPath }: { authPath: string }) => (
    <div data-testid="unauth-routes">{authPath}</div>
  ),
}))

vi.mock('@/components/debug/DiagnosticsOverlay', () => ({
  DiagnosticsOverlay: () => <div data-testid="diagnostics-overlay" />,
}))

vi.mock('@/components/feedback/FeedbackButton', () => ({
  FeedbackButton: () => <div data-testid="feedback-button" />,
}))

vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: ({ hideTrigger }: { hideTrigger?: boolean }) => (
    <div data-testid={hideTrigger ? 'global-search-hidden-trigger' : 'global-search-dialog'} />
  ),
}))

vi.mock('@/components/shortcuts/KeyboardShortcutsDialog', () => ({
  KeyboardShortcutsDialog: () => <div data-testid="keyboard-shortcuts-dialog" />,
}))

vi.mock('@/components/notifications/NotificationsBell', () => ({
  NotificationsBell: () => <div data-testid="notifications-bell" />,
}))

vi.mock('@/components/notifications/PushNotificationPrompt', () => ({
  PushNotificationPrompt: () => <div data-testid="push-prompt" />,
}))

vi.mock('@/components/onboarding/GardeInstallationInitiale', () => ({
  GardeInstallationInitiale: ({ children }: { children: React.ReactNode }) =>
    INSTALLATION_STATE.requise ? <div data-testid="installation-initiale" /> : <>{children}</>,
}))

vi.mock('@/components/visio/GlobalTranscriptionWidget', () => ({
  GlobalTranscriptionWidget: () => <div data-testid="global-transcription-widget" />,
}))

vi.mock('@/components/jarvis/JarvisMiniFab', () => ({
  JarvisMiniFab: () => <div data-testid="jarvis-mini-fab" />,
}))

vi.mock('@/components/jarvis/JarvisBackgroundIndicator', () => ({
  JarvisBackgroundIndicator: () => <div data-testid="jarvis-bg-indicator" />,
}))

vi.mock('@/components/jarvis/JarvisGlobalAlertIndicator', () => ({
  JarvisGlobalAlertIndicator: () => <div data-testid="jarvis-global-alert-indicator" />,
}))

vi.mock('@/components/pulse/PulseFloatingChat', () => ({
  PulseFloatingChat: () => <div data-testid="pulse-chat" />,
}))

vi.mock('@/components/cti/CallWidget', () => ({
  CallWidget: () => <div data-testid="call-widget" />,
}))

vi.mock('@/components/AppSidebar', () => ({
  default: () => <div data-testid="app-sidebar" />,
  AppSidebar: () => <div data-testid="app-sidebar" />,
}))

vi.mock('@/components/mobile/MobileBottomNavDrawer', () => ({
  MobileBottomNavDrawer: ({ open }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="mobile-drawer">{open ? 'open' : 'closed'}</div>
  ),
}))

vi.mock('@/components/jarvis/LazyCommandBarWrapper', () => ({
  LazyCommandBarWrapper: () => <div data-testid="lazy-command-bar" />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useLocation: vi.fn(() => ({ pathname: ROUTE_STATE.pathname, search: ROUTE_STATE.search })),
  }
})

import App from './App'

describe('App', () => {
  beforeEach(() => {
    AUTH_LOADING.user = null
    AUTH_LOADING.session = null
    AUTH_LOADING.loading = true

    AUTH_PUBLIC.user = null
    AUTH_PUBLIC.session = null
    AUTH_PUBLIC.loading = false

    AUTH_PRIVATE.user = { id: 'u1', email: 'user@test.co' }
    AUTH_PRIVATE.session = { access_token: 'web-access-token' }
    AUTH_PRIVATE.loading = false

    SERVICE_WORKER_STATE.needRefresh = false
    SERVICE_WORKER_STATE.updateServiceWorker.mockReset()

    ROUTE_STATE.pathname = '/'
    ROUTE_STATE.search = ''
    ROUTE_STATE.isPublicRoute = false
    ROUTE_STATE.hideMobileHeader = false
    ROUTE_STATE.hideDesktopHeader = false

    PAGE_HEADER_STATE.headerContent = null

    MOBILE_DRAWER_STATE.isOpen = false
    MOBILE_DRAWER_STATE.setOpen.mockReset()

    APP_BADGE_STATE.setBadge.mockReset()
    APP_BADGE_STATE.clearBadge.mockReset()

    PWA_BADGE_STATE.count = 0
    INSTALLATION_STATE.requise = false

    OBSERVABILITY_TRACK_NAVIGATION.mockReset()
    INIT_SENTRY_MOCK.mockReset()
    DESKTOP_DRIVE_AUTH_RESPONDER.mockReset()
    DEBUG_LOG_MOCK.mockReset()
    DEBUG_ERROR_MOCK.mockReset()
  })

  it('affiche le loader pendant le chargement auth', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_LOADING)

    render(<App />)

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(screen.queryByText('authenticated routes content')).not.toBeInTheDocument()
  })

  it("ne rend aucun overlay global pendant l'installation initiale", async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PUBLIC)
    INSTALLATION_STATE.requise = true

    render(<App />)

    expect(await screen.findByTestId('installation-initiale')).toBeInTheDocument()
    expect(screen.queryByTestId('push-prompt')).not.toBeInTheDocument()
    expect(screen.queryByTestId('diagnostics-overlay')).not.toBeInTheDocument()
    expect(screen.queryByTestId('feedback-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('jarvis-mini-fab')).not.toBeInTheDocument()
  })

  it('rend les routes publiques pour un utilisateur non authentifié sur route publique', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PUBLIC)
    ROUTE_STATE.isPublicRoute = true
    ROUTE_STATE.pathname = '/pricing'

    render(<App />)

    expect(await screen.findByText('public routes content')).toBeInTheDocument()
    await waitFor(() => {
      expect(OBSERVABILITY_TRACK_NAVIGATION).toHaveBeenCalledWith('/pricing')
    })
  })

  it('redirige vers auth avec returnTo calculé sur route privée non authentifiée', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PUBLIC)
    ROUTE_STATE.pathname = '/documents'
    ROUTE_STATE.search = '?tab=open'

    render(<App />)

    const unauth = await screen.findByTestId('unauth-routes')
    expect(unauth).toHaveTextContent('/auth?returnTo=%2Fdocuments%3Ftab%3Dopen')
  })

  it('rend le layout authentifié, met le badge PWA et ouvre le menu mobile', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PRIVATE)
    ROUTE_STATE.pathname = '/dashboard'
    PWA_BADGE_STATE.count = 3

    render(<App />)

    expect(await screen.findByText('authenticated routes content')).toBeInTheDocument()
    expect(screen.getByText('Aller au contenu principal')).toBeInTheDocument()
    expect(screen.getAllByTestId('breadcrumb').length).toBeGreaterThan(0)
    expect(await screen.findByTestId('app-sidebar')).toBeInTheDocument()
    expect(await screen.findByTestId('notifications-bell')).toBeInTheDocument()
    expect(await screen.findByTestId('global-search-dialog')).toBeInTheDocument()
    expect(DESKTOP_DRIVE_AUTH_RESPONDER).toHaveBeenCalledWith('web-access-token', false)

    await waitFor(() => {
      expect(APP_BADGE_STATE.setBadge).toHaveBeenCalledWith(3)
    })

    const mobileMenuButton = screen.getByLabelText('Ouvrir le menu')
    expect(mobileMenuButton).toHaveClass('h-11', 'w-11', 'focus-visible:ring-2')

    fireEvent.click(mobileMenuButton)
    expect(MOBILE_DRAWER_STATE.setOpen).toHaveBeenCalledWith(true)
  })

  it('masque tout le chrome global dans une fenêtre desktop dédiée', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PRIVATE)
    ROUTE_STATE.pathname = '/emails'
    ROUTE_STATE.search = '?desktopWindow=1'

    render(<App />)

    expect(await screen.findByText('authenticated routes content')).toBeInTheDocument()
    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pulse-chat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('jarvis-mini-fab')).not.toBeInTheDocument()
    expect(screen.queryByTestId('lazy-command-bar')).not.toBeInTheDocument()
  })

  it('efface le badge quand le compteur PWA est à zéro et affiche la recherche headless si header desktop masqué', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PRIVATE)
    ROUTE_STATE.pathname = '/todos'
    ROUTE_STATE.hideDesktopHeader = true
    PWA_BADGE_STATE.count = 0

    render(<App />)

    expect(await screen.findByText('authenticated routes content')).toBeInTheDocument()
    await waitFor(() => {
      expect(APP_BADGE_STATE.clearBadge).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByTestId('global-search-hidden-trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('notifications-bell')).not.toBeInTheDocument()
  })

  it('ne rend plus la bannière de mise à jour PWA app-shell', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PRIVATE)
    SERVICE_WORKER_STATE.needRefresh = true

    render(<App />)

    expect(await screen.findByText('authenticated routes content')).toBeInTheDocument()
    expect(screen.queryByText('Mise à jour disponible')).not.toBeInTheDocument()
    expect(SERVICE_WORKER_STATE.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('journalise une erreur si initSentry échoue', async () => {
    const authModule = await import('@/components/AuthProvider')
    vi.mocked(authModule.useAuth).mockReturnValue(AUTH_PRIVATE)
    INIT_SENTRY_MOCK.mockImplementation(() => {
      throw new Error('sentry failed')
    })

    render(<App />)

    expect(await screen.findByText('authenticated routes content')).toBeInTheDocument()
    await waitFor(() => {
      expect(DEBUG_ERROR_MOCK).toHaveBeenCalled()
    })
    expect(DEBUG_ERROR_MOCK.mock.calls[0]?.[0]).toBe('Failed to initialize Sentry:')
  })

  it('installe la sandbox guard au chargement du module', () => {
    expect(INSTALL_SANDBOX_GUARD_MOCK).toHaveBeenCalledTimes(1)
  })
})
