import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedRoutes } from './AuthenticatedRoutes'

const {
  mockFullPageLoader,
  mockErrorBoundary,
  mockProtectedRoute,
  mockRouteGuard,
  mockUseUserRole,
  mockAdminRoutes,
  mockMobileRoutes,
  mockFinanceRoutes,
  mockCrmRoutes,
  mockEmailRoutes,
  mockReportingRoutes,
  mockDiversRoutes,
  mockDashboard,
  mockNotFound,
  mockHealthCheck,
  mockSafeShell,
  mockPulse,
  mockActivityFeed,
  mockPeople,
  mockSupport,
  mockGestionUtilisateurs,
  mockForumModeration,
  mockForumPostDetail,
  mockLiveChat,
  mockAppels,
  mockNavigateComponent,
} = vi.hoisted(() => {
  return {
    mockFullPageLoader: vi.fn(() => <div data-testid="full-page-loader">loading...</div>),
    mockErrorBoundary: vi.fn(({ children }: { children: React.ReactNode }) => (
      <div data-testid="error-boundary">{children}</div>
    )),
    mockProtectedRoute: vi.fn(({ children }: { children: React.ReactNode }) => (
      <div data-testid="protected-route">{children}</div>
    )),
    mockRouteGuard: vi.fn(({ children }: { children: React.ReactNode } & Record<string, unknown>) => (
      <div data-testid="route-guard">{children}</div>
    )),
    mockUseUserRole: vi.fn(() => ({ role: 'direction', isLoading: false })),
    mockAdminRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockMobileRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockFinanceRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockCrmRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockEmailRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockReportingRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockDiversRoutes: vi.fn(() => <>{/* group route placeholder */}</>),
    mockDashboard: vi.fn(() => <div data-testid="dashboard-page">DashboardPage</div>),
    mockNotFound: vi.fn(() => <div data-testid="not-found-page">NotFoundPage</div>),
    mockHealthCheck: vi.fn(() => <div data-testid="health-check-page">HealthCheckPage</div>),
    mockSafeShell: vi.fn(() => <div data-testid="safe-shell-page">SafeShellPage</div>),
    mockPulse: vi.fn(() => <div data-testid="pulse-page">PulsePage</div>),
    mockActivityFeed: vi.fn(() => <div data-testid="activity-feed-page">ActivityFeedPage</div>),
    mockPeople: vi.fn(() => <div data-testid="people-page">PeoplePage</div>),
    mockSupport: vi.fn(() => <div data-testid="support-page">SupportPage</div>),
    mockGestionUtilisateurs: vi.fn(
      () => <div data-testid="gestion-utilisateurs-page">GestionUtilisateursPage</div>
    ),
    mockForumModeration: vi.fn(
      () => <div data-testid="forum-moderation-page">ForumModerationPage</div>
    ),
    mockForumPostDetail: vi.fn(
      () => <div data-testid="forum-post-detail-page">ForumPostDetailPage</div>
    ),
    mockLiveChat: vi.fn(() => <div data-testid="live-chat-page">LiveChatPage</div>),
    mockAppels: vi.fn(() => <div data-testid="appels-page">AppelsPage</div>),
    mockNavigateComponent: vi.fn(({ to }: { to: unknown }) => (
      <div data-testid="navigate-to">{typeof to === 'string' ? to : JSON.stringify(to)}</div>
    )),
  }
})

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: mockFullPageLoader,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: mockErrorBoundary,
}))

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: mockProtectedRoute,
}))

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: (props: { children: React.ReactNode } & Record<string, unknown>) =>
    mockRouteGuard(props),
}))

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => mockUseUserRole(),
}))

vi.mock('./groups/AdminRoutes', () => ({
  AdminRoutes: () => mockAdminRoutes(),
}))

vi.mock('./groups/MobileRoutes', () => ({
  MobileRoutes: () => mockMobileRoutes(),
}))

vi.mock('./groups/FinanceRoutes', () => ({
  FinanceRoutes: () => mockFinanceRoutes(),
}))

vi.mock('./groups/CrmRoutes', () => ({
  CrmRoutes: () => mockCrmRoutes(),
}))

vi.mock('./groups/EmailRoutes', () => ({
  EmailRoutes: () => mockEmailRoutes(),
}))

vi.mock('./groups/ReportingRoutes', () => ({
  ReportingRoutes: () => mockReportingRoutes(),
}))

vi.mock('./groups/DiversRoutes', () => ({
  DiversRoutes: () => mockDiversRoutes(),
}))

vi.mock('./lazyPages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lazyPages')>()
  return {
    ...actual,
  Dashboard: mockDashboard,
  DirectionDashboard: mockDashboard,
  NotFound: mockNotFound,
  FormationSessionDetail: () => <div>FormationSessionDetailMock</div>,
  Pulse: mockPulse,
  Prospects: () => <div data-testid="prospects-page">ProspectsMock</div>,
  Etablissements: () => <div data-testid="etablissements-page">EtablissementsMock</div>,
  EtablissementDetail: () => <div>EtablissementDetailMock</div>,
  Deploiement: () => <div>DeploiementMock</div>,
  Production: () => <div>ProductionMock</div>,
  Projets: () => <div>ProjetsMock</div>,
  People: mockPeople,
  Rapports: () => <div>RapportsMock</div>,
  RapportsBuilderList: () => <div>RapportsBuilderListMock</div>,
  RapportBuilderView: () => <div>RapportBuilderViewMock</div>,
  RapportBuilderEdit: () => <div>RapportBuilderEditMock</div>,
  Calendrier: () => <div>CalendrierMock</div>,
  Gantt: () => <div>GanttMock</div>,
  RD: () => <div>RDMock</div>,
  Support: mockSupport,
  AnalyseGeographique: () => <div>AnalyseGeographiqueMock</div>,
  Parametres: () => <div>ParametresMock</div>,
  ParametresFeedbacks: () => <div>ParametresFeedbacksMock</div>,
  ParametresVisioconference: () => <div>ParametresVisioconferenceMock</div>,
  ParametresWebDAV: () => <div>ParametresWebDAVMock</div>,
  ParametresConfiguration: () => <div>ParametresConfigurationMock</div>,
  PortailClient: () => <div>PortailClientMock</div>,
  PortailClientTaches: () => <div>PortailClientTachesMock</div>,
  TemplatesTaches: () => <div>TemplatesTachesMock</div>,
  AIUsageDashboard: () => <div>AIUsageDashboardMock</div>,
  Profil: () => <div>ProfilMock</div>,
  GestionUtilisateurs: mockGestionUtilisateurs,
  ConfigurationSysteme: () => <div>ConfigurationSystemeMock</div>,
  GestionBaseDonnees: () => <div>GestionBaseDonneesMock</div>,
  GestionSecurite: () => <div>GestionSecuriteMock</div>,
  LogsSysteme: () => <div>LogsSystemeMock</div>,
  GestionNotifications: () => <div>GestionNotificationsMock</div>,
  CentreNotifications: () => <div>CentreNotificationsMock</div>,
  MarqueMonitor: () => <div>MarqueMonitorMock</div>,
  Emails: () => <div>EmailsMock</div>,
  EmailTemplates: () => <div>EmailTemplatesMock</div>,
  EmailAnalytics: () => <div>EmailAnalyticsMock</div>,
  EmailClassificationAnalytics: () => <div>EmailClassificationAnalyticsMock</div>,
  GestionEmailDomains: () => <div>GestionEmailDomainsMock</div>,
  Groupes: () => <div>GroupesMock</div>,
  GroupeDetail: () => <div>GroupeDetailMock</div>,
  Partenaires: () => <div>PartenairesMock</div>,
  PartenaireDetail: () => <div>PartenaireDetailMock</div>,
  FormationsGestion: () => <div>FormationsGestionMock</div>,
  FormationUserDetail: () => <div>FormationUserDetailMock</div>,
  AnalyseEtablissement: () => <div>AnalyseEtablissementMock</div>,
  AnalyseGlobale: () => <div>AnalyseGlobaleMock</div>,
  ForumModeration: mockForumModeration,
  ForumPostDetail: mockForumPostDetail,
  RessourcesDocumentaires: () => <div>RessourcesDocumentairesMock</div>,
  Tresorerie: () => <div>TresorerieMock</div>,
  Facturation: () => <div>FacturationMock</div>,
  Contrats: () => <div>ContratsMock</div>,
  ContratDetail: () => <div>ContratDetailMock</div>,
  ContractBuilder: () => <div>ContractBuilderMock</div>,
  LiveChat: mockLiveChat,
  Recrutement: () => <div>RecrutementMock</div>,
  Competences: () => <div>CompetencesMock</div>,
  KnowledgeBase: () => <div>KnowledgeBaseMock</div>,
  Booking: () => <div>BookingMock</div>,
  Rgpd: () => <div>RgpdMock</div>,
  ApiDeveloper: () => <div>ApiDeveloperMock</div>,
  Tutoriels: () => <div>TutorielsMock</div>,
  TutorielModule: () => <div>TutorielModuleMock</div>,
  Todos: () => <div>TodosMock</div>,
  Documents: () => <div>DocumentsMock</div>,
  BackendViewer: () => <div>BackendViewerMock</div>,
  SimulateurROI: () => <div>SimulateurROIMock</div>,
  Visio: () => <div>VisioMock</div>,
  HealthCheck: mockHealthCheck,
  SafeShell: mockSafeShell,
  MeetingNotes: () => <div>MeetingNotesMock</div>,
  Forms: () => <div>FormsMock</div>,
  FormBuilder: () => <div>FormBuilderMock</div>,
  FormResponses: () => <div>FormResponsesMock</div>,
  ImportCommercialData: () => <div>ImportCommercialDataMock</div>,
  Forecasting: () => <div>ForecastingMock</div>,
  AttributionV2: () => <div>AttributionV2Mock</div>,
  Automatisations: () => <div>AutomatisationsMock</div>,
  AutomatisationBuilder: () => <div>AutomatisationBuilderMock</div>,
  AutomationsHealth: () => <div>AutomationsHealthMock</div>,
  AutomationsRunsExplorer: () => <div>AutomationsRunsExplorerMock</div>,
  AutomationsWebhooksAndAlerts: () => <div>AutomationsWebhooksAndAlertsMock</div>,
  Appels: mockAppels,
  CatalogueProduits: () => <div>CatalogueProduitsMock</div>,
  ProspectsScoring: () => <div>ProspectsScoringMock</div>,
  ActivityFeed: mockActivityFeed,
  ChurnPredictor: () => <div>ChurnPredictorMock</div>,
  PlaybooksCsm: () => <div>PlaybooksCsmMock</div>,
  SocialDashboard: () => <div>SocialDashboardMock</div>,
  ParametresSocial: () => <div>ParametresSocialMock</div>,
  SocialComposer: () => <div>SocialComposerMock</div>,
  SocialCalendar: () => <div>SocialCalendarMock</div>,
  SocialInbox: () => <div>SocialInboxMock</div>,
  MobileMailApp: () => <div>MobileMailAppMock</div>,
  MobileTodosApp: () => <div>MobileTodosAppMock</div>,
  MobilePulseApp: () => <div>MobilePulseAppMock</div>,
  MobileCalendarApp: () => <div>MobileCalendarAppMock</div>,
  MobileDocumentsApp: () => <div>MobileDocumentsAppMock</div>,
  MobileBookingApp: () => <div>MobileBookingAppMock</div>,
  MobileJarvisApp: () => <div>MobileJarvisAppMock</div>,
  MobileAppsInstall: () => <div>MobileAppsInstallMock</div>,
  DpoExemple: () => <div>DpoExempleMock</div>,
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Navigate: mockNavigateComponent,
  }
})

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithProviders(initialEntries: string[]) {
  const queryClient = createTestClient()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthenticatedRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  )

  return {
    ...result,
    queryClient,
  }
}

async function expectNavigateTo(expectedPath: string) {
  await waitFor(() => {
    expect(screen.getByTestId('navigate-to')).toHaveTextContent(expectedPath)
  })
}

describe('AuthenticatedRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUserRole.mockReturnValue({ role: 'direction', isLoading: false })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()
  })

  it('rend la page Dashboard sur la route /', async () => {
    renderWithProviders(['/'])

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument()
    expect(mockDashboard).toHaveBeenCalled()
  })

  it('redirige /dashboard vers / (Dashboard)', async () => {
    renderWithProviders(['/dashboard'])

    await expectNavigateTo('/')
  })

  it("rend Etablissements sur /clients en conservant l'URL historique", async () => {
    renderWithProviders(['/clients'])

    expect(await screen.findByTestId('etablissements-page')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate-to')).not.toBeInTheDocument()
  })

  it("rend Prospects sur /commercial en conservant l'URL historique", async () => {
    renderWithProviders(['/commercial'])

    expect(await screen.findByTestId('prospects-page')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate-to')).not.toBeInTheDocument()
    expect(mockRouteGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: ['canViewProspects', 'canViewPipeline'],
        disallowedRoles: ['rh', 'marketing'],
      })
    )
  })

  it("rend Dashboard sur /direction en conservant l'URL historique", async () => {
    renderWithProviders(['/direction'])

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate-to')).not.toBeInTheDocument()
  })

  it('rend HealthCheck sur /__health', async () => {
    renderWithProviders(['/__health'])

    expect(await screen.findByTestId('health-check-page')).toBeInTheDocument()
    expect(mockHealthCheck).toHaveBeenCalled()
  })

  it('rend SafeShell sur /__safe', async () => {
    renderWithProviders(['/__safe'])

    expect(await screen.findByTestId('safe-shell-page')).toBeInTheDocument()
    expect(mockSafeShell).toHaveBeenCalled()
  })

  it('rend Pulse sous ErrorBoundary et Suspense sur /pulse', async () => {
    renderWithProviders(['/pulse'])

    expect(await screen.findByTestId('error-boundary')).toBeInTheDocument()
    expect(await screen.findByTestId('pulse-page')).toBeInTheDocument()
    expect(mockPulse).toHaveBeenCalled()
  })

  it('rend ActivityFeed sur /activite', async () => {
    renderWithProviders(['/activite'])

    expect(await screen.findByTestId('activity-feed-page')).toBeInTheDocument()
    expect(mockActivityFeed).toHaveBeenCalled()
  })

  it('redirige /people/:id vers /people', async () => {
    renderWithProviders(['/people/abc123'])

    await expectNavigateTo('/people')
  })

  it('redirige /rh/paie vers /people?tab=salaires sous RouteGuard', async () => {
    renderWithProviders(['/rh/paie'])

    expect(await screen.findByTestId('route-guard')).toBeInTheDocument()
    await expectNavigateTo('/people?tab=salaires')
  })

  it('redirige /admin vers /parametres sous RouteGuard adminOnly', async () => {
    renderWithProviders(['/admin'])

    expect(await screen.findByTestId('route-guard')).toBeInTheDocument()
    await expectNavigateTo('/parametres')
  })

  it('redirige /pipeline/contrats vers /contrats pour role direction', async () => {
    mockUseUserRole.mockReturnValueOnce({ role: 'direction', isLoading: false })

    renderWithProviders(['/pipeline/contrats'])

    await expectNavigateTo('/contrats')
  })

  it('redirige /pipeline/contrats vers /prospects pour role commercial', async () => {
    mockUseUserRole.mockReturnValueOnce({ role: 'commercial', isLoading: false })

    renderWithProviders(['/pipeline/contrats'])

    await expectNavigateTo('/prospects')
  })

  it('affiche FullPageLoader pendant le chargement du role sur /pipeline/contrats', async () => {
    mockUseUserRole.mockReturnValueOnce({ role: null, isLoading: true })

    renderWithProviders(['/pipeline/contrats'])

    expect(await screen.findByTestId('full-page-loader')).toBeInTheDocument()
  })

  it('redirige /support/:id vers /support?ticket=:id', async () => {
    renderWithProviders(['/support/xyz987'])

    await expectNavigateTo('/support?ticket=xyz987')
  })

  it('rend Support sous RouteGuard sur /support', async () => {
    renderWithProviders(['/support'])

    expect(await screen.findByTestId('route-guard')).toBeInTheDocument()
    expect(await screen.findByTestId('support-page')).toBeInTheDocument()
  })

  it('rend GestionUtilisateurs avec strict admin guard sur /utilisateurs', async () => {
    renderWithProviders(['/utilisateurs'])

    expect(await screen.findByTestId('route-guard')).toBeInTheDocument()
    expect(await screen.findByTestId('gestion-utilisateurs-page')).toBeInTheDocument()
  })

  it('rend ForumModeration sous ProtectedRoute sur /forum-moderation', async () => {
    renderWithProviders(['/forum-moderation'])

    expect(await screen.findByTestId('protected-route')).toBeInTheDocument()
    expect(await screen.findByTestId('forum-moderation-page')).toBeInTheDocument()
  })

  it('rend ForumPostDetail sous ProtectedRoute sur /forum/post/:postId', async () => {
    renderWithProviders(['/forum/post/abc'])

    expect(await screen.findByTestId('protected-route')).toBeInTheDocument()
    expect(await screen.findByTestId('forum-post-detail-page')).toBeInTheDocument()
  })

  it('rend LiveChat sous ProtectedRoute sur /live-chat', async () => {
    renderWithProviders(['/live-chat'])

    expect(await screen.findByTestId('protected-route')).toBeInTheDocument()
    expect(await screen.findByTestId('live-chat-page')).toBeInTheDocument()
  })

  it('rend Appels sous RouteGuard sur /appels', async () => {
    renderWithProviders(['/appels'])

    expect(await screen.findByTestId('route-guard')).toBeInTheDocument()
    expect(await screen.findByTestId('appels-page')).toBeInTheDocument()
  })

  it('redirige /auth vers /dashboard', async () => {
    renderWithProviders(['/auth'])

    await expectNavigateTo('/dashboard')
  })

  it('redirige /login vers /dashboard', async () => {
    renderWithProviders(['/login'])

    await expectNavigateTo('/dashboard')
  })

  it('redirige /booking vers /prise-rdv', async () => {
    renderWithProviders(['/booking'])

    await expectNavigateTo('/prise-rdv')
  })

  it('redirige /pipeline vers /prospects sous RouteGuard', async () => {
    renderWithProviders(['/pipeline'])

    expect(await screen.findByTestId('route-guard')).toBeInTheDocument()
    await expectNavigateTo('/prospects')
    expect(mockRouteGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermission: 'canViewPipeline',
        allowedTeams: ['direction', 'commercial'],
        disallowedRoles: ['rh', 'marketing'],
      })
    )
  })

  it('rend NotFound sur une route inconnue', async () => {
    renderWithProviders(['/route-inconnue-123'])

    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument()
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('intègre AdminRoutes, FinanceRoutes, CrmRoutes, EmailRoutes, ReportingRoutes et DiversRoutes', async () => {
    renderWithProviders(['/'])

    await waitFor(() => {
      expect(mockAdminRoutes).toHaveBeenCalled()
      expect(mockFinanceRoutes).toHaveBeenCalled()
      expect(mockCrmRoutes).toHaveBeenCalled()
      expect(mockEmailRoutes).toHaveBeenCalled()
      expect(mockReportingRoutes).toHaveBeenCalled()
      expect(mockDiversRoutes).toHaveBeenCalled()
    })
  })

  it('intègre MobileRoutes', async () => {
    renderWithProviders(['/'])

    await waitFor(() => {
      expect(mockMobileRoutes).toHaveBeenCalled()
    })
  })
})