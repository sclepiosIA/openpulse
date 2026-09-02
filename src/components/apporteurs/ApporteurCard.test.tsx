import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ApporteurCard } from './ApporteurCard'
import type { Apporteur } from './types'

const { mockCn, mockFormatNumber, mockUseApporteurContextData } = vi.hoisted(() => ({
  mockCn: vi.fn((...inputs: Array<string | false | null | undefined>) =>
    inputs.filter((input): input is string => Boolean(input)).join(' ')
  ),
  mockFormatNumber: vi.fn((value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')),
  mockUseApporteurContextData: vi.fn<() => { exchanges: object[]; nextSteps: object[] }>(() => ({
    exchanges: [],
    nextSteps: [],
  })),
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
  formatNumber: mockFormatNumber,
}))

vi.mock('./useApporteurContextData', () => ({
  useApporteurContextData: mockUseApporteurContextData,
}))

vi.mock('@/components/ui/card', async () => {
  const React = await import('react')
  type DivProps = {
    className?: string
    children?: import('react').ReactNode
  }

  return {
    Card: ({ className, children }: DivProps) =>
      React.createElement('section', { className, 'data-testid': 'card' }, children),
    CardHeader: ({ className, children }: DivProps) =>
      React.createElement('div', { className }, children),
    CardTitle: ({ className, children }: DivProps) =>
      React.createElement('h2', { className }, children),
    CardDescription: ({ className, children }: DivProps) =>
      React.createElement('p', { className }, children),
    CardContent: ({ className, children }: DivProps) =>
      React.createElement('div', { className }, children),
    CardFooter: ({ className, children }: DivProps) =>
      React.createElement('div', { className }, children),
  }
})

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react')
  type BadgeProps = {
    className?: string
    children?: import('react').ReactNode
    variant?: string
  }

  return {
    Badge: ({ className, children }: BadgeProps) =>
      React.createElement('span', { className, 'data-testid': 'badge' }, children),
    badgeVariants: () => '',
  }
})

vi.mock('@/components/ui/avatar', async () => {
  const React = await import('react')
  type AvatarProps = {
    className?: string
    children?: import('react').ReactNode
  }

  return {
    Avatar: ({ className, children }: AvatarProps) =>
      React.createElement('div', { className, 'data-testid': 'avatar' }, children),
    AvatarImage: ({ className, children }: AvatarProps) =>
      React.createElement('div', { className }, children),
    AvatarFallback: ({ className, children }: AvatarProps) =>
      React.createElement('div', { className, 'data-testid': 'avatar-fallback' }, children),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockUseApporteurContextData.mockReset()
  mockUseApporteurContextData.mockReturnValue({ exchanges: [], nextSteps: [] })
})

function setContextData(exchanges: object[] = [], nextSteps: object[] = []) {
  mockUseApporteurContextData.mockReturnValue({ exchanges, nextSteps })
}

function renderApporteurCard(apporteur: Apporteur, className?: string, compact?: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApporteurCard apporteur={apporteur} className={className} compact={compact} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function buildApporteur(overrides: Partial<Apporteur> = {}): Apporteur {
  return {
    id: 'aa-delta',
    nom: 'Agence Delta',
    partenaireId: 'p-42',
    typePartenariat: 'Revendeur',
    dateDebut: '2024-01-15T12:00:00.000Z',
    statut: 'a_surveiller',
    metrics: {
      clientsApportes: 4,
      prospectsActifs: 2,
      tauxConversion: 37,
      arrGenere: 125000,
    },
    clients: [
      { nom: 'Clinique Nord', statut: 'signe' },
      { nom: 'Atelier Sud', statut: 'onboarding' },
      { nom: 'Maison Ouest', statut: 'churne' },
    ],
    prospects: [
      { nom: 'Groupe Est', stade: 'Démo' },
      { nom: 'Société Ouest', stade: 'Proposition' },
    ],
    journal: [
      { date: '2024-02-05T12:00:00.000Z', resume: 'Premier contact qualifié' },
      { date: '2024-02-20T12:00:00.000Z', resume: 'Atelier commun réalisé' },
      { date: '2024-03-01T12:00:00.000Z', resume: 'Contrat signé avec Clinique Nord' },
      { date: '2024-03-04T12:00:00.000Z', resume: 'Point caché par la limite' },
    ],
    exchanges: [
      {
        id: 'ex-1',
        date: '2024-03-04T12:00:00.000Z',
        canal: 'RDV',
        resume: 'Point caché par la limite',
      },
      {
        id: 'ex-2',
        date: '2024-03-01T12:00:00.000Z',
        canal: 'Email',
        resume: 'Contrat signé avec Clinique Nord',
      },
      {
        id: 'ex-3',
        date: '2024-02-20T12:00:00.000Z',
        canal: 'Visio',
        resume: 'Atelier commun réalisé',
      },
      {
        id: 'ex-4',
        date: '2024-02-05T12:00:00.000Z',
        canal: 'Téléphone',
        resume: 'Premier contact qualifié',
      },
    ],
    nextSteps: [
      {
        id: 'ns-1',
        action: 'Préparer le comité',
        echeance: '2024-03-10T12:00:00.000Z',
        owner: 'Commercial',
      },
      {
        id: 'ns-2',
        action: 'Relancer Clinique Nord',
        echeance: '2024-03-15T12:00:00.000Z',
        owner: 'CSM',
      },
    ],
    nextStep: {
      action: 'Préparer le comité',
      echeance: '2024-03-10T12:00:00.000Z',
    },
    ...overrides,
  } as Apporteur
}

describe('ApporteurCard', () => {
  it('affiche les informations métier, les métriques et le lien partenaire', () => {
    const apporteur = buildApporteur()

    setContextData(apporteur.exchanges, apporteur.nextSteps)
    renderApporteurCard(apporteur, 'carte-test')

    expect(screen.getByTestId('card')).toHaveClass('overflow-hidden')
    expect(screen.getByTestId('card')).toHaveClass('carte-test')
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('AD')

    const partnerLink = screen.getByRole('link', { name: /Agence Delta/i })
    expect(partnerLink).toHaveAttribute('href', '/apporteurs-affaires?tab=aa-delta')
    expect(screen.getByText('Revendeur')).toBeInTheDocument()

    const statut = screen.getByText('À surveiller')
    expect(statut).toBeInTheDocument()
    expect(statut.className).toContain('bg-warning/15')

    expect(screen.getAllByText('Clients apportés')).toHaveLength(2)
    expect(screen.getByText('Prospects actifs')).toBeInTheDocument()
    expect(screen.getByText('Taux conversion')).toBeInTheDocument()
    expect(screen.getByText('ARR généré')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('37%')).toBeInTheDocument()
    expect(screen.getByText('125 000€')).toBeInTheDocument()
    expect(mockFormatNumber).toHaveBeenCalledWith(125000)

    expect(screen.getByText('Clinique Nord')).toBeInTheDocument()
    expect(screen.getByText('Signé')).toBeInTheDocument()
    expect(screen.getByText('Atelier Sud')).toBeInTheDocument()
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
    expect(screen.getByText('Maison Ouest')).toBeInTheDocument()
    expect(screen.getByText('Churné')).toBeInTheDocument()

    expect(screen.getByText('Groupe Est')).toBeInTheDocument()
    expect(screen.getByText('Démo')).toBeInTheDocument()
    expect(screen.getByText('Société Ouest')).toBeInTheDocument()
    expect(screen.getByText('Proposition')).toBeInTheDocument()

    expect(screen.getByText('Échanges récents')).toBeInTheDocument()
    expect(screen.queryByText('Point caché par la limite')).toBeInTheDocument()
    expect(screen.queryByText('Contrat signé avec Clinique Nord')).toBeInTheDocument()
    expect(screen.queryByText('Atelier commun réalisé')).not.toBeInTheDocument()
    expect(screen.queryByText('Premier contact qualifié')).not.toBeInTheDocument()

    expect(screen.getByText('Next steps')).toBeInTheDocument()
    expect(screen.getByText('Préparer le comité')).toBeInTheDocument()
    expect(screen.getByText('Relancer Clinique Nord')).toBeInTheDocument()
    expect(screen.getByText(/10 mars/i)).toBeInTheDocument()
  })

  it('affiche les états vides sans lien partenaire ni historique', () => {
    const apporteur = buildApporteur({
      id: undefined,
      nom: 'Solo Conseil',
      partenaireId: undefined,
      typePartenariat: 'Direct',
      statut: 'en_negociation',
      clients: [],
      prospects: [],
      journal: [],
      exchanges: [],
      nextSteps: [],
      metrics: {
        clientsApportes: 0,
        prospectsActifs: 0,
        tauxConversion: 0,
        arrGenere: 0,
      },
      nextStep: {
        action: 'Relancer le contact',
        echeance: '2024-04-12T12:00:00.000Z',
      },
    })

    renderApporteurCard(apporteur)

    expect(screen.getByText('SC')).toBeInTheDocument()
    expect(screen.getByText('Solo Conseil')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Solo Conseil/i })).not.toBeInTheDocument()
    expect(screen.getByText('Direct')).toBeInTheDocument()

    const statut = screen.getByText('En négociation')
    expect(statut).toBeInTheDocument()
    expect(statut.className).toContain('bg-muted')

    expect(screen.getByText("Aucun client pour l'instant")).toBeInTheDocument()
    expect(screen.getByText('Aucun prospect ciblé')).toBeInTheDocument()
    expect(screen.queryByText('Échanges récents')).not.toBeInTheDocument()
    expect(screen.queryByText('Next steps')).not.toBeInTheDocument()

    expect(screen.getAllByText('0')).toHaveLength(2)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0€')).toBeInTheDocument()
    expect(screen.queryByText('Relancer le contact')).not.toBeInTheDocument()
  })

  it('conserve les dates invalides telles quelles', () => {
    const apporteur = buildApporteur({
      nom: 'Beta',
      partenaireId: undefined,
      typePartenariat: 'Apport',
      statut: 'sain',
      dateDebut: 'date invalide',
      clients: [],
      prospects: [],
      journal: [{ date: 'jour inconnu', resume: 'Note sans date valide' }],
      exchanges: [
        { id: 'ex-bad', date: 'jour inconnu', canal: 'Email', resume: 'Note sans date valide' },
      ],
      nextSteps: [
        { id: 'ns-bad', action: 'Valider la suite', echeance: 'échéance inconnue', owner: '' },
      ],
      nextStep: {
        action: 'Valider la suite',
        echeance: 'échéance inconnue',
      },
    })

    setContextData(apporteur.exchanges, apporteur.nextSteps)
    renderApporteurCard(apporteur)

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Sain')).toBeInTheDocument()
    expect(screen.getByText('Apport')).toBeInTheDocument()
    expect(screen.getByText('Échanges récents')).toBeInTheDocument()
    expect(screen.getByText('jour inconnu')).toBeInTheDocument()
    expect(screen.getByText('Note sans date valide')).toBeInTheDocument()
    expect(screen.getByText('Next steps')).toBeInTheDocument()
    expect(screen.getByText('Valider la suite')).toBeInTheDocument()
    expect(screen.getByText('échéance inconnue')).toBeInTheDocument()
  })

  it('en mode compact, masque les listes et met en évidence les KPI non liés', () => {
    const apporteur = buildApporteur()

    renderApporteurCard(apporteur, undefined, true)

    expect(screen.getByText('Agence Delta')).toBeInTheDocument()
    expect(screen.getByText('À surveiller')).toBeInTheDocument()
    expect(screen.getByText('Clients apportés')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('125 000€')).toBeInTheDocument()

    expect(screen.queryByText('Clinique Nord')).not.toBeInTheDocument()
    expect(screen.queryByText('Groupe Est')).not.toBeInTheDocument()
    expect(screen.queryByText('Échanges récents')).not.toBeInTheDocument()
    expect(screen.queryByText('Point caché par la limite')).not.toBeInTheDocument()
    expect(screen.queryByText('Next steps')).not.toBeInTheDocument()
    expect(screen.queryByText('Préparer le comité')).not.toBeInTheDocument()
  })

  it('applique les overrides de KPI et retire le fond rouge des métriques liées', () => {
    const apporteur = buildApporteur()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ApporteurCard
            apporteur={apporteur}
            compact
            clientsApportesOverride={3}
            prospectsActifsOverride={10}
            tauxConversionOverride={33.3333}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('33.3%')).toBeInTheDocument()

    const tiles = Array.from(container.querySelectorAll('[class*="rounded-lg"]'))
    const linkedTileTexts = ['Clients apportés', 'Prospects actifs', 'Taux conversion']
    const linkedTiles = tiles.filter((tile) =>
      linkedTileTexts.some((label) => tile.textContent?.includes(label))
    )
    expect(linkedTiles).toHaveLength(3)
    expect(linkedTiles.every((tile) => !tile.className.includes('bg-destructive/15'))).toBe(true)
  })
})
