/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorielLivePreview } from './TutorielLivePreview'

const {
  HERO_METRICS_PROPS,
  EMAIL_THREADS,
  ETABLISSEMENT,
  PROFILES,
  THREAD_ENRICHED_DATA,
  AUTH_STATE,
  mockFrom,
  PREVIEW_TEXTS,
} = vi.hoisted(() => {
  const result = { data: null, error: null as null | { message: string } }
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }

  return {
    HERO_METRICS_PROPS: {
      title: 'KPIs Demo',
      metrics: [
        { id: 'm1', label: 'CA', value: 120 },
        { id: 'm2', label: 'Marge', value: 42 },
      ],
    },
    EMAIL_THREADS: [
      { id: 'demo-thread-1', subject: 'Sujet A' },
      { id: 'demo-thread-2', subject: 'Sujet B' },
      { id: 'demo-thread-3', subject: 'Sujet C' },
    ],
    ETABLISSEMENT: { id: 'etab-1', nom: 'Clinique Demo' },
    PROFILES: [{ id: 'p1', name: 'Alice' }],
    THREAD_ENRICHED_DATA: new Map([
      ['demo-thread-1', { score: 1 }],
      ['demo-thread-2', { score: 2 }],
      ['demo-thread-3', { score: 3 }],
    ]),
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => builder),
    PREVIEW_TEXTS: {
      dashboardKPIs: 'Dashboard KPIs Preview',
      dashboardPipeline: 'Dashboard Pipeline Preview',
      adminSettings: 'Admin Settings Preview',
      dashboardActions: 'Dashboard Actions Preview',
      emailInbox: 'Email Inbox Preview',
      emailCompose: 'Email Compose Preview',
      emailClassification: 'Email Classification Preview',
      crmEtablissement: 'CRM Etablissement Preview',
      crmContacts: 'CRM Contacts Preview',
      crmNotes: 'CRM Notes Preview',
      groupeCard: 'Groupe Card Preview',
      partenaireCard: 'Partenaire Card Preview',
      relationsTimeline: 'Relations Timeline Preview',
      forumPostList: 'Forum Post List Preview',
      forumPostDetail: 'Forum Post Detail Preview',
      forumStats: 'Forum Stats Preview',
      tresorerieDashboard: 'Tresorerie Dashboard Preview',
      tresorerieRevenus: 'Tresorerie Revenus Preview',
      tresorerieDepenses: 'Tresorerie Depenses Preview',
      rhOverview: 'RH Overview Preview',
      rhTeamList: 'RH Team List Preview',
      rhSalaires: 'RH Salaires Preview',
      rhBulletinParsing: 'RH Bulletin Parsing Preview',
      rhAbsences: 'RH Absences Preview',
      calendarTimeline: 'Calendar Timeline Preview',
      calendarMonth: 'Calendar Month Preview',
      calendarEventDetail: 'Calendar Event Detail Preview',
      calendarReminders: 'Calendar Reminders Preview',
      ganttChart: 'Gantt Chart Preview',
      ganttTaskBar: 'Gantt Task Bar Preview',
      ganttFilters: 'Gantt Filters Preview',
      rdDashboard: 'RD Dashboard Preview',
      rdSprintBoard: 'RD Sprint Board Preview',
      rdBurndown: 'RD Burndown Preview',
      rdAiAssist: 'RD AI Assist Preview',
      formationSession: 'Formation Session Preview',
      formationEmargement: 'Formation Emargement Preview',
      formationQRCode: 'Formation QRCode Preview',
      formationSatisfaction: 'Formation Satisfaction Preview',
      formationAnalytics: 'Formation Analytics Preview',
      deploiementPhases: 'Deploiement Phases Preview',
      deploiementKanban: 'Deploiement Kanban Preview',
      deploiementGantt: 'Deploiement Gantt Preview',
      deploiementAlertes: 'Deploiement Alertes Preview',
      productionHealthScore: 'Production Health Score Preview',
      productionCohorts: 'Production Cohorts Preview',
      productionCSMActions: 'Production CSM Actions Preview',
      productionRenewalAlerts: 'Production Renewal Alerts Preview',
      projetsTaskList: 'Projets Task List Preview',
      projetsFiltres: 'Projets Filtres Preview',
      projetsAnalytics: 'Projets Analytics Preview',
      projetsActionsEnMasse: 'Projets Actions En Masse Preview',
      adminUsersList: 'Admin Users List Preview',
      adminSecurity: 'Admin Security Preview',
      rapportChart: 'Rapport Chart Preview',
      rapportExport: 'Rapport Export Preview',
      rapportFilters: 'Rapport Filters Preview',
      map: 'Map Preview',
      tableauGeo: 'Tableau Geo Preview',
      regionDetail: 'Region Detail Preview',
    },
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

vi.mock('lucide-react', () => ({
  Eye: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg data-testid="eye-icon" className={className} style={style} />
  ),
  Sparkles: ({ className }: { className?: string }) => <svg data-testid="sparkles-icon" className={className} />,
}))

vi.mock('@/components/dashboard/HeroMetrics', () => ({
  HeroMetrics: (props: typeof HERO_METRICS_PROPS) => (
    <div data-testid="hero-metrics">
      <span>{props.title}</span>
      <span>{String(props.metrics.length)}</span>
      <span>{props.metrics[0].label}</span>
      <span>{String(props.metrics[0].value)}</span>
      <span>{props.metrics[1].label}</span>
      <span>{String(props.metrics[1].value)}</span>
    </div>
  ),
}))

vi.mock('@/components/email/EmailListItemModern', () => ({
  EmailListItemModern: ({
    thread,
    isNew,
  }: {
    thread: { id: string; subject: string }
    isNew: boolean
  }) => (
    <div data-testid="email-item">
      <span>{thread.id}</span>
      <span>{thread.subject}</span>
      <span>{isNew ? 'new' : 'old'}</span>
    </div>
  ),
}))

vi.mock('@/components/etablissement/EnhancedEtablissementCard', () => ({
  EnhancedEtablissementCard: ({
    etablissement,
    profiles,
  }: {
    etablissement: { id: string; nom: string }
    profiles: Array<{ id: string; name: string }>
  }) => (
    <div data-testid="etablissement-card">
      <span>{etablissement.id}</span>
      <span>{etablissement.nom}</span>
      <span>{profiles[0].name}</span>
      <span>{String(profiles.length)}</span>
    </div>
  ),
}))

vi.mock('./TutorielMockProviders', () => ({
  TutorielPreviewWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="preview-wrapper">{children}</div>,
  mockHeroMetricsProps: HERO_METRICS_PROPS,
  mockEmailThreads: EMAIL_THREADS,
  mockEtablissement: ETABLISSEMENT,
  mockProfiles: PROFILES,
  mockThreadEnrichedData: THREAD_ENRICHED_DATA,
}))

vi.mock('./previews/TresoreriePreviews', () => ({
  TresorerieDashboardPreview: () => <div>{PREVIEW_TEXTS.tresorerieDashboard}</div>,
  TresorerieRevenusPreview: () => <div>{PREVIEW_TEXTS.tresorerieRevenus}</div>,
  TresorerieDepensesPreview: () => <div>{PREVIEW_TEXTS.tresorerieDepenses}</div>,
}))

vi.mock('./previews/RHPreviews', () => ({
  RHOverviewPreview: () => <div>{PREVIEW_TEXTS.rhOverview}</div>,
  RHTeamListPreview: () => <div>{PREVIEW_TEXTS.rhTeamList}</div>,
  RHSalairesPreview: () => <div>{PREVIEW_TEXTS.rhSalaires}</div>,
  RHBulletinParsingPreview: () => <div>{PREVIEW_TEXTS.rhBulletinParsing}</div>,
  RHAbsencesPreview: () => <div>{PREVIEW_TEXTS.rhAbsences}</div>,
}))

vi.mock('./previews/CalendrierPreviews', () => ({
  CalendarTimelinePreview: () => <div>{PREVIEW_TEXTS.calendarTimeline}</div>,
  CalendarMonthPreview: () => <div>{PREVIEW_TEXTS.calendarMonth}</div>,
  CalendarEventDetailPreview: () => <div>{PREVIEW_TEXTS.calendarEventDetail}</div>,
  CalendarRemindersPreview: () => <div>{PREVIEW_TEXTS.calendarReminders}</div>,
}))

vi.mock('./previews/GanttPreviews', () => ({
  GanttChartPreview: () => <div>{PREVIEW_TEXTS.ganttChart}</div>,
  GanttTaskBarPreview: () => <div>{PREVIEW_TEXTS.ganttTaskBar}</div>,
  GanttFiltersPreview: () => <div>{PREVIEW_TEXTS.ganttFilters}</div>,
}))

vi.mock('./previews/RDPreviews', () => ({
  RDDashboardPreview: () => <div>{PREVIEW_TEXTS.rdDashboard}</div>,
  RDSprintBoardPreview: () => <div>{PREVIEW_TEXTS.rdSprintBoard}</div>,
  RDBurndownPreview: () => <div>{PREVIEW_TEXTS.rdBurndown}</div>,
  RDAIAssistPreview: () => <div>{PREVIEW_TEXTS.rdAiAssist}</div>,
}))

vi.mock('./previews/FormationPreviews', () => ({
  FormationSessionPreview: () => <div>{PREVIEW_TEXTS.formationSession}</div>,
  FormationEmargementPreview: () => <div>{PREVIEW_TEXTS.formationEmargement}</div>,
  FormationQRCodePreview: () => <div>{PREVIEW_TEXTS.formationQRCode}</div>,
  FormationSatisfactionPreview: () => <div>{PREVIEW_TEXTS.formationSatisfaction}</div>,
  FormationAnalyticsPreview: () => <div>{PREVIEW_TEXTS.formationAnalytics}</div>,
}))

vi.mock('./previews/DeploiementPreviews', () => ({
  DeploiementPhasesPreview: () => <div>{PREVIEW_TEXTS.deploiementPhases}</div>,
  DeploiementKanbanPreview: () => <div>{PREVIEW_TEXTS.deploiementKanban}</div>,
  DeploiementGanttPreview: () => <div>{PREVIEW_TEXTS.deploiementGantt}</div>,
  DeploiementAlertesPreview: () => <div>{PREVIEW_TEXTS.deploiementAlertes}</div>,
}))

vi.mock('./previews/ProductionPreviews', () => ({
  ProductionHealthScorePreview: () => <div>{PREVIEW_TEXTS.productionHealthScore}</div>,
  ProductionCohortsPreview: () => <div>{PREVIEW_TEXTS.productionCohorts}</div>,
  ProductionCSMActionsPreview: () => <div>{PREVIEW_TEXTS.productionCSMActions}</div>,
  ProductionRenewalAlertsPreview: () => <div>{PREVIEW_TEXTS.productionRenewalAlerts}</div>,
}))

vi.mock('./previews/ProjetsPreviews', () => ({
  ProjetsTaskListPreview: () => <div>{PREVIEW_TEXTS.projetsTaskList}</div>,
  ProjetsFiltresPreview: () => <div>{PREVIEW_TEXTS.projetsFiltres}</div>,
  ProjetsAnalyticsPreview: () => <div>{PREVIEW_TEXTS.projetsAnalytics}</div>,
  ProjetsActionsEnMassePreview: () => <div>{PREVIEW_TEXTS.projetsActionsEnMasse}</div>,
}))

vi.mock('./previews/AdministrationPreviews', () => ({
  AdminUsersListPreview: () => <div>{PREVIEW_TEXTS.adminUsersList}</div>,
  AdminSecurityPreview: () => <div>{PREVIEW_TEXTS.adminSecurity}</div>,
  AdminSettingsPreview: () => <div>{PREVIEW_TEXTS.adminSettings}</div>,
}))

vi.mock('./previews/DashboardPreviews', () => ({
  DashboardKPIsPreview: () => <div>{PREVIEW_TEXTS.dashboardKPIs}</div>,
  DashboardPipelinePreview: () => <div>{PREVIEW_TEXTS.dashboardPipeline}</div>,
  DashboardActionsPreview: () => <div>{PREVIEW_TEXTS.dashboardActions}</div>,
}))

vi.mock('./previews/EmailsPreviews', () => ({
  EmailInboxPreview: () => <div>{PREVIEW_TEXTS.emailInbox}</div>,
  EmailComposePreview: () => <div>{PREVIEW_TEXTS.emailCompose}</div>,
  EmailClassificationPreview: () => <div>{PREVIEW_TEXTS.emailClassification}</div>,
}))

vi.mock('./previews/CRMPreviews', () => ({
  CRMEtablissementPreview: () => <div>{PREVIEW_TEXTS.crmEtablissement}</div>,
  CRMContactsPreview: () => <div>{PREVIEW_TEXTS.crmContacts}</div>,
  CRMNotesPreview: () => <div>{PREVIEW_TEXTS.crmNotes}</div>,
}))

vi.mock('./previews/GroupesPartenairesPreviews', () => ({
  GroupeCardPreview: () => <div>{PREVIEW_TEXTS.groupeCard}</div>,
  PartenaireCardPreview: () => <div>{PREVIEW_TEXTS.partenaireCard}</div>,
  RelationsTimelinePreview: () => <div>{PREVIEW_TEXTS.relationsTimeline}</div>,
}))

vi.mock('./previews/ForumPreviews', () => ({
  ForumPostListPreview: () => <div>{PREVIEW_TEXTS.forumPostList}</div>,
  ForumPostDetailPreview: () => <div>{PREVIEW_TEXTS.forumPostDetail}</div>,
  ForumStatsPreview: () => <div>{PREVIEW_TEXTS.forumStats}</div>,
}))

vi.mock('./previews/RapportsPreviews', () => ({
  RapportChartPreview: () => <div>{PREVIEW_TEXTS.rapportChart}</div>,
  RapportExportPreview: () => <div>{PREVIEW_TEXTS.rapportExport}</div>,
  RapportFiltersPreview: () => <div>{PREVIEW_TEXTS.rapportFilters}</div>,
}))

vi.mock('./previews/AnalyseGeographiquePreviews', () => ({
  MapPreview: () => <div>{PREVIEW_TEXTS.map}</div>,
  TableauGeoPreview: () => <div>{PREVIEW_TEXTS.tableauGeo}</div>,
  RegionDetailPreview: () => <div>{PREVIEW_TEXTS.regionDetail}</div>,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('TutorielLivePreview', () => {
  it('rend le vrai composant HeroMetrics pour dashboard/kpis avec ses valeurs métier et son libellé', () => {
    render(<TutorielLivePreview moduleId="dashboard" sectionId="kpis" />, { wrapper: createWrapper() })

    expect(screen.getByText('Composant réel')).toBeInTheDocument()
    expect(screen.getByTestId('hero-metrics')).toBeInTheDocument()
    expect(screen.getByText('KPIs Demo')).toBeInTheDocument()
    expect(screen.getByText('CA')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('Marge')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Vrai composant HeroMetrics avec 5 cartes KPI')).toBeInTheDocument()
  })

  it('rend la liste email réelle pour emails/boite-reception avec 3 threads et un seul thread new', () => {
    render(<TutorielLivePreview moduleId="emails" sectionId="boite-reception" />, { wrapper: createWrapper() })

    expect(screen.getByText('Vrai composant EmailListItemModern × 3')).toBeInTheDocument()

    const items = screen.getAllByTestId('email-item')
    expect(items).toHaveLength(3)

    expect(within(items[0]).getByText('demo-thread-1')).toBeInTheDocument()
    expect(within(items[0]).getByText('Sujet A')).toBeInTheDocument()
    expect(within(items[0]).getByText('new')).toBeInTheDocument()

    expect(within(items[1]).getByText('demo-thread-2')).toBeInTheDocument()
    expect(within(items[1]).getByText('Sujet B')).toBeInTheDocument()
    expect(within(items[1]).getByText('old')).toBeInTheDocument()

    expect(within(items[2]).getByText('demo-thread-3')).toBeInTheDocument()
    expect(within(items[2]).getByText('Sujet C')).toBeInTheDocument()
    expect(within(items[2]).getByText('old')).toBeInTheDocument()
  })

  it('rend la vraie fiche établissement pour crm/fiche-etablissement avec les données mockées', () => {
    render(<TutorielLivePreview moduleId="crm" sectionId="fiche-etablissement" />, { wrapper: createWrapper() })

    expect(screen.getByText('Vrai composant EnhancedEtablissementCard')).toBeInTheDocument()
    expect(screen.getByTestId('etablissement-card')).toBeInTheDocument()
    expect(screen.getByText('etab-1')).toBeInTheDocument()
    expect(screen.getByText('Clinique Demo')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('rend un preview mappé simple pour une section non réelle avec son label exact', () => {
    render(<TutorielLivePreview moduleId="prise-en-main" sectionId="navigation" />, { wrapper: createWrapper() })

    expect(screen.getByText(PREVIEW_TEXTS.dashboardActions)).toBeInTheDocument()
    expect(screen.getByText("Navigation dans l'application")).toBeInTheDocument()
    expect(screen.getByText('Composant réel')).toBeInTheDocument()
  })

  it('rend le fallback quand aucun mapping n’existe avec le titre fourni et le badge module/section', () => {
    render(
      <TutorielLivePreview
        moduleId="module-inconnu"
        sectionId="section-x"
        fallbackTitle="Titre de secours"
        fallbackIcon="ignored"
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('Titre de secours')).toBeInTheDocument()
    expect(screen.getByText('Aperçu en cours de développement')).toBeInTheDocument()
    expect(screen.getByText('module-inconnu/section-x')).toBeInTheDocument()
    expect(screen.queryByText('Composant réel')).not.toBeInTheDocument()
  })

  it('utilise sectionId comme titre de fallback quand fallbackTitle est absent', () => {
    render(<TutorielLivePreview moduleId="autre-module" sectionId="ma-section" />, { wrapper: createWrapper() })

    expect(screen.getByText('ma-section')).toBeInTheDocument()
    expect(screen.getByText('autre-module/ma-section')).toBeInTheDocument()
  })
})