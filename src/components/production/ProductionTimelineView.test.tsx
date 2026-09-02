import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductionTimelineView } from './ProductionTimelineView'

const {
  mockNavigate,
  mockCard,
  mockCardContent,
  mockCardHeader,
  mockCardTitle,
  mockBadge,
  mockCustomerHealthIndicator,
  nowMock,
  etablissementsData,
  healthScoresData
} = vi.hoisted(() => {
  const mockNavigateFn = vi.fn()

  const now = new Date('2025-01-15T12:00:00Z').getTime()

  const etablissements = [
    {
      id: 'etab-new-1',
      nom: 'Clinique du Nouveau Monde',
      date_go_live: '2024-12-01T00:00:00Z', // ~1.5 mois => 1 mois, Nouveau
      type: 'Clinique',
      ville: 'Paris',
      region: 'Île-de-France',
      csm: { prenom: 'Alice', nom: 'Martin' }
    },
    {
      id: 'etab-anniv-1',
      nom: 'Hôpital Anniversaire',
      date_go_live: '2024-01-01T00:00:00Z', // 12 mois => 12, Anniv 1 an
      type: 'Hôpital',
      ville: 'Lyon',
      region: 'Auvergne-Rhône-Alpes',
      csm: { prenom: 'Bob', nom: 'Durand' }
    },
    {
      id: 'etab-old-1',
      nom: 'Centre Ancien',
      date_go_live: '2022-01-01T00:00:00Z', // ~37 mois à la date mockée
      type: 'Centre de santé',
      ville: 'Marseille',
      region: 'Provence-Alpes-Côte d’Azur',
      csm: null
    },
    {
      id: 'etab-no-date',
      nom: 'Sans Date',
      date_go_live: null,
      type: 'Cabinet',
      ville: 'Nice',
      region: 'Provence-Alpes-Côte d’Azur',
      csm: null
    }
  ] as unknown as import('@/hooks/crm/useEtablissements').Etablissement[]

  const scores = new Map<string, import('@/hooks/crm/useCustomerHealth').CustomerHealthScore>()
  scores.set('etab-new-1', {
    status: 'good',
    score: 85
  } as import('@/hooks/crm/useCustomerHealth').CustomerHealthScore)
  scores.set('etab-anniv-1', {
    status: 'warning',
    score: 55
  } as import('@/hooks/crm/useCustomerHealth').CustomerHealthScore)
  scores.set('etab-old-1', {
    status: 'bad',
    score: 20
  } as import('@/hooks/crm/useCustomerHealth').CustomerHealthScore)

  const Card = ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>
  const CardContent = ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>
  const CardHeader = ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>
  const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>{children}</div>
  )
  const Badge = ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>

  const CustomerHealthIndicator = ({ status, score, size }: { status: string; score: number; size: string }) => (
    <div data-testid="health-indicator">
      {status}:{score}:{size}
    </div>
  )

  return {
    mockNavigate: mockNavigateFn,
    mockCard: Card,
    mockCardContent: CardContent,
    mockCardHeader: CardHeader,
    mockCardTitle: CardTitle,
    mockBadge: Badge,
    mockCustomerHealthIndicator: CustomerHealthIndicator,
    nowMock: now,
    etablissementsData: etablissements,
    healthScoresData: scores
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('@/components/ui/card', () => ({
  Card: mockCard,
  CardContent: mockCardContent,
  CardHeader: mockCardHeader,
  CardTitle: mockCardTitle
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: mockBadge
}))

vi.mock('./CustomerHealthIndicator', () => ({
  CustomerHealthIndicator: mockCustomerHealthIndicator
}))

// Mocks requis globaux (supabase, auth, services, etc.) pour éviter tout import réseau/contexte
const { mockFrom } = vi.hoisted(() => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled: (value: unknown) => unknown) => {
      const result = { data: null, error: null }
      return Promise.resolve(onFulfilled(result))
    },
    catch: () => builder
  }
  const from = vi.fn(() => builder)
  return { mockFrom: from }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom
  }
}))

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const { mockUseAuthValue } = vi.hoisted(() => {
  const user = { id: 'u1', email: 'test@example.com' }
  const session = { user }
  const mockUseAuth = vi.fn(() => ({
    user,
    session,
    isLoading: false,
    isAuthenticated: true
  }))
  return { mockUseAuthValue: mockUseAuth }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuthValue()
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Autres mocks génériques pour éviter les imports non gérés
vi.mock('@/hooks/crm/useEtablissements', () => ({}))
vi.mock('@/hooks/crm/useCustomerHealth', () => ({}))
vi.mock('@/lib/someService', () => ({}), { virtual: true })

function renderWithClient(
  ui: React.ReactElement,
  options?: { client?: QueryClient }
) {
  const client =
    options?.client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    })

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ProductionTimelineView', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(nowMock)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('affiche la timeline groupée par mois et année avec les informations principales', () => {
    renderWithClient(
      <ProductionTimelineView
        etablissements={etablissementsData}
        healthScores={healthScoresData}
      />
    )

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByTestId('card-title')).toHaveTextContent('Timeline des Go-Lives')

    // Groupes de mois/année : uniquement ceux qui ont des go-lives
    expect(screen.getByText('Décembre 2024')).toBeInTheDocument()
    expect(screen.getByText('Janvier 2024')).toBeInTheDocument()
    expect(screen.getByText('Janvier 2022')).toBeInTheDocument()

    // Nombre de go-lives par groupe (en se basant sur les données)
    expect(screen.getAllByText('1 go-live(s)', { selector: 'div' })).toHaveLength(3)

    // Établissements visibles (sauf celui sans date_go_live)
    expect(
      screen.getByRole('link', {
        name: /Clinique du Nouveau Monde/
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Hôpital Anniversaire/
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Centre Ancien/
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', {
        name: /Sans Date/
      })
    ).not.toBeInTheDocument()

    // Détails texte ville / région / type / CSM
    expect(screen.getByText('Clinique')).toBeInTheDocument()
    expect(screen.getByText(/Paris, Île-de-France/)).toBeInTheDocument()
    expect(screen.getByText(/CSM: Alice Martin/)).toBeInTheDocument()

    expect(screen.getByText('Hôpital')).toBeInTheDocument()
    expect(screen.getByText(/Lyon, Auvergne-Rhône-Alpes/)).toBeInTheDocument()
    expect(screen.getByText(/CSM: Bob Durand/)).toBeInTheDocument()

    expect(screen.getByText('Centre de santé')).toBeInTheDocument()
    expect(screen.getByText(/Marseille, Provence-Alpes-Côte d’Azur/)).toBeInTheDocument()
  })

  it('calcule correctement les mois en production et affiche les badges Nouveau et anniversaire', () => {
    renderWithClient(
      <ProductionTimelineView
        etablissements={etablissementsData}
        healthScores={healthScoresData}
      />
    )

    // Nouveau : ~1.5 mois => 1 mois => "Nouveau"
    const nouveauCard = screen.getByRole('link', {
      name: /Clinique du Nouveau Monde/
    })
    expect(nouveauCard).toHaveTextContent('1 mois en production')
    expect(
      screen.getAllByTestId('badge').some(b => b.textContent?.includes('Nouveau'))
    ).toBe(true)

    // Anniversaire 1 an
    const annivCard = screen.getByRole('link', {
      name: /Hôpital Anniversaire/
    })
    expect(annivCard).toHaveTextContent('12 mois en production')
    expect(
      screen.getAllByTestId('badge').some(b => (b.textContent || '').includes('1 an(s)'))
    ).toBe(true)

    // Ancien : ~37 mois => pas un anniversaire, mais vérifie le texte exact
    const oldCard = screen.getByRole('link', {
      name: /Centre Ancien/
    })
    expect(oldCard).toHaveTextContent('37 mois en production')
    expect(
      screen.getAllByTestId('badge').some(b => (b.textContent || '').includes('3 an(s)'))
    ).toBe(false)
  })

  it('affiche les indicateurs de santé quand un score est disponible', () => {
    renderWithClient(
      <ProductionTimelineView
        etablissements={etablissementsData}
        healthScores={healthScoresData}
      />
    )

    const indicators = screen.getAllByTestId('health-indicator')
    expect(indicators).toHaveLength(3)

    const indicatorTexts = indicators.map(i => i.textContent || '')
    expect(indicatorTexts).toEqual(
      expect.arrayContaining([
        'good:85:sm',
        'warning:55:sm',
        'bad:20:sm'
      ])
    )
  })

  it('navigue vers le détail de l’établissement au clic', () => {
    renderWithClient(
      <ProductionTimelineView
        etablissements={etablissementsData}
        healthScores={healthScoresData}
      />
    )

    const nouveauCard = screen.getByRole('link', {
      name: /Clinique du Nouveau Monde/
    })

    fireEvent.click(nouveauCard)
    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/etab-new-1')
  })

  it('navigue au clavier (Enter et Espace)', () => {
    renderWithClient(
      <ProductionTimelineView
        etablissements={etablissementsData}
        healthScores={healthScoresData}
      />
    )

    const annivCard = screen.getByRole('link', {
      name: /Hôpital Anniversaire/
    })

    fireEvent.keyDown(annivCard, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/etab-anniv-1')

    fireEvent.keyDown(annivCard, { key: ' ' })
    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/etab-anniv-1')
  })

  it('gère le cas sans établissements (aucun groupe rendu)', () => {
    renderWithClient(
      <ProductionTimelineView etablissements={[]} healthScores={new Map()} />
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('card-title')).toHaveTextContent('Timeline des Go-Lives')
  })
})