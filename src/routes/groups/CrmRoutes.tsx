import { Suspense } from 'react'
import { Route } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RouteGuard } from '@/components/security/RouteGuard'
import {
  Prospects,
  ProspectsScoring,
  ApporteursAffaires,
  Etablissements,
  EtablissementDetail,
  Deploiement,
  Production,
  Projets,
  Groupes,
  GroupeDetail,
  Partenaires,
  PartenaireDetail,
  AnalyseGeographique,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

/**
 * Routes CRM — extraites de AuthenticatedRoutes (DEBT-02 session 37).
 */
export function CrmRoutes() {
  return (
    <>
      <Route
        path="/prospects"
        element={
          <RouteGuard
            requiredPermission={['canViewProspects', 'canViewPipeline']}
            disallowedRoles={['rh', 'marketing']}
          >
            <S>
              <Prospects />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/prospects/scoring"
        element={
          <RouteGuard
            allowedTeams={['direction', 'commercial']}
            disallowedRoles={['rh', 'marketing']}
          >
            <S>
              <ProspectsScoring />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/apporteurs-affaires"
        element={
          <RouteGuard
            allowedTeams={['direction', 'commercial']}
            disallowedRoles={['rh', 'marketing']}
          >
            <S>
              <ApporteursAffaires />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/etablissements"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <Etablissements />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/etablissements/:id"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <EtablissementDetail />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/deploiement"
        element={
          <RouteGuard disallowedRoles={['rh', 'marketing']}>
            <S>
              <Deploiement />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/production"
        element={
          <RouteGuard disallowedRoles={['rh', 'marketing']}>
            <S>
              <Production />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/projets"
        element={
          <RouteGuard disallowedRoles={['rh', 'marketing']}>
            <S>
              <Projets />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/groupes"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <Groupes />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/groupes/:id"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <GroupeDetail />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/partenaires"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <Partenaires />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/partenaires/:id"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <PartenaireDetail />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/analyse-geographique"
        element={
          <RouteGuard disallowedRoles={['marketing']}>
            <S>
              <AnalyseGeographique />
            </S>
          </RouteGuard>
        }
      />
    </>
  )
}
