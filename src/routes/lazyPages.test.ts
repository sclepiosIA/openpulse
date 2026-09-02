import React, { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { lazyWithRetry, makeLazyComponent } = vi.hoisted(() => {
  const makeLazyComponent = (name: string) => {
    const C: React.FC = () => React.createElement('div', { 'data-testid': `page:${name}` }, name)
    C.displayName = name
    return C
  }

  const lazyWithRetry = (factory: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    return React.lazy(factory)
  }

  return { lazyWithRetry, makeLazyComponent }
})

vi.mock('@/lib/lazyWithRetry', () => ({
  lazyWithRetry,
}))

vi.mock('@/pages/Auth', () => ({ default: makeLazyComponent('Auth') }))
vi.mock('@/pages/ResetPassword', () => ({ default: makeLazyComponent('ResetPassword') }))
vi.mock('@/pages/NotFound', () => ({ default: makeLazyComponent('NotFound') }))
vi.mock('@/pages/Dashboard', () => ({ default: makeLazyComponent('Dashboard') }))

vi.mock('@/pages/EnqueteSatisfactionSolution', () => ({ default: makeLazyComponent('EnqueteSatisfactionSolution') }))
vi.mock('@/pages/EtablissementDetail', () => ({ default: makeLazyComponent('EtablissementDetail') }))

vi.mock('@/pages/Equipe', () => ({ default: makeLazyComponent('Equipe') }))
vi.mock('@/pages/People', () => ({ default: makeLazyComponent('People') }))
vi.mock('@/pages/Parametres', () => ({ default: makeLazyComponent('Parametres') }))
vi.mock('@/pages/ParametresFeedbacks', () => ({ default: makeLazyComponent('ParametresFeedbacks') }))
vi.mock('@/pages/ParametresVisioconference', () => ({ default: makeLazyComponent('ParametresVisioconference') }))
vi.mock('@/pages/ParametresWebDAV', () => ({ default: makeLazyComponent('ParametresWebDAV') }))
vi.mock('@/pages/ParametresConfiguration', () => ({ default: makeLazyComponent('ParametresConfiguration') }))
vi.mock('@/pages/PortailClient', () => ({ default: makeLazyComponent('PortailClient') }))
vi.mock('@/pages/PortailClientTaches', () => ({ default: makeLazyComponent('PortailClientTaches') }))
vi.mock('@/pages/TemplatesTaches', () => ({ default: makeLazyComponent('TemplatesTaches') }))
vi.mock('@/pages/Profil', () => ({ default: makeLazyComponent('Profil') }))
vi.mock('@/pages/Prospects', () => ({ default: makeLazyComponent('Prospects') }))
vi.mock('@/pages/ProspectsScoring', () => ({ default: makeLazyComponent('ProspectsScoring') }))
vi.mock('@/pages/Etablissements', () => ({ default: makeLazyComponent('Etablissements') }))
vi.mock('@/components/forum/ForumModeration', () => ({
  ForumModeration: makeLazyComponent('ForumModeration'),
}))
vi.mock('@/pages/ForumPostDetail', () => ({ default: makeLazyComponent('ForumPostDetail') }))
vi.mock('@/pages/Rapports', () => ({ default: makeLazyComponent('Rapports') }))
vi.mock('@/pages/RapportsBuilderList', () => ({ default: makeLazyComponent('RapportsBuilderList') }))
vi.mock('@/pages/RapportBuilderView', () => ({ default: makeLazyComponent('RapportBuilderView') }))
vi.mock('@/pages/RapportBuilderEdit', () => ({ default: makeLazyComponent('RapportBuilderEdit') }))
vi.mock('@/pages/Calendrier', () => ({ default: makeLazyComponent('Calendrier') }))
vi.mock('@/pages/Gantt', () => ({ default: makeLazyComponent('Gantt') }))
vi.mock('@/pages/AnalyseGeographique', () => ({ default: makeLazyComponent('AnalyseGeographique') }))
vi.mock('@/pages/Projets', () => ({ default: makeLazyComponent('Projets') }))
vi.mock('@/pages/Deploiement', () => ({ default: makeLazyComponent('Deploiement') }))
vi.mock('@/pages/Production', () => ({ default: makeLazyComponent('Production') }))
vi.mock('@/pages/RD', () => ({ default: makeLazyComponent('RD') }))
vi.mock('@/pages/Support', () => ({ default: makeLazyComponent('Support') }))
vi.mock('@/pages/ImportCommercialData', () => ({ default: makeLazyComponent('ImportCommercialData') }))
vi.mock('@/pages/Forecasting', () => ({ default: makeLazyComponent('Forecasting') }))
vi.mock('@/pages/AttributionV2', () => ({ default: makeLazyComponent('AttributionV2') }))
vi.mock('@/pages/Automatisations', () => ({ default: makeLazyComponent('Automatisations') }))
vi.mock('@/pages/AutomatisationBuilder', () => ({ default: makeLazyComponent('AutomatisationBuilder') }))
vi.mock('@/pages/AutomationsHealth', () => ({ default: makeLazyComponent('AutomationsHealth') }))
vi.mock('@/pages/AutomationsRunsExplorer', () => ({ default: makeLazyComponent('AutomationsRunsExplorer') }))
vi.mock('@/pages/AutomationsWebhooksAndAlerts', () => ({ default: makeLazyComponent('AutomationsWebhooksAndAlerts') }))
vi.mock('@/pages/Appels', () => ({ default: makeLazyComponent('Appels') }))
vi.mock('@/pages/ActivityFeed', () => ({ default: makeLazyComponent('ActivityFeed') }))

vi.mock('@/pages/ChurnPredictor', () => ({ default: makeLazyComponent('ChurnPredictor') }))
vi.mock('@/pages/PlaybooksCsm', () => ({ default: makeLazyComponent('PlaybooksCsm') }))

vi.mock('@/pages/GestionUtilisateurs', () => ({ default: makeLazyComponent('GestionUtilisateurs') }))
vi.mock('@/pages/ConfigurationSysteme', () => ({ default: makeLazyComponent('ConfigurationSysteme') }))
vi.mock('@/pages/GestionSecurite', () => ({ default: makeLazyComponent('GestionSecurite') }))
vi.mock('@/pages/GestionBaseDonnees', () => ({ default: makeLazyComponent('GestionBaseDonnees') }))
vi.mock('@/pages/GestionNotifications', () => ({ default: makeLazyComponent('GestionNotifications') }))
vi.mock('@/pages/CentreNotifications', () => ({ default: makeLazyComponent('CentreNotifications') }))
vi.mock('@/pages/LogsSysteme', () => ({ default: makeLazyComponent('LogsSysteme') }))
vi.mock('@/pages/HealthCheck', () => ({ default: makeLazyComponent('HealthCheck') }))
vi.mock('@/pages/SafeShell', () => ({ default: makeLazyComponent('SafeShell') }))
vi.mock('@/pages/MarqueMonitor', () => ({ default: makeLazyComponent('MarqueMonitor') }))

vi.mock('@/pages/Emails', () => ({ default: makeLazyComponent('Emails') }))
vi.mock('@/pages/EmailTemplates', () => ({ default: makeLazyComponent('EmailTemplates') }))
vi.mock('@/pages/EmailAnalytics', () => ({ default: makeLazyComponent('EmailAnalytics') }))
vi.mock('@/pages/EmailClassificationAnalytics', () => ({ default: makeLazyComponent('EmailClassificationAnalytics') }))
vi.mock('@/pages/GestionEmailDomains', () => ({ default: makeLazyComponent('GestionEmailDomains') }))

vi.mock('@/pages/Groupes', () => ({ default: makeLazyComponent('Groupes') }))
vi.mock('@/pages/GroupeDetail', () => ({ default: makeLazyComponent('GroupeDetail') }))
vi.mock('@/pages/Partenaires', () => ({ default: makeLazyComponent('Partenaires') }))
vi.mock('@/pages/PartenaireDetail', () => ({ default: makeLazyComponent('PartenaireDetail') }))

vi.mock('@/pages/Tresorerie', () => ({ default: makeLazyComponent('Tresorerie') }))
vi.mock('@/pages/Facturation', () => ({ default: makeLazyComponent('Facturation') }))
vi.mock('@/pages/Contrats', () => ({ default: makeLazyComponent('Contrats') }))
vi.mock('@/pages/ContratDetail', () => ({ default: makeLazyComponent('ContratDetail') }))
vi.mock('@/pages/ContractBuilder', () => ({ default: makeLazyComponent('ContractBuilder') }))
vi.mock('@/pages/CatalogueProduits', () => ({ default: makeLazyComponent('CatalogueProduits') }))

vi.mock('@/pages/Recrutement', () => ({ default: makeLazyComponent('Recrutement') }))
vi.mock('@/pages/Competences', () => ({ default: makeLazyComponent('Competences') }))

vi.mock('@/pages/LiveChat', () => ({ default: makeLazyComponent('LiveChat') }))
vi.mock('@/pages/Pulse', () => ({ default: makeLazyComponent('Pulse') }))
vi.mock('@/pages/Visio', () => ({ default: makeLazyComponent('Visio') }))
vi.mock('@/pages/MeetingNotes', () => ({ default: makeLazyComponent('MeetingNotes') }))
vi.mock('@/pages/Forms', () => ({ default: makeLazyComponent('Forms') }))
vi.mock('@/pages/FormBuilder', () => ({ default: makeLazyComponent('FormBuilder') }))
vi.mock('@/pages/FormPublic', () => ({ default: makeLazyComponent('FormPublic') }))
vi.mock('@/pages/PublicLinkPlaceholder', () => ({ default: makeLazyComponent('PublicLinkPlaceholder') }))
vi.mock('@/pages/FormResponses', () => ({ default: makeLazyComponent('FormResponses') }))
vi.mock('@/pages/Tutoriels', () => ({ default: makeLazyComponent('Tutoriels') }))
vi.mock('@/pages/TutorielModule', () => ({ default: makeLazyComponent('TutorielModule') }))
vi.mock('@/pages/BackendViewer', () => ({ default: makeLazyComponent('BackendViewer') }))
vi.mock('@/pages/SimulateurROI', () => ({ default: makeLazyComponent('SimulateurROI') }))
vi.mock('@/pages/Todos', () => ({ default: makeLazyComponent('Todos') }))
vi.mock('@/pages/Documents', () => ({ default: makeLazyComponent('Documents') }))
vi.mock('@/pages/AIUsageDashboard', () => ({ default: makeLazyComponent('AIUsageDashboard') }))
vi.mock('@/pages/Booking', () => ({ default: makeLazyComponent('Booking') }))
vi.mock('@/pages/PublicBooking', () => ({ default: makeLazyComponent('PublicBooking') }))
vi.mock('@/pages/Rgpd', () => ({ default: makeLazyComponent('Rgpd') }))
vi.mock('@/pages/DpoExemple', () => ({ default: makeLazyComponent('DpoExemple') }))
vi.mock('@/pages/MentionsLegales', () => ({ default: makeLazyComponent('MentionsLegales') }))
vi.mock('@/pages/PolitiqueConfidentialite', () => ({ default: makeLazyComponent('PolitiqueConfidentialite') }))
vi.mock('@/pages/PublicTransfer', () => ({ default: makeLazyComponent('PublicTransfer') }))
vi.mock('@/pages/ApiDeveloper', () => ({ default: makeLazyComponent('ApiDeveloper') }))

vi.mock('@/pages/SocialDashboard', () => ({ default: makeLazyComponent('SocialDashboard') }))
vi.mock('@/pages/ParametresSocial', () => ({ default: makeLazyComponent('ParametresSocial') }))
vi.mock('@/pages/SocialComposer', () => ({ default: makeLazyComponent('SocialComposer') }))
vi.mock('@/pages/SocialCalendar', () => ({ default: makeLazyComponent('SocialCalendar') }))
vi.mock('@/pages/SocialInbox', () => ({ default: makeLazyComponent('SocialInbox') }))

vi.mock('@/pages/mobile/MobileMailApp', () => ({ default: makeLazyComponent('MobileMailApp') }))
vi.mock('@/pages/mobile/MobileTodosApp', () => ({ default: makeLazyComponent('MobileTodosApp') }))
vi.mock('@/pages/mobile/MobilePulseApp', () => ({ default: makeLazyComponent('MobilePulseApp') }))
vi.mock('@/pages/mobile/MobileCalendarApp', () => ({ default: makeLazyComponent('MobileCalendarApp') }))
vi.mock('@/pages/mobile/MobileDocumentsApp', () => ({ default: makeLazyComponent('MobileDocumentsApp') }))
vi.mock('@/pages/mobile/MobileBookingApp', () => ({ default: makeLazyComponent('MobileBookingApp') }))
vi.mock('@/pages/mobile/MobileJarvisApp', () => ({ default: makeLazyComponent('MobileJarvisApp') }))
vi.mock('@/pages/mobile/MobileAppsInstall', () => ({ default: makeLazyComponent('MobileAppsInstall') }))
vi.mock('@/pages/mobile/MobileAppInstallPage', () => ({ default: makeLazyComponent('MobileAppInstallPage') }))

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const Providers: React.FC<React.PropsWithChildren> = ({ children }) => {
  const qc = createQueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('lazyPages.ts', () => {
  it('exports eager pages and they render', async () => {
    const mod = await import('./lazyPages')

    render(
      React.createElement(
        Providers,
        {},
        React.createElement(mod.Auth, {}),
      ),
    )
    expect(await screen.findByTestId('page:Auth')).toBeTruthy()

    render(
      React.createElement(
        Providers,
        {},
        React.createElement(mod.ResetPassword, {}),
      ),
    )
    expect(await screen.findByTestId('page:ResetPassword')).toBeTruthy()

    render(
      React.createElement(
        Providers,
        {},
        React.createElement(mod.NotFound, {}),
      ),
    )
    expect(await screen.findByTestId('page:NotFound')).toBeTruthy()

    render(
      React.createElement(
        Providers,
        {},
        React.createElement(mod.Dashboard, {}),
      ),
    )
    expect(await screen.findByTestId('page:Dashboard')).toBeTruthy()
  })

  it('lazy export loads: shows fallback then resolves to page component', async () => {
    const mod = await import('./lazyPages')

    render(
      React.createElement(
        Providers,
        {},
        React.createElement(
          Suspense,
          { fallback: React.createElement('div', { 'data-testid': 'fallback' }, 'loading') },
          React.createElement(mod.EtablissementDetail, {}),
        ),
      ),
    )

    expect(screen.getByTestId('fallback')).toBeTruthy()
    expect(await screen.findByTestId('page:EtablissementDetail')).toBeTruthy()
  })

  it('lazy export supports .then mapping (ForumModeration)', async () => {
    const mod = await import('./lazyPages')

    render(
      React.createElement(
        Providers,
        {},
        React.createElement(
          Suspense,
          { fallback: React.createElement('div', { 'data-testid': 'fallback' }, 'loading') },
          React.createElement(mod.ForumModeration, {}),
        ),
      ),
    )

    expect(screen.getByTestId('fallback')).toBeTruthy()
    expect(await screen.findByTestId('page:ForumModeration')).toBeTruthy()
  })
})