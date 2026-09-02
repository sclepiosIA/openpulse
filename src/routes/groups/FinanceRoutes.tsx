import { Suspense } from 'react'
import { Route, Navigate, useParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RouteGuard } from '@/components/security/RouteGuard'
import {
  Finances,
  Tresorerie,
  Facturation,
  Contrats,
  ContratDetail,
  CatalogueProduits,
  Forecasting,
  AttributionV2,
  ChurnPredictor,
  PlaybooksCsm,
  SocialDashboard,
  ParametresSocial,
  SocialComposer,
  SocialCalendar,
  SocialInbox,
  Automatisations,
  AutomationsHealth,
  AutomationsRunsExplorer,
  AutomationsWebhooksAndAlerts,
  AutomatisationBuilder,
  ContractBuilder,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

// /automatisations/:id (sans /edit) → builder (BUG-042)
function AutomatisationsIdRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/automatisations/${id}/edit`} replace />
}

/**
 * Routes Finance + Commerce (Trésorerie, Facturation, Contrats, Catalogue,
 * Forecasting, Attribution, Churn, CSM, Social, Automatisations) —
 * extraites de AuthenticatedRoutes (DEBT-02 session 35).
 */
export function FinanceRoutes() {
  return (
    <>
      <Route
        path="/finances"
        element={
          <RouteGuard
            requiredPermission="canViewTresorerie"
            allowedTeams={['direction']}
            disallowedRoles={['rh']}
          >
            <S>
              <Finances />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/tresorerie"
        element={
          <RouteGuard
            requiredPermission="canViewTresorerie"
            allowedTeams={['direction']}
            disallowedRoles={['rh']}
          >
            <S>
              <Tresorerie />
            </S>
          </RouteGuard>
        }
      />
      {/* Alias historique : /cfo → dashboard financier consolidé (Trésorerie) */}
      <Route path="/cfo" element={<Navigate to="/tresorerie" replace />} />
      <Route
        path="/facturation"
        element={
          <RouteGuard
            requiredPermission="canViewTresorerie"
            allowedTeams={['direction']}
            disallowedRoles={['rh']}
          >
            <S>
              <Facturation />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/contrats"
        element={
          <RouteGuard disallowedRoles={['rh', 'commercial', 'csm', 'chef_projet', 'marketing']}>
            <S>
              <Contrats />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/contrats/:id"
        element={
          <RouteGuard disallowedRoles={['rh', 'csm', 'chef_projet', 'marketing']}>
            <S>
              <ContratDetail />
            </S>
          </RouteGuard>
        }
      />

      <Route
        path="/catalogue-produits"
        element={
          <RouteGuard
            allowedTeams={['direction', 'commercial']}
            disallowedRoles={['rh', 'marketing']}
          >
            <S>
              <CatalogueProduits />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/forecasting"
        element={
          <RouteGuard
            allowedTeams={['direction', 'commercial']}
            disallowedRoles={['rh', 'marketing']}
          >
            <S>
              <Forecasting />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/attribution"
        element={
          <RouteGuard allowedTeams={['direction', 'commercial']} disallowedRoles={['rh']}>
            <S>
              <AttributionV2 />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/churn"
        element={
          <RouteGuard allowedTeams={['direction', 'csm']} disallowedRoles={['rh']}>
            <S>
              <ChurnPredictor />
            </S>
          </RouteGuard>
        }
      />
      {/* Alias historique : /churn-predictor → /churn */}
      <Route path="/churn-predictor" element={<Navigate to="/churn" replace />} />

      <Route
        path="/playbooks-csm"
        element={
          <RouteGuard allowedTeams={['direction', 'csm']} disallowedRoles={['rh']}>
            <S>
              <PlaybooksCsm />
            </S>
          </RouteGuard>
        }
      />
      {/* Alias historique : /csm → page playbooks CSM */}
      <Route path="/csm" element={<Navigate to="/playbooks-csm" replace />} />
      <Route
        path="/social"
        element={
          <RouteGuard allowedTeams={['direction', 'commercial']} disallowedRoles={['rh']}>
            <S>
              <SocialDashboard />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/parametres/social"
        element={
          <RouteGuard adminOnly>
            <S>
              <ParametresSocial />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/social/composer"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh']}>
            <S>
              <SocialComposer />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/social/calendrier"
        element={
          <RouteGuard allowedTeams={['direction', 'commercial']} disallowedRoles={['rh']}>
            <S>
              <SocialCalendar />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/social/inbox"
        element={
          <RouteGuard allowedTeams={['direction', 'commercial']} disallowedRoles={['rh']}>
            <S>
              <SocialInbox />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/automatisations"
        element={
          <RouteGuard disallowedRoles={['rh', 'commercial', 'csm', 'chef_projet']}>
            <S>
              <Automatisations />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/automatisations/sante"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh', 'chef_projet']}>
            <S>
              <AutomationsHealth />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/automatisations/runs"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh', 'chef_projet']}>
            <S>
              <AutomationsRunsExplorer />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/automatisations/webhooks-alertes"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh', 'chef_projet']}>
            <S>
              <AutomationsWebhooksAndAlerts />
            </S>
          </RouteGuard>
        }
      />
      {/* /automatisations/:id (sans /edit) → builder (BUG-042) */}
      <Route path="/automatisations/:id" element={<AutomatisationsIdRedirect />} />
      <Route
        path="/automatisations/:id/edit"
        element={
          <RouteGuard allowedTeams={['direction']} disallowedRoles={['rh', 'chef_projet']}>
            <S>
              <AutomatisationBuilder />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/contrats/builder/:id"
        element={
          <RouteGuard disallowedRoles={['rh', 'csm', 'chef_projet']}>
            <ProtectedRoute>
              <S>
                <ContractBuilder />
              </S>
            </ProtectedRoute>
          </RouteGuard>
        }
      />
    </>
  )
}
