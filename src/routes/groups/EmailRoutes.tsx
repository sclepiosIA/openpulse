import { Suspense } from 'react'
import { Route } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RouteGuard } from '@/components/security/RouteGuard'
import {
  Emails,
  EmailTemplates,
  EmailAnalytics,
  EmailClassificationAnalytics,
  GestionEmailDomains,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

/**
 * Routes Email — extraites de AuthenticatedRoutes (DEBT-02 session 37).
 */
export function EmailRoutes() {
  return (
    <>
      <Route path="/emails" element={<S><Emails /></S>} />
      <Route path="/email-templates" element={<S><EmailTemplates /></S>} />
      <Route path="/email-analytics" element={<S><EmailAnalytics /></S>} />
      <Route path="/email-classification-analytics" element={<S><EmailClassificationAnalytics /></S>} />
      <Route
        path="/gestion-email-domains"
        element={<RouteGuard strictAdminOnly><S><GestionEmailDomains /></S></RouteGuard>}
      />
    </>
  )
}
