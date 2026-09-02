import { Suspense } from 'react'
import { Route } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  MobileMailApp,
  MobileTodosApp,
  MobilePulseApp,
  MobileCalendarApp,
  MobileDocumentsApp,
  MobileBookingApp,
  MobileJarvisApp,
  MobileAppsInstall,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

/**
 * Routes Mobile (/m/*) — extraites de AuthenticatedRoutes (DEBT-02 session 35).
 * Appelées en function dans <Routes>; React Router v6 traverse les fragments.
 */
export function MobileRoutes() {
  return (
    <>
      <Route path="/m/mail" element={<S><MobileMailApp /></S>} />
      <Route path="/m/todos" element={<S><MobileTodosApp /></S>} />
      <Route path="/m/pulse" element={<S><MobilePulseApp /></S>} />
      <Route path="/m/calendrier" element={<S><MobileCalendarApp /></S>} />
      <Route path="/m/documents" element={<S><MobileDocumentsApp /></S>} />
      <Route path="/m/prise-rdv" element={<S><MobileBookingApp /></S>} />
      <Route path="/m/jarvis" element={<S><MobileJarvisApp /></S>} />
      <Route path="/m/install" element={<S><MobileAppsInstall /></S>} />
    </>
  )
}
