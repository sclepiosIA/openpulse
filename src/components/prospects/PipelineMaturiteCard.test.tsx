import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

const { mockUseTresoreriePrevisionnel, SUCCESS_STATE, LOADING_STATE, EMPTY_STATE } = vi.hoisted(() => {
  const ETABLISSEMENTS_PREVISIONS = [
    { id: 'prod-1', probabilite: 1, revenuMensuelEstime: 1000 },
    { id: 'contract-1', probabilite: 0.8, revenuMensuelEstime: 2000 },
    { id: 'contract-2', probabilite: 0.99, revenuMensuelEstime: 500 },
    { id: 'nego-1', probabilite: 0.55, revenuMensuelEstime: 300 },
    { id: 'etude-1', probabilite: 0.54, revenuMensuelEstime: 100 },
    { id: 'prospect-1', probabilite: 0.01, revenuMensuelEstime: 50 },
    { id: 'prospect-2', probabilite: 0.29, revenuMensuelEstime: 150 },
    { id: 'ignored-0', probabilite: 0, revenuMensuelEstime: 9999 },
  ]

  return {
    mockUseTresoreriePrevisionnel: vi.fn(),
    SUCCESS_STATE: {
      etablissementsPrevisions: ETABLISSEMENTS_PREVISIONS,
      isLoading: false,
    },
    LOADING_STATE: {
      etablissementsPrevisions: [],
      isLoading: true,
    },
    EMPTY_STATE: {
      etablissementsPrevisions: [],
      isLoading: false,
    },
  }
})

vi.mock('@/hooks/tresorerie/useTresoreriePrevisionnel', () => ({
  useTresoreriePrevisionnel: mockUseTresoreriePrevisionnel,
}))

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <section data-testid="ui-card" className={className}>
      {children}
    </section>
  )
  const CardHeader = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div data-testid="ui-card-header" className={className}>
      {children}
    </div>
  )
  const CardTitle = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <h2 data-testid="ui-card-title" className={className}>
      {children}
    </h2>
  )
  const CardContent = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div data-testid="ui-card-content" className={className}>
      {children}
    </div>
  )
  const CardDescription = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <p data-testid="ui-card-description" className={className}>
      {children}
    </p>
  )
  const CardFooter = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div data-testid="ui-card-footer" className={className}>
      {children}
    </div>
  )

  return { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children?: ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-testid="ui-badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
  badgeVariants: vi.fn(),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="pipeline-skeleton" className={className} />
  ),
}))

vi.mock('lucide-react', () => ({
  TrendingUp: ({ className }: { className?: string }) => (
    <svg data-testid="trending-up-icon" className={className} aria-hidden="true" />
  ),
}))

import { PipelineMaturiteCard } from './PipelineMaturiteCard'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithProviders(ui: ReactElement) {
  const queryClient = createTestQueryClient()

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function getLevelCard(label: string) {
  const labelNode = screen.getByText(label)
  const card = labelNode.closest('div.rounded-md')

  if (!(card instanceof HTMLElement)) {
    throw new Error(`Carte introuvable pour le niveau ${label}`)
  }

  return card
}

function expectNormalizedText(container: HTMLElement, expected: string) {
  expect(
    within(container).getByText((_content, element) => normalizeText(element?.textContent ?? '') === expected)
  ).toBeInTheDocument()
}

afterEach(() => {
  cleanup()
  mockUseTresoreriePrevisionnel.mockReset()
})

describe('PipelineMaturiteCard', () => {
  it('affiche le titre et cinq skeletons pendant le chargement', () => {
    mockUseTresoreriePrevisionnel.mockReturnValue(LOADING_STATE)

    renderWithProviders(<PipelineMaturiteCard />)

    expect(screen.getByRole('heading', { name: 'Pipeline par niveau de maturité' })).toBeInTheDocument()
    expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument()
    expect(screen.getAllByTestId('pipeline-skeleton')).toHaveLength(5)
    expect(screen.queryByText('Aucun établissement dans le pipeline.')).not.toBeInTheDocument()
  })

  it('regroupe les établissements par maturité avec les bons compteurs et montants', () => {
    mockUseTresoreriePrevisionnel.mockReturnValue(SUCCESS_STATE)

    renderWithProviders(<PipelineMaturiteCard />)

    expect(screen.queryByTestId('pipeline-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByText('Aucun établissement dans le pipeline.')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('ui-badge')).toHaveLength(5)

    const production = getLevelCard('Production')
    expect(within(production).getByTestId('ui-badge')).toHaveTextContent('1')
    expectNormalizedText(production, '12 000 €')
    expectNormalizedText(production, '1 000 €/mois')

    const contractuel = getLevelCard('Contractuel')
    expect(within(contractuel).getByTestId('ui-badge')).toHaveTextContent('2')
    expectNormalizedText(contractuel, '30 000 €')
    expectNormalizedText(contractuel, '2 500 €/mois')

    const negociation = getLevelCard('Négociation')
    expect(within(negociation).getByTestId('ui-badge')).toHaveTextContent('1')
    expectNormalizedText(negociation, '3 600 €')
    expectNormalizedText(negociation, '300 €/mois')

    const etudeEmise = getLevelCard('Étude émise')
    expect(within(etudeEmise).getByTestId('ui-badge')).toHaveTextContent('1')
    expectNormalizedText(etudeEmise, '1 200 €')
    expectNormalizedText(etudeEmise, '100 €/mois')

    const prospection = getLevelCard('Prospection')
    expect(within(prospection).getByTestId('ui-badge')).toHaveTextContent('2')
    expectNormalizedText(prospection, '2 400 €')
    expectNormalizedText(prospection, '200 €/mois')
  })

  it("affiche l'état vide quand aucun établissement n'est présent dans le pipeline", () => {
    mockUseTresoreriePrevisionnel.mockReturnValue(EMPTY_STATE)

    renderWithProviders(<PipelineMaturiteCard />)

    expect(screen.getByRole('heading', { name: 'Pipeline par niveau de maturité' })).toBeInTheDocument()
    expect(screen.getByText('Aucun établissement dans le pipeline.')).toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ui-badge')).not.toBeInTheDocument()
  })
})