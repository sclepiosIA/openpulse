import { Suspense } from 'react'
import { Route } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RouteGuard } from '@/components/security/RouteGuard'
import {
  Rapports,
  RapportsBuilderList,
  RapportBuilderView,
  RapportBuilderEdit,
  BIStudio,
  TempsTracking,
  ITAssets,
  Comptabilite,
  Calendrier,
  Gantt,
  RD,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

/**
 * Routes Reporting + Planning (rapports, rapports-custom, calendrier, gantt, R&D) —
 * extraites de AuthenticatedRoutes (DEBT-02 session 37).
 */
export function ReportingRoutes() {
  return (
    <>
      <Route
        path="/rapports"
        element={
          <S>
            <Rapports />
          </S>
        }
      />
      <Route
        path="/rapports-custom"
        element={
          <S>
            <RapportsBuilderList />
          </S>
        }
      />
      <Route
        path="/rapports-custom/:id"
        element={
          <S>
            <RapportBuilderView />
          </S>
        }
      />
      <Route
        path="/rapports-custom/:id/edit"
        element={
          <S>
            <RapportBuilderEdit />
          </S>
        }
      />
      <Route
        path="/bi"
        element={
          <RouteGuard allowedTeams={['direction']}>
            <S>
              <BIStudio />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/temps"
        element={
          <S>
            <TempsTracking />
          </S>
        }
      />
      <Route
        path="/it"
        element={
          <S>
            <ITAssets />
          </S>
        }
      />
      <Route
        path="/comptabilite"
        element={
          <RouteGuard allowedTeams={['direction']}>
            <S>
              <Comptabilite />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/calendrier"
        element={
          <S>
            <Calendrier />
          </S>
        }
      />
      <Route
        path="/gantt"
        element={
          <RouteGuard disallowedRoles={['rh']}>
            <S>
              <Gantt />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/rd"
        element={
          <RouteGuard
            requiredPermission="canViewRD"
            allowedTeams={['direction', 'technique']}
            disallowedRoles={['rh']}
          >
            <S>
              <RD />
            </S>
          </RouteGuard>
        }
      />
    </>
  )
}
