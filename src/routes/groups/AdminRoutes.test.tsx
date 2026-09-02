/* @vitest-environment jsdom */
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminRoutes } from './AdminRoutes'

const {
  routeGuardSpy,
  fullPageLoaderSpy,
  errorBoundarySpy,
  lazyPageSpies,
} = vi.hoisted(() => {
  const routeGuardSpy = vi.fn()
  const fullPageLoaderSpy = vi.fn()
  const errorBoundarySpy = vi.fn()

  const makePage = (name: string) => {
    const spy = vi.fn()
    const Comp = () => {
      spy()
      return <div data-testid={`page-${name}`}>{name}</div>
    }
    return { spy, Comp }
  }

  const lazyPageSpies = {
    Parametres: makePage('Parametres'),
    ParametresFeedbacks: makePage('ParametresFeedbacks'),
    ParametresVisioconference: makePage('ParametresVisioconference'),
    ParametresWebDAV: makePage('ParametresWebDAV'),
    ParametresConfiguration: makePage('ParametresConfiguration'),
    ParametresPlatformApi: makePage('ParametresPlatformApi'),
    PortailClient: makePage('PortailClient'),
    PortailClientTaches: makePage('PortailClientTaches'),
    TemplatesTaches: makePage('TemplatesTaches'),
    AIUsageDashboard: makePage('AIUsageDashboard'),
    Profil: makePage('Profil'),
    GestionUtilisateurs: makePage('GestionUtilisateurs'),
    ConfigurationSysteme: makePage('ConfigurationSysteme'),
    GestionBaseDonnees: makePage('GestionBaseDonnees'),
    GestionSecurite: makePage('GestionSecurite'),
    LogsSysteme: makePage('LogsSysteme'),
    GestionNotifications: makePage('GestionNotifications'),
    CentreNotifications: makePage('CentreNotifications'),
    MarqueMonitor: makePage('MarqueMonitor'),
    Rgpd: makePage('Rgpd'),
    ApiDeveloper: makePage('ApiDeveloper'),
    ImportCommercialData: makePage('ImportCommercialData'),
    MobileAppsInstall: makePage('MobileAppsInstall'),
    AdminSatisfaction: makePage('AdminSatisfaction'),
    AdminSatisfactionCampagnes: makePage('AdminSatisfactionCampagnes'),
  }

  return { routeGuardSpy, fullPageLoaderSpy, errorBoundarySpy, lazyPageSpies }
})

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => {
    fullPageLoaderSpy()
    return <div data-testid="full-page-loader">loading</div>
  },
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => {
    errorBoundarySpy()
    return <div data-testid="error-boundary">{children}</div>
  },
}))

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: ({
    children,
    adminOnly,
    strictAdminOnly,
    allowedTeams,
    disallowedRoles,
  }: {
    children: React.ReactNode
    adminOnly?: boolean
    strictAdminOnly?: boolean
    allowedTeams?: string[]
    disallowedRoles?: string[]
  }) => {
    routeGuardSpy({ adminOnly, strictAdminOnly, allowedTeams, disallowedRoles })
    return (
      <div
        data-testid="route-guard"
        data-admin-only={String(Boolean(adminOnly))}
        data-strict-admin-only={String(Boolean(strictAdminOnly))}
        data-allowed-teams={allowedTeams ? allowedTeams.join(',') : ''}
        data-disallowed-roles={disallowedRoles ? disallowedRoles.join(',') : ''}
      >
        {children}
      </div>
    )
  },
}))

vi.mock('../lazyPages', () => ({
  Parametres: lazyPageSpies.Parametres.Comp,
  ParametresFeedbacks: lazyPageSpies.ParametresFeedbacks.Comp,
  ParametresVisioconference: lazyPageSpies.ParametresVisioconference.Comp,
  ParametresWebDAV: lazyPageSpies.ParametresWebDAV.Comp,
  ParametresConfiguration: lazyPageSpies.ParametresConfiguration.Comp,
  ParametresPlatformApi: lazyPageSpies.ParametresPlatformApi.Comp,
  PortailClient: lazyPageSpies.PortailClient.Comp,
  PortailClientTaches: lazyPageSpies.PortailClientTaches.Comp,
  TemplatesTaches: lazyPageSpies.TemplatesTaches.Comp,
  AIUsageDashboard: lazyPageSpies.AIUsageDashboard.Comp,
  Profil: lazyPageSpies.Profil.Comp,
  GestionUtilisateurs: lazyPageSpies.GestionUtilisateurs.Comp,
  ConfigurationSysteme: lazyPageSpies.ConfigurationSysteme.Comp,
  GestionBaseDonnees: lazyPageSpies.GestionBaseDonnees.Comp,
  GestionSecurite: lazyPageSpies.GestionSecurite.Comp,
  LogsSysteme: lazyPageSpies.LogsSysteme.Comp,
  GestionNotifications: lazyPageSpies.GestionNotifications.Comp,
  CentreNotifications: lazyPageSpies.CentreNotifications.Comp,
  MarqueMonitor: lazyPageSpies.MarqueMonitor.Comp,
  Rgpd: lazyPageSpies.Rgpd.Comp,
  ApiDeveloper: lazyPageSpies.ApiDeveloper.Comp,
  ImportCommercialData: lazyPageSpies.ImportCommercialData.Comp,
  MobileAppsInstall: lazyPageSpies.MobileAppsInstall.Comp,
  AdminSatisfaction: lazyPageSpies.AdminSatisfaction.Comp,
  AdminSatisfactionCampagnes: lazyPageSpies.AdminSatisfactionCampagnes.Comp,
}))

function Harness() {
  return (
    <Routes>
      <Route path="*" element={null} />
      {AdminRoutes()}
    </Routes>
  )
}

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()
  })

  it('rend la route publique admin simple /parametres avec Suspense et ErrorBoundary', async () => {
    renderAt('/parametres')

    expect(await screen.findByTestId('page-Parametres')).toHaveTextContent('Parametres')
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(routeGuardSpy).not.toHaveBeenCalled()
    expect(lazyPageSpies.Parametres.spy).toHaveBeenCalledTimes(1)
    expect(errorBoundarySpy).toHaveBeenCalledTimes(1)
  })

  it('protège /parametres/feedbacks avec adminOnly', async () => {
    renderAt('/parametres/feedbacks')

    expect(await screen.findByTestId('page-ParametresFeedbacks')).toHaveTextContent('ParametresFeedbacks')
    const guard = screen.getByTestId('route-guard')
    expect(guard).toHaveAttribute('data-admin-only', 'true')
    expect(guard).toHaveAttribute('data-strict-admin-only', 'false')
    expect(routeGuardSpy).toHaveBeenCalledWith({
      adminOnly: true,
      strictAdminOnly: undefined,
      allowedTeams: undefined,
      disallowedRoles: undefined,
    })
  })

  it('protège /parametres/configuration avec strictAdminOnly', async () => {
    renderAt('/parametres/configuration')

    expect(await screen.findByTestId('page-ParametresConfiguration')).toHaveTextContent('ParametresConfiguration')
    const guard = screen.getByTestId('route-guard')
    expect(guard).toHaveAttribute('data-admin-only', 'false')
    expect(guard).toHaveAttribute('data-strict-admin-only', 'true')
    expect(routeGuardSpy).toHaveBeenCalledWith({
      adminOnly: undefined,
      strictAdminOnly: true,
      allowedTeams: undefined,
      disallowedRoles: undefined,
    })
  })

  it('applique allowedTeams et disallowedRoles sur /parametres/portail-client', async () => {
    renderAt('/parametres/portail-client')

    expect(await screen.findByTestId('page-PortailClient')).toHaveTextContent('PortailClient')
    const guard = screen.getByTestId('route-guard')
    expect(guard).toHaveAttribute('data-allowed-teams', 'direction')
    expect(guard).toHaveAttribute('data-disallowed-roles', 'rh')
    expect(routeGuardSpy).toHaveBeenCalledWith({
      adminOnly: undefined,
      strictAdminOnly: undefined,
      allowedTeams: ['direction'],
      disallowedRoles: ['rh'],
    })
  })

  it('rend la route paramétrée /parametres/portail-client/:etablissementId/taches sans garde', async () => {
    renderAt('/parametres/portail-client/etab-1/taches')

    expect(await screen.findByTestId('page-PortailClientTaches')).toHaveTextContent('PortailClientTaches')
    expect(routeGuardSpy).not.toHaveBeenCalled()
  })

  it('rend une route non gardée /notifications', async () => {
    renderAt('/notifications')

    expect(await screen.findByTestId('page-CentreNotifications')).toHaveTextContent('CentreNotifications')
    expect(routeGuardSpy).not.toHaveBeenCalled()
    expect(lazyPageSpies.CentreNotifications.spy).toHaveBeenCalledTimes(1)
  })
})