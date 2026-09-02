// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CrmRoutes } from './CrmRoutes'

const {
  mockRouteGuard,
  mockFullPageLoader,
  mockErrorBoundary,
  mockPages,
} = vi.hoisted(() => ({
  mockRouteGuard: vi.fn(),
  mockFullPageLoader: vi.fn(),
  mockErrorBoundary: vi.fn(),
  mockPages: {
    Prospects: vi.fn(),
    ProspectsScoring: vi.fn(),
    ApporteursAffaires: vi.fn(),
    Etablissements: vi.fn(),
    EtablissementDetail: vi.fn(),
    Deploiement: vi.fn(),
    Production: vi.fn(),
    Projets: vi.fn(),
    Groupes: vi.fn(),
    GroupeDetail: vi.fn(),
    Partenaires: vi.fn(),
    PartenaireDetail: vi.fn(),
    AnalyseGeographique: vi.fn(),
  },
}))

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => {
    mockFullPageLoader()
    return <div data-testid="full-page-loader">loading</div>
  },
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => {
    mockErrorBoundary()
    return <div data-testid="error-boundary">{children}</div>
  },
}))

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    allowedTeams?: string[]
    disallowedRoles?: string[]
  }) => {
    mockRouteGuard(props)
    return <div data-testid="route-guard">{children}</div>
  },
}))

vi.mock('../lazyPages', () => ({
  Prospects: () => {
    mockPages.Prospects()
    return <div data-testid="page-prospects">Prospects page</div>
  },
  ProspectsScoring: () => {
    mockPages.ProspectsScoring()
    return <div data-testid="page-prospects-scoring">Prospects scoring page</div>
  },
  ApporteursAffaires: () => {
    mockPages.ApporteursAffaires()
    return <div data-testid="page-apporteurs-affaires">Apporteurs affaires page</div>
  },
  Etablissements: () => {
    mockPages.Etablissements()
    return <div data-testid="page-etablissements">Etablissements page</div>
  },
  EtablissementDetail: () => {
    mockPages.EtablissementDetail()
    return <div data-testid="page-etablissement-detail">Etablissement detail page</div>
  },
  Deploiement: () => {
    mockPages.Deploiement()
    return <div data-testid="page-deploiement">Deploiement page</div>
  },
  Production: () => {
    mockPages.Production()
    return <div data-testid="page-production">Production page</div>
  },
  Projets: () => {
    mockPages.Projets()
    return <div data-testid="page-projets">Projets page</div>
  },
  Groupes: () => {
    mockPages.Groupes()
    return <div data-testid="page-groupes">Groupes page</div>
  },
  GroupeDetail: () => {
    mockPages.GroupeDetail()
    return <div data-testid="page-groupe-detail">Groupe detail page</div>
  },
  Partenaires: () => {
    mockPages.Partenaires()
    return <div data-testid="page-partenaires">Partenaires page</div>
  },
  PartenaireDetail: () => {
    mockPages.PartenaireDetail()
    return <div data-testid="page-partenaire-detail">Partenaire detail page</div>
  },
  AnalyseGeographique: () => {
    mockPages.AnalyseGeographique()
    return <div data-testid="page-analyse-geographique">Analyse geographique page</div>
  },
}))

function createWrapper(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

function renderPath(path: string) {
  const Wrapper = createWrapper([path])
  return render(
    <Routes>
      {CrmRoutes()}
    </Routes>,
    { wrapper: Wrapper },
  )
}

describe('CrmRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend la page prospects avec la permission CRM canonique', async () => {
    renderPath('/prospects')

    expect(await screen.findByTestId('page-prospects')).toHaveTextContent('Prospects page')
    expect(screen.getByTestId('route-guard')).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(mockPages.Prospects).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({
      requiredPermission: ['canViewProspects', 'canViewPipeline'],
      disallowedRoles: ['rh', 'marketing'],
    })
    expect(mockErrorBoundary).toHaveBeenCalledTimes(1)
    expect(mockFullPageLoader).not.toHaveBeenCalled()
  })

  it('rend la page prospects scoring avec allowedTeams direction/commercial et disallowedRoles rh', async () => {
    renderPath('/prospects/scoring')

    expect(await screen.findByTestId('page-prospects-scoring')).toHaveTextContent('Prospects scoring page')
    expect(screen.getByTestId('route-guard')).toBeInTheDocument()
    expect(mockPages.ProspectsScoring).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({
      allowedTeams: ['direction', 'commercial'],
      disallowedRoles: ['rh', 'marketing'],
    })
  })

  it('rend la page etablissements sans RouteGuard', async () => {
    renderPath('/etablissements')

    expect(await screen.findByTestId('page-etablissements')).toHaveTextContent('Etablissements page')
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(mockPages.Etablissements).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
    expect(mockErrorBoundary).toHaveBeenCalledTimes(1)
  })

  it('rend la page detail etablissement sur /etablissements/:id', async () => {
    renderPath('/etablissements/42')

    expect(await screen.findByTestId('page-etablissement-detail')).toHaveTextContent('Etablissement detail page')
    expect(mockPages.EtablissementDetail).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
  })

  it('rend la page deploiement avec un RouteGuard disallowing rh', async () => {
    renderPath('/deploiement')

    expect(await screen.findByTestId('page-deploiement')).toHaveTextContent('Deploiement page')
    expect(screen.getByTestId('route-guard')).toBeInTheDocument()
    expect(mockPages.Deploiement).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['rh', 'marketing'] })
  })

  it('rend la page production avec un RouteGuard disallowing rh', async () => {
    renderPath('/production')

    expect(await screen.findByTestId('page-production')).toHaveTextContent('Production page')
    expect(screen.getByTestId('route-guard')).toBeInTheDocument()
    expect(mockPages.Production).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['rh', 'marketing'] })
  })

  it('rend la page projets avec un RouteGuard disallowing rh', async () => {
    renderPath('/projets')

    expect(await screen.findByTestId('page-projets')).toHaveTextContent('Projets page')
    expect(screen.getByTestId('route-guard')).toBeInTheDocument()
    expect(mockPages.Projets).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['rh', 'marketing'] })
  })

  it('rend la page groupes sans RouteGuard', async () => {
    renderPath('/groupes')

    expect(await screen.findByTestId('page-groupes')).toHaveTextContent('Groupes page')
    expect(mockPages.Groupes).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
  })

  it('rend la page detail groupe sur /groupes/:id', async () => {
    renderPath('/groupes/g1')

    expect(await screen.findByTestId('page-groupe-detail')).toHaveTextContent('Groupe detail page')
    expect(mockPages.GroupeDetail).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
  })

  it('rend la page partenaires', async () => {
    renderPath('/partenaires')

    expect(await screen.findByTestId('page-partenaires')).toHaveTextContent('Partenaires page')
    expect(mockPages.Partenaires).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
  })

  it('rend la page detail partenaire sur /partenaires/:id', async () => {
    renderPath('/partenaires/p1')

    expect(await screen.findByTestId('page-partenaire-detail')).toHaveTextContent('Partenaire detail page')
    expect(mockPages.PartenaireDetail).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
  })

  it('rend la page analyse geographique', async () => {
    renderPath('/analyse-geographique')

    expect(await screen.findByTestId('page-analyse-geographique')).toHaveTextContent('Analyse geographique page')
    expect(mockPages.AnalyseGeographique).toHaveBeenCalledTimes(1)
    expect(mockRouteGuard).toHaveBeenCalledWith({ disallowedRoles: ['marketing'] })
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
  })
})