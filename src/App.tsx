import { Suspense, useEffect } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { BrowserRouter, useLocation } from 'react-router-dom'
import ScrollToTop from '@/components/ScrollToTop'
import { SidebarProvider, SidebarInset, getSidebarStateFromCookie } from '@/components/ui/sidebar'
import { Menu } from 'lucide-react'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import { useServiceWorker } from '@/hooks/system/useServiceWorker'
import { useOutboxFlusher } from '@/hooks/shared/useOutboxFlusher'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { useActiveEditingGuard } from '@/hooks/ui/useActiveEditingGuard'
import { useGlobalPresenceHeartbeat } from '@/hooks/presence/useGlobalPresenceHeartbeat'
import { useAppBadge } from '@/hooks/shared/useAppBadge'
import { useTitleBadge } from '@/hooks/shared/useTitleBadge'
import { usePWABadgeCount } from '@/hooks/ui/useNavigationBadges'
import { useDynamicManifest } from '@/hooks/shared/useDynamicManifest'
import { useTodoDesktopNotifications } from '@/hooks/tasks/useTodoDesktopNotifications'
import { useDesktopDriveAuthResponder } from '@/hooks/desktop/useDesktopDriveAuthResponder'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { RouterErrorBoundary } from '@/components/ui/router-error-boundary'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { initSentry } from '@/lib/sentry'
import { DebugBanner } from '@/components/debug/DebugBanner'
import { debug } from '@/lib/debug'
import { EmailFiltersProvider } from '@/contexts/EmailFiltersContext'
import { RealtimeEmailProvider } from '@/contexts/RealtimeEmailContext'
import { usePublicRoute } from '@/hooks/shared/usePublicRoute'
import { NavigationHistoryProvider } from '@/contexts/NavigationHistoryContext'
import { TranscriptionProvider } from '@/contexts/TranscriptionContext'
import { GlobalBreadcrumb } from '@/components/navigation/GlobalBreadcrumb'
import { SkipLinks } from '@/components/accessibility/SkipLinks'
import { PageHeaderSlotProvider, usePageHeaderSlot } from '@/contexts/PageHeaderSlotContext'
import { JarvisUnifiedProvider } from '@/contexts/JarvisUnifiedContext'
import { JarvisProactiveAlertsProvider } from '@/contexts/JarvisProactiveAlertsContext'
import { MobileDrawerProvider, useMobileDrawer } from '@/contexts/MobileDrawerContext'
import { AppProviders } from '@/components/AppProviders'
import { GardePremierLancement } from '@/components/onboarding/GardePremierLancement'
import { GardeInstallationInitiale } from '@/components/onboarding/GardeInstallationInitiale'
import { createDeferredProvider } from '@/components/shared/DeferredProvider'
import { CallProvider } from '@/contexts/CallContext'
import { SandboxBanner } from '@/components/SandboxBanner'
import { installSandboxGuard } from '@/lib/sandboxGuard'
import { supabase as _supabaseForGuard } from '@/integrations/supabase/client'
installSandboxGuard(_supabaseForGuard)

// ── Lazy-loaded non-critical components with retry (handles stale cache during deployments) ──
const DiagnosticsOverlay = lazyWithRetry(() =>
  import('@/components/debug/DiagnosticsOverlay').then((m) => ({ default: m.DiagnosticsOverlay }))
)
const FeedbackButton = lazyWithRetry(() =>
  import('@/components/feedback/FeedbackButton').then((m) => ({ default: m.FeedbackButton }))
)
const GlobalSearchDialog = lazyWithRetry(() =>
  import('@/components/search/GlobalSearchDialog').then((m) => ({ default: m.GlobalSearchDialog }))
)
const KeyboardShortcutsDialog = lazyWithRetry(() =>
  import('@/components/shortcuts/KeyboardShortcutsDialog').then((m) => ({
    default: m.KeyboardShortcutsDialog,
  }))
)
const NotificationsBell = lazyWithRetry(() =>
  import('@/components/notifications/NotificationsBell').then((m) => ({
    default: m.NotificationsBell,
  }))
)
const PushNotificationPrompt = lazyWithRetry(() =>
  import('@/components/notifications/PushNotificationPrompt').then((m) => ({
    default: m.PushNotificationPrompt,
  }))
)
const GlobalTranscriptionWidget = lazyWithRetry(() =>
  import('@/components/visio/GlobalTranscriptionWidget').then((m) => ({
    default: m.GlobalTranscriptionWidget,
  }))
)
const JarvisMiniFab = lazyWithRetry(() =>
  import('@/components/jarvis/JarvisMiniFab').then((m) => ({ default: m.JarvisMiniFab }))
)
// Direct import from file, NOT from barrel index (which re-exports 100+ modules)
const JarvisBackgroundIndicator = lazyWithRetry(() =>
  import('@/components/jarvis/JarvisBackgroundIndicator').then((m) => ({
    default: m.JarvisBackgroundIndicator,
  }))
)
const JarvisGlobalAlertIndicator = lazyWithRetry(() =>
  import('@/components/jarvis/JarvisGlobalAlertIndicator').then((m) => ({
    default: m.JarvisGlobalAlertIndicator,
  }))
)
const PulseFloatingChat = lazyWithRetry(() =>
  import('@/components/pulse/PulseFloatingChat').then((m) => ({ default: m.PulseFloatingChat }))
)
const CallWidget = lazyWithRetry(() =>
  import('@/components/cti/CallWidget').then((m) => ({ default: m.CallWidget }))
)

const AppSidebar = lazyWithRetry(() =>
  import('@/components/AppSidebar').then((m) => ({ default: m.AppSidebar }))
)
const MobileBottomNavDrawer = lazyWithRetry(() =>
  import('@/components/mobile/MobileBottomNavDrawer').then((m) => ({
    default: m.MobileBottomNavDrawer,
  }))
)

// Lazy wrapper that encapsulates useJarvisCommandBar hook + CommandBar render
const LazyCommandBarWrapper = lazyWithRetry(() =>
  import('@/components/jarvis/LazyCommandBarWrapper').then((m) => ({
    default: m.LazyCommandBarWrapper,
  }))
)

// Defer non-critical providers to prioritize dashboard rendering
const DeferredRealtimeEmailProvider = createDeferredProvider(RealtimeEmailProvider, 3000)
const DeferredJarvisAlertsProvider = createDeferredProvider(JarvisProactiveAlertsProvider, 3000)
const DeferredJarvisUnifiedProvider = createDeferredProvider(JarvisUnifiedProvider, 5000)
const DeferredTranscriptionProvider = createDeferredProvider(TranscriptionProvider, 5000)

// Stable provider component declared OUTSIDE render to prevent subtree remounts
function StableSidebarProvider({ children }: { children: React.ReactNode }) {
  // Restaure la préférence de l'utilisateur : le cookie était écrit à chaque
  // bascule mais `defaultOpen` restait figé à `true`, donc la barre repliée
  // se rouvrait à chaque rechargement.
  return <SidebarProvider defaultOpen={getSidebarStateFromCookie()}>{children}</SidebarProvider>
}

// Route modules
import { shouldHideMobileHeader, shouldHideDesktopHeader } from '@/routes/routeConfig'
import { AuthenticatedRoutes } from '@/routes/AuthenticatedRoutes'
import { PublicRoutes } from '@/routes/PublicRoutes'
import { UnauthenticatedRoutes } from '@/routes/UnauthenticatedRoutes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Keep previous data during background refetches / queryKey changes so
      // the UI doesn't flash back to a loading skeleton on every refresh
      // (fix "spinners intempestifs" pendant la navigation).
      placeholderData: keepPreviousData,
    },
    mutations: {
      retry: 1,
    },
  },
})

function AppContent() {
  useEffect(() => {
    debug.log('[DEBUG] AppContent mounted')
  }, [])

  const { user, session, loading } = useAuth()

  const location = useLocation()

  useDesktopDriveAuthResponder(session?.access_token ?? null, loading)
  useDynamicManifest()
  useActiveEditingGuard()
  useGlobalPresenceHeartbeat()
  useTitleBadge()

  useEffect(() => {
    debug.log('Auth state changed', { loading, hasUser: !!user })
  }, [loading, user])

  // OBS-1 : trace navigation (in-memory buffer 50 dernières routes)
  useEffect(() => {
    import('./lib/observability').then(({ observability }) => {
      observability.trackNavigation(location.pathname)
    })
  }, [location.pathname])

  return (
    <GardeInstallationInitiale>
      <GlobalAppOverlays />
      <AppContentApresInstallation />
    </GardeInstallationInitiale>
  )
}

function AppContentApresInstallation() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const isPublicRoute = usePublicRoute()

  if (loading) return <FullPageLoader />

  // Routes publiques : uniquement pour utilisateurs NON authentifiés.
  // Sinon, un utilisateur connecté pourrait bypass les guards RBAC en visitant
  // une URL listée comme publique (ex: /utilisateurs → fuite vers la page admin).
  if (!user && isPublicRoute) {
    return <PublicRoutes />
  }

  if (!user) {
    const currentPath = location.pathname + location.search
    const shouldAddReturnTo =
      currentPath !== '/' && !currentPath.startsWith('/auth') && !currentPath.startsWith('/__')

    const authPath = shouldAddReturnTo
      ? `/auth?returnTo=${encodeURIComponent(currentPath)}`
      : '/auth'

    return <UnauthenticatedRoutes authPath={authPath} />
  }

  return (
    <AppProviders
      providers={[
        StableSidebarProvider,
        NavigationHistoryProvider,
        PageHeaderSlotProvider,
        MobileDrawerProvider,
        CallProvider,
        DeferredRealtimeEmailProvider,
        DeferredJarvisAlertsProvider,
      ]}
    >
      <GardePremierLancement>
        <AppLayoutContent />
      </GardePremierLancement>
    </AppProviders>
  )
}

function AppLayoutContent() {
  const location = useLocation()
  const isDedicatedDesktopWindow = new URLSearchParams(location.search).get('desktopWindow') === '1'
  const { headerContent } = usePageHeaderSlot()
  const { isOpen: mobileDrawerOpen, setOpen: setMobileDrawerOpen } = useMobileDrawer()
  const { setBadge, clearBadge } = useAppBadge()
  const pwaBadgeCount = usePWABadgeCount()
  useTodoDesktopNotifications()

  useEffect(() => {
    if (pwaBadgeCount > 0) {
      setBadge(pwaBadgeCount)
    } else {
      clearBadge()
    }
  }, [pwaBadgeCount, setBadge, clearBadge])

  const hideMobileHeader = shouldHideMobileHeader(location.pathname)
  const hideDesktopHeader = shouldHideDesktopHeader(location.pathname)

  return (
    <>
      <SkipLinks />
      <SandboxBanner />
      <div className="flex h-dvh w-full overflow-hidden">
        {/* Sidebar desktop uniquement (md: 768px+) */}
        {!isDedicatedDesktopWindow && (
          <nav id="main-navigation" aria-label="Navigation principale" className="hidden md:block">
            <Suspense fallback={null}>
              <AppSidebar />
            </Suspense>
          </nav>
        )}
        <SidebarInset className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {/* Skip-to-content link (a11y) — visible uniquement au focus clavier */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Aller au contenu principal
          </a>
          {/* Header mobile avec bouton menu et fil d'Ariane */}
          {!isDedicatedDesktopWindow && !hideMobileHeader && (
            <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-sidebar px-4 md:hidden">
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="-ml-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex-1 min-w-0">
                <GlobalBreadcrumb />
              </div>
            </header>
          )}

          {/* Drawer mobile (Sheet latéral) */}
          {!isDedicatedDesktopWindow && (
            <Suspense fallback={null}>
              <MobileBottomNavDrawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen} />
            </Suspense>
          )}

          {/* Header desktop avec fil d'Ariane */}
          {!isDedicatedDesktopWindow && !hideDesktopHeader && (
            <header className="sticky top-0 z-40 hidden h-14 items-center gap-4 border-b border-sidebar-border bg-sidebar px-6 md:flex">
              {headerContent ? headerContent : <GlobalBreadcrumb />}
              <div className="ml-auto shrink-0 flex items-center gap-2">
                <Suspense fallback={null}>
                  <NotificationsBell />
                  <GlobalSearchDialog />
                </Suspense>
              </div>
            </header>
          )}

          <main
            id="main-content"
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full max-w-full has-[.pulse-page]:overflow-hidden"
            role="main"
            tabIndex={-1}
          >
            <RouterErrorBoundary fallback={<FullPageLoader />}>
              <Suspense fallback={<FullPageLoader />}>
                <AuthenticatedRoutes />
              </Suspense>
            </RouterErrorBoundary>
          </main>

          {!isDedicatedDesktopWindow && (
            <Suspense fallback={null}>
              <JarvisBackgroundIndicator />
              <JarvisGlobalAlertIndicator />
              <LazyCommandBarWrapper />
              <PulseFloatingChat />
              <CallWidget />
              {hideDesktopHeader && <GlobalSearchDialog hideTrigger />}
              <KeyboardShortcutsDialog />
            </Suspense>
          )}
        </SidebarInset>
      </div>
    </>
  )
}

function GlobalAppOverlays() {
  const location = useLocation()
  if (new URLSearchParams(location.search).get('desktopWindow') === '1') return null
  return (
    <>
      <OfflineBanner />
      {import.meta.env.DEV && <DebugBanner />}
      <Suspense fallback={null}>
        <GlobalTranscriptionWidget />
        <DiagnosticsOverlay />
        <FeedbackButton />
        <JarvisMiniFab />
        <PushNotificationPrompt />
      </Suspense>
    </>
  )
}

const App = () => {
  useServiceWorker()
  useOutboxFlusher()

  useEffect(() => {
    debug.log('App mounted')
    try {
      initSentry()
    } catch (error) {
      debug.error('Failed to initialize Sentry:', error)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AppProviders
              providers={[
                AuthProvider,
                DeferredJarvisUnifiedProvider,
                DeferredTranscriptionProvider,
                EmailFiltersProvider,
              ]}
            >
              <AppContent />
            </AppProviders>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
