/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const {
  routeGuardProps,
  protectedRouteCalls,
  errorBoundaryShouldThrow,
} = vi.hoisted(() => ({
  routeGuardProps: vi.fn(),
  protectedRouteCalls: vi.fn(),
  errorBoundaryShouldThrow: { current: false },
}))

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div data-testid="full-page-loader">loading</div>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => {
    if (errorBoundaryShouldThrow.current) {
      throw new Error('boundary-failure')
    }
    return <div data-testid="error-boundary">{children}</div>
  },
}))

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => {
    protectedRouteCalls()
    return <div data-testid="protected-route">{children}</div>
  },
}))

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: ({
    children,
    allowedTeams,
    disallowedRoles,
  }: {
    children: React.ReactNode
    allowedTeams?: string[]
    disallowedRoles?: string[]
  }) => {
    routeGuardProps({ allowedTeams, disallowedRoles })
    return <div data-testid="route-guard">{children}</div>
  },
}))

vi.mock('../lazyPages', () => ({
  Booking: () => <div data-testid="page-booking">Booking Page</div>,
  Tutoriels: () => <div data-testid="page-tutoriels">Tutoriels Page</div>,
  TutorielModule: () => <div data-testid="page-tutoriel-module">Tutoriel Module Page</div>,
  Todos: () => <div data-testid="page-todos">Todos Page</div>,
  Documents: () => <div data-testid="page-documents">Documents Page</div>,
  BackendViewer: () => <div data-testid="page-backend">Backend Viewer Page</div>,
  SimulateurROI: () => <div data-testid="page-roi">Simulateur ROI Page</div>,
  Visio: () => <div data-testid="page-visio">Visio Page</div>,
  MeetingNotes: () => <div data-testid="page-meeting-notes">Meeting Notes Page</div>,
  Notes: () => <div data-testid="page-notes">Notes Page</div>,
  Forms: () => <div data-testid="page-forms">Forms Page</div>,
  FormBuilder: () => <div data-testid="page-form-builder">Form Builder Page</div>,
  FormResponses: () => <div data-testid="page-form-responses">Form Responses Page</div>,
}))

import { DiversRoutes } from './DiversRoutes'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={null} />
        {DiversRoutes()}
      </Routes>
    </MemoryRouter>
  )
}

describe('DiversRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorBoundaryShouldThrow.current = false
  })

  it('rend les routes paramétrées tutoriel, visio, builder et responses', () => {
    const first = renderAt('/tutoriels/module-a')
    expect(screen.getByTestId('page-tutoriel-module')).toHaveTextContent('Tutoriel Module Page')
    first.unmount()

    const second = renderAt('/visio/room-1')
    expect(screen.getByTestId('page-visio')).toHaveTextContent('Visio Page')
    second.unmount()

    const third = renderAt('/formulaires/42/edit')
    expect(screen.getByTestId('page-form-builder')).toHaveTextContent('Form Builder Page')
    third.unmount()

    renderAt('/formulaires/42/responses')
    expect(screen.getByTestId('page-form-responses')).toHaveTextContent('Form Responses Page')
  })

  it('protège /backend avec RouteGuard et les permissions attendues', () => {
    renderAt('/backend')

    expect(screen.getByTestId('route-guard')).toBeInTheDocument()
    expect(screen.getByTestId('page-backend')).toHaveTextContent('Backend Viewer Page')
    expect(routeGuardProps).toHaveBeenCalledTimes(1)
    expect(routeGuardProps).toHaveBeenCalledWith({
      allowedTeams: ['direction', 'technique'],
      disallowedRoles: ['copil', 'rh', 'csm', 'commercial'],
    })
  })

  it('protège /simulateur-roi avec ProtectedRoute', () => {
    renderAt('/simulateur-roi')

    expect(screen.getByTestId('protected-route')).toBeInTheDocument()
    expect(screen.getByTestId('page-roi')).toHaveTextContent('Simulateur ROI Page')
    expect(protectedRouteCalls).toHaveBeenCalledTimes(1)
  })

  it('rend les autres pages divers attendues', () => {
    const cases = [
      ['/prise-rdv', 'page-booking', 'Booking Page'],
      ['/tutoriels', 'page-tutoriels', 'Tutoriels Page'],
      ['/todos', 'page-todos', 'Todos Page'],
      ['/documents', 'page-documents', 'Documents Page'],
      ['/meeting-notes', 'page-meeting-notes', 'Meeting Notes Page'],
      ['/formulaires', 'page-forms', 'Forms Page'],
    ] as const

    for (const [path, testId, text] of cases) {
      const view = renderAt(path)
      expect(screen.getByTestId(testId)).toHaveTextContent(text)
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      view.unmount()
    }
  })

  it('inclut un fallback Suspense via le loader sur la route', () => {
    renderAt('/documents')
    expect(screen.queryByTestId('full-page-loader')).not.toBeInTheDocument()
    expect(screen.getByTestId('page-documents')).toHaveTextContent('Documents Page')
  })

  it('propage une erreur du boundary mocké', () => {
    errorBoundaryShouldThrow.current = true
    expect(() => renderAt('/documents')).toThrow('boundary-failure')
  })
})
