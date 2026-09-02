import { Suspense } from 'react'
import { Route, Navigate } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RouteGuard } from '@/components/security/RouteGuard'
import {
  Booking,
  Tutoriels,
  TutorielModule,
  Todos,
  Documents,
  BackendViewer,
  SimulateurROI,
  Visio,
  MeetingNotes,
  Notes,
  Forms,
  FormBuilder,
  FormResponses,
} from '../lazyPages'

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

/**
 * Routes Divers (base connaissances, prise RDV, tutoriels, todos, documents,
 * backend viewer, simulateur ROI, visio, meeting-notes, formulaires) —
 * extraites de AuthenticatedRoutes (DEBT-02 session 37).
 */
export function DiversRoutes() {
  return (
    <>
      <Route
        path="/prise-rdv"
        element={
          <S>
            <Booking />
          </S>
        }
      />
      <Route
        path="/tutoriels"
        element={
          <S>
            <Tutoriels />
          </S>
        }
      />
      <Route
        path="/tutoriels/:moduleId"
        element={
          <S>
            <TutorielModule />
          </S>
        }
      />
      <Route
        path="/todos"
        element={
          <S>
            <Todos />
          </S>
        }
      />
      {/* Alias historique : /taches → module Todos (audit run-full-20260618-010843, P1) */}
      <Route path="/taches" element={<Navigate to="/todos" replace />} />
      <Route
        path="/documents"
        element={
          <S>
            <Documents />
          </S>
        }
      />
      {/* /backend : aligné avec navigationConfig.backendLinkGroups (allowedTeams direction+technique).
          chef_projet est dans la team technique → doit pouvoir consulter le viewer.
          Audit v3-azure-20260516T163043Z BUG-039/040. */}
      <Route
        path="/backend"
        element={
          <RouteGuard
            allowedTeams={['direction', 'technique']}
            disallowedRoles={['copil', 'rh', 'csm', 'commercial']}
          >
            <S>
              <BackendViewer />
            </S>
          </RouteGuard>
        }
      />
      <Route
        path="/simulateur-roi"
        element={
          <ProtectedRoute>
            <S>
              <SimulateurROI />
            </S>
          </ProtectedRoute>
        }
      />
      <Route
        path="/visio/:roomCode"
        element={
          <S>
            <Visio />
          </S>
        }
      />
      <Route
        path="/meeting-notes"
        element={
          <S>
            <MeetingNotes />
          </S>
        }
      />
      <Route
        path="/notes"
        element={
          <ProtectedRoute>
            <S>
              <Notes />
            </S>
          </ProtectedRoute>
        }
      />
      <Route
        path="/formulaires"
        element={
          <S>
            <Forms />
          </S>
        }
      />
      <Route
        path="/formulaires/:formId/edit"
        element={
          <S>
            <FormBuilder />
          </S>
        }
      />
      <Route
        path="/formulaires/:formId/responses"
        element={
          <S>
            <FormResponses />
          </S>
        }
      />
    </>
  )
}
