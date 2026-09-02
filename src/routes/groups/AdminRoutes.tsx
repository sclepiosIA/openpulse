import { Suspense } from 'react'
import { Route } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RouteGuard } from '@/components/security/RouteGuard'
import {
  Parametres,
  ParametresFeedbacks,
  ParametresVisioconference,
  ParametresWebDAV,
  ParametresConfiguration,
  ParametresPlatformApi,
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
  Rgpd,
  ApiDeveloper,
  ImportCommercialData,
  MobileAppsInstall,
  AdminSatisfaction,
  AdminSatisfactionCampagnes,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

/**
 * Routes Administration — extraites de AuthenticatedRoutes pour réduire la taille
 * du god-file (DEBT-02, session 34). React Router v6 supporte les composants
 * retournant un fragment de <Route> en enfant direct de <Routes>.
 */
export function AdminRoutes() {
  return (
    <>
      <Route path="/parametres" element={<S><Parametres /></S>} />
      <Route
        path="/parametres/feedbacks"
        element={<RouteGuard adminOnly><S><ParametresFeedbacks /></S></RouteGuard>}
      />
      <Route path="/parametres/visioconference" element={<S><ParametresVisioconference /></S>} />
      <Route path="/parametres/webdav" element={<S><ParametresWebDAV /></S>} />
      <Route
        path="/parametres/templates-taches"
        element={<RouteGuard adminOnly><S><TemplatesTaches /></S></RouteGuard>}
      />
      <Route
        path="/parametres/ia-usage"
        element={<RouteGuard adminOnly><S><AIUsageDashboard /></S></RouteGuard>}
      />
      <Route
        path="/parametres/configuration"
        element={<RouteGuard strictAdminOnly><S><ParametresConfiguration /></S></RouteGuard>}
      />
      <Route
        path="/parametres/platform-api"
        element={<RouteGuard strictAdminOnly><S><ParametresPlatformApi /></S></RouteGuard>}
      />
      <Route
        path="/parametres/portail-client"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh']}>
            <S><PortailClient /></S>
          </RouteGuard>
        }
      />
      <Route
        path="/parametres/portail-client/:etablissementId/taches"
        element={<S><PortailClientTaches /></S>}
      />
      <Route path="/profil" element={<S><Profil /></S>} />
      <Route
        path="/gestion-utilisateurs"
        element={<RouteGuard strictAdminOnly><S><GestionUtilisateurs /></S></RouteGuard>}
      />
      <Route
        path="/configuration-systeme"
        element={<RouteGuard strictAdminOnly><S><ConfigurationSysteme /></S></RouteGuard>}
      />
      <Route
        path="/gestion-base-donnees"
        element={<RouteGuard strictAdminOnly><S><GestionBaseDonnees /></S></RouteGuard>}
      />
      {/* Outil install PWA mobile (séparé) */}
      <Route
        path="/mobile-install"
        element={
          <RouteGuard adminOnly disallowedRoles={['rh']}>
            <S><MobileAppsInstall /></S>
          </RouteGuard>
        }
      />

      <Route
        path="/gestion-securite"
        element={<RouteGuard strictAdminOnly><S><GestionSecurite /></S></RouteGuard>}
      />
      <Route
        path="/logs-systeme"
        element={<RouteGuard strictAdminOnly><S><LogsSysteme /></S></RouteGuard>}
      />
      <Route
        path="/parametres/monitor"
        element={<RouteGuard strictAdminOnly><S><MarqueMonitor /></S></RouteGuard>}
      />
      <Route
        path="/gestion-notifications"
        element={<RouteGuard strictAdminOnly><S><GestionNotifications /></S></RouteGuard>}
      />
      <Route path="/notifications" element={<S><CentreNotifications /></S>} />
      <Route
        path="/rgpd"
        element={<RouteGuard strictAdminOnly><S><Rgpd /></S></RouteGuard>}
      />
      <Route
        path="/api-developer"
        element={<RouteGuard strictAdminOnly><S><ApiDeveloper /></S></RouteGuard>}
      />
      <Route
        path="/import-commercial"
        element={<RouteGuard strictAdminOnly><S><ImportCommercialData /></S></RouteGuard>}
      />
      <Route
        path="/admin/satisfaction"
        element={<RouteGuard adminOnly><S><AdminSatisfaction /></S></RouteGuard>}
      />
      <Route
        path="/admin/satisfaction/campagnes"
        element={<RouteGuard adminOnly><S><AdminSatisfactionCampagnes /></S></RouteGuard>}
      />
    </>
  )
}
