import { Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'

// Petit redirect helper pour /automatisations/:id → /automatisations/:id/edit (BUG-042)
function AutomatisationsIdRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/automatisations/${id}/edit`} replace />
}

// /support/:id → /support?ticket=:id (Support sélectionne via state interne) — BUG-045
function SupportTicketRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/support?ticket=${id ?? ''}`} replace />
}

// /pipeline/contrats → vue contrats selon rôle. /contrats étant direction-only
// (héritage finance), les commerciaux doivent être renvoyés vers /prospects
// (leur vue pipeline). Audit v3-azure 2026-05-29 — commercial /pipeline/contrats
// tombait en AccessDenied via /contrats malgré la route déclarée allowed.
function PipelineContratsRedirect() {
  const { role, isLoading } = useUserRoleHook()
  if (isLoading) return <FullPageLoader />
  if (role === 'commercial') return <Navigate to="/prospects" replace />
  return <Navigate to="/contrats" replace />
}
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RouteGuard } from '@/components/security/RouteGuard'
import { useUserRole as useUserRoleHook } from '@/hooks/shared/useUserRole'
import {
  Dashboard,
  DirectionDashboard,
  NotFound,
  // Seule page rescapee du groupe Formations retire : la route /enquetes
  // vivait dans FormationsRoutes alors que le socle des enquetes reste.
  EnquetesDashboard,
  // Lazy pages
  Pulse,
  Prospects,
  Etablissements,
  EtablissementDetail,
  Deploiement,
  Production,
  Projets,
  People,
  Rapports,
  RapportsBuilderList,
  RapportBuilderView,
  RapportBuilderEdit,
  Calendrier,
  CalendrierEditorial,
  MarketingStatistiques,
  Gantt,
  RD,
  Support,
  AnalyseGeographique,
  Parametres,
  ParametresFeedbacks,
  ParametresVisioconference,
  ParametresWebDAV,
  ParametresConfiguration,
  PortailClient,
  PortailClientTaches,
  TemplatesTaches,
  AIUsageDashboard,
  Profil,
  GestionUtilisateurs,
  ConfigurationSysteme,
  GestionBaseDonnees,
  GestionSecurite,
  LogsSysteme,
  GestionNotifications,
  CentreNotifications,
  MarqueMonitor,
  Emails,
  EmailTemplates,
  EmailAnalytics,
  EmailClassificationAnalytics,
  GestionEmailDomains,
  Groupes,
  GroupeDetail,
  Partenaires,
  PartenaireDetail,
  ForumModeration,
  ForumPostDetail,
  Tresorerie,
  Facturation,
  Contrats,
  ContratDetail,
  ContractBuilder,
  LiveChat,
  Recrutement,
  Competences,
  Booking,
  Rgpd,
  ApiDeveloper,
  Tutoriels,
  TutorielModule,
  Todos,
  Documents,
  BackendViewer,
  SimulateurROI,
  Visio,
  HealthCheck,
  SafeShell,
  MeetingNotes,
  Forms,
  FormBuilder,
  FormResponses,
  ImportCommercialData,
  Forecasting,
  AttributionV2,
  Automatisations,
  AutomatisationBuilder,
  AutomationsHealth,
  AutomationsRunsExplorer,
  AutomationsWebhooksAndAlerts,
  Appels,
  CatalogueProduits,
  ProspectsScoring,
  ActivityFeed,
  ChurnPredictor,
  PlaybooksCsm,
  SocialDashboard,
  ParametresSocial,
  SocialComposer,
  SocialCalendar,
  SocialInbox,
  // Mobile
  MobileMailApp,
  MobileTodosApp,
  MobilePulseApp,
  MobileCalendarApp,
  MobileDocumentsApp,
  MobileBookingApp,
  MobileJarvisApp,
  MobileAppsInstall,
  DpoExemple,
} from './lazyPages'
import { AdminRoutes } from './groups/AdminRoutes'
import { MobileRoutes } from './groups/MobileRoutes'
import { FinanceRoutes } from './groups/FinanceRoutes'
import { CrmRoutes } from './groups/CrmRoutes'
import { EmailRoutes } from './groups/EmailRoutes'
import { ReportingRoutes } from './groups/ReportingRoutes'
import { DiversRoutes } from './groups/DiversRoutes'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

export function AuthenticatedRoutes() {
  return (
    <Routes>
      {/* System */}
      <Route path="/__health" element={<HealthCheck />} />
      <Route path="/__safe" element={<SafeShell />} />

      {/* Dashboard */}
      <Route
        path="/"
        element={
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        }
      />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      {/* Audit e2e 2026-06-03 run-1780468208 — /clients, /commercial, /direction
          revenaient en 404 (entrées présentes dans des inventaires externes).
          On rend le composant cible directement pour conserver l'URL historique
          sans redirection silencieuse (fix run-1781266648).
          Audit run-1781450868 (juin 2026) — /direction doit être réservé à
          l'équipe direction (admin bypass) et afficher une vue Direction
          clairement distincte du Dashboard générique. */}
      <Route
        path="/clients"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <Etablissements />
          </RouteGuard>
        }
      />
      <Route
        path="/commercial"
        element={
          <RouteGuard
            requiredPermission={['canViewProspects', 'canViewPipeline']}
            disallowedRoles={['rh', 'marketing']}
          >
            <Prospects />
          </RouteGuard>
        }
      />
      {/* Audit run-1781629748 (juin 2026) — copil partage team='direction'
          mais ne doit PAS accéder à /direction (lecture seule transverse via
          sa whitelist). On exclut explicitement le rôle copil. */}
      <Route
        path="/direction"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['copil']}>
            <DirectionDashboard />
          </RouteGuard>
        }
      />
      <Route
        path="/pulse"
        element={
          <S>
            <Pulse />
          </S>
        }
      />
      <Route
        path="/activite"
        element={
          <S>
            <ActivityFeed />
          </S>
        }
      />

      {/* CRM — extrait dans groups/CrmRoutes.tsx (DEBT-02 session 37) */}
      {CrmRoutes()}

      {/* People / RH */}
      <Route
        path="/people"
        element={
          <RouteGuard allowedTeams={['direction']}>
            <S>
              <People />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/equipe"
        element={
          <RouteGuard allowedTeams={['direction']}>
            <S>
              <People />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/rh"
        element={
          <RouteGuard allowedTeams={['direction']}>
            <S>
              <People />
            </S>
          </RouteGuard>
        }
      />
      {/* /people/:id n'est pas une vraie route détail — redirige pour éviter un 404 (BUG-044) */}
      <Route path="/people/:id" element={<Navigate to="/people" replace />} />
      {/* Alias RBAC : /rh/paie → onglet paie de People, réservé direction (hors RH).
          Décision produit confirmée (audit v3-azure 2026-05-22-crm-full-v311 §3) :
          la paie est portée par la direction, le rôle `rh` gère le périmètre People
          (recrutement, compétences, formations) mais PAS la paie. Aucun item de
          sidebar ne pointe vers /rh/paie pour ce rôle (cf. navigationConfig.ts).
          Si le besoin métier évolue, basculer cette route vers `allowedRoles=['rh']`
          ET ajouter un item sidebar — pas l'inverse. */}
      <Route
        path="/rh/paie"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh']}>
            {/* L'onglet cible est `salaires` : aucun onglet `paie` n'existe dans
                PEOPLE_TABS (People.tsx). Avec `tab=paie`, People ne trouvait pas
                l'onglet et retombait silencieusement sur le premier disponible
                (`analyses`) — l'alias ne menait donc jamais à la paie. */}
            <Navigate to="/people?tab=salaires" replace />
          </RouteGuard>
        }
      />
      {/* Alias RBAC : /admin → strict admin only (exclut direction héritée),
          car /parametres expose des secrets (clés API). Audit run-1781711522. */}
      <Route
        path="/admin"
        element={
          <RouteGuard strictAdminOnly>
            <Navigate to="/parametres" replace />
          </RouteGuard>
        }
      />
      {/* Alias : /etablissement (singulier) → /etablissements (évite 404). Audit run-1781711522. */}
      <Route path="/etablissement" element={<Navigate to="/etablissements" replace />} />
      {/* Alias RBAC : /pipeline/contrats — la page /contrats elle-même est
          direction-only (héritage finance, cf. ligne plus bas). On route donc
          chaque rôle vers sa vue contrats accessible :
          - direction (et copil hérité) → /contrats (vue financière complète)
          - commercial → /prospects (vue pipeline commercial, contrats en cours)
          Audit v3-azure 2026-05-29 : commercial recevait un AccessDenied car
          /pipeline/contrats redirige aveuglément vers /contrats. */}
      <Route
        path="/pipeline/contrats"
        element={
          <RouteGuard allowedTeams={['direction', 'commercial']} disallowedRoles={['rh']}>
            <PipelineContratsRedirect />
          </RouteGuard>
        }
      />
      {/* /recrutement & /competences : on s'appuie uniquement sur la permission
          (canViewAllTeamMembers). Le double gate allowedTeams=['direction'] bloquait
          à tort chef_projet (a la permission mais pas la team). Audit
          v3-azure-20260515T214428Z — static guard bug. */}
      <Route
        path="/recrutement"
        element={
          <RouteGuard requiredPermission="canViewAllTeamMembers">
            <S>
              <Recrutement />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/competences"
        element={
          <RouteGuard requiredPermission="canViewAllTeamMembers">
            <S>
              <Competences />
            </S>
          </RouteGuard>
        }
      />

      {/* Reporting + Planning — extrait dans groups/ReportingRoutes.tsx (DEBT-02 session 37) */}
      {ReportingRoutes()}

      {/* Support */}
      {/* /support : aligné avec la sidebar (navigationConfig.ts) qui expose
          Support à direction+technique+csm. Le RouteGuard limitait à
          direction+technique → fuite UX côté CSM (item sidebar visible mais
          accès refusé). Audit v3-azure-20260515T214428Z #13. */}
      <Route
        path="/support"
        element={
          <RouteGuard
            requiredPermission={['canViewAllTickets', 'canViewOwnTickets', 'canManageTickets']}
            allowedTeams={['direction', 'technique', 'csm']}
            disallowedRoles={['rh']}
          >
            <S>
              <Support />
            </S>
          </RouteGuard>
        }
      />
      {/* /support/:id : Support gère la sélection de ticket via state interne — redirige vers /support?ticket=:id (BUG-045) */}
      <Route path="/support/:id" element={<SupportTicketRedirect />} />
      {/* Email — extrait dans groups/EmailRoutes.tsx (DEBT-02 session 37) */}
      {EmailRoutes()}

      {/* Enquetes — seule route rescapee du groupe Formations retire. */}
      <Route path="/enquetes" element={<S><EnquetesDashboard /></S>} />

      {/* /utilisateurs en authentifié = page admin de gestion des comptes (alias de /gestion-utilisateurs).
          Rendu directement sous garde stricte pour bloquer les rôles non-admin (commercial, rh, etc.)
          et afficher Accès refusé. La version publique d'émargement reste exposée via PublicRoutes. */}
      <Route
        path="/utilisateurs"
        element={
          <RouteGuard strictAdminOnly>
            <S>
              <GestionUtilisateurs />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/dpo-exemple"
        element={
          <S>
            <DpoExemple />
          </S>
        }
      />


      {/* Forum */}
      <Route
        path="/forum-moderation"
        element={
          <ProtectedRoute>
            <S>
              <ForumModeration />
            </S>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forum/post/:postId"
        element={
          <ProtectedRoute>
            <S>
              <ForumPostDetail />
            </S>
          </ProtectedRoute>
        }
      />

      {/* Finance / Commerce / Social / Automatisations — extrait dans groups/FinanceRoutes.tsx (DEBT-02 session 35) */}
      {FinanceRoutes()}

      {/* Live Chat client */}
      <Route
        path="/live-chat"
        element={
          <ProtectedRoute>
            <S>
              <LiveChat />
            </S>
          </ProtectedRoute>
        }
      />

      {/* Téléphonie / CTI */}
      <Route
        path="/appels"
        element={
          <RouteGuard
            allowedTeams={['direction', 'commercial', 'csm', 'technique']}
            disallowedRoles={['rh']}
          >
            <S>
              <Appels />
            </S>
          </RouteGuard>
        }
      />

      {/* Administration — extrait dans groups/AdminRoutes.tsx (DEBT-02 session 34) */}
      {AdminRoutes()}

      {/* Divers — extrait dans groups/DiversRoutes.tsx (DEBT-02 session 37) */}
      {DiversRoutes()}

      {/* Auth redirect */}
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      {/* Alias legacy /login → /auth (audit 2026-05-25 — route inventoriée
          `Route("/login", alias_of="/auth")` mais 404 observé sur RH). */}
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      {/* Alias legacy /user/login (audit run-max-20260620 — 404 en session
          connectée). Redirige vers dashboard pour session connectée. */}
      <Route path="/user/login" element={<Navigate to="/dashboard" replace />} />
      {/* Alias legacy /tresorerie/facturation/contrats — la page contrats
          unifiée vit sur /contrats. On garde le guard canViewTresorerie
          pour bloquer l'accès direct au sous-chemin trésorerie (audit
          fullrun-0621-2355 : Direction sans canViewTresorerie bypassait). */}
      <Route
        path="/tresorerie/facturation/contrats"
        element={
          <RouteGuard
            requiredPermission="canViewTresorerie"
            allowedTeams={['direction']}
            disallowedRoles={['rh']}
          >
            <Navigate to="/contrats" replace />
          </RouteGuard>
        }
      />
      {/* Alias legacy /booking → /prise-rdv (audit 2026-05-25 — route inventoriée
          comme générale, 404 observé sur RH). La version publique /rdv/:slug
          reste exposée via PublicRoutes. */}
      <Route path="/booking" element={<Navigate to="/prise-rdv" replace />} />
      {/* Alias legacy /pipeline → /prospects (audit 2026-05-25 — route inventoriée
          allowed pour admin/commercial/direction/csm. 404 observé pour chef_projet
          et rh devient Accès refusé contextualisé ici (et plus côté NotFound). */}
      <Route
        path="/pipeline"
        element={
          <RouteGuard
            requiredPermission="canViewPipeline"
            allowedTeams={['direction', 'commercial']}
            disallowedRoles={['rh', 'marketing']}
          >
            <Navigate to="/prospects" replace />
          </RouteGuard>
        }
      />

      <Route
        path="/marketing/calendrier-editorial"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FullPageLoader />}>
              <ErrorBoundary>
                <CalendrierEditorial />
              </ErrorBoundary>
            </Suspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/marketing/statistiques"
        element={
          <ProtectedRoute>
            <Suspense fallback={<FullPageLoader />}>
              <ErrorBoundary>
                <MarketingStatistiques />
              </ErrorBoundary>
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Mobile Apps — extrait dans groups/MobileRoutes.tsx (DEBT-02 session 35) */}
      {MobileRoutes()}

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
