import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Apporteur } from './types'

type MockApporteurForCard = {
  id?: string
  nom?: string
}

type MockApporteurCardProps = {
  apporteur: MockApporteurForCard
  className?: string
  compact?: boolean
}

const { mockApporteurCard } = vi.hoisted(() => ({
  mockApporteurCard: vi.fn(),
}))

vi.mock('./ApporteurCard', async () => {
  const React = await import('react')

  return {
    ApporteurCard: (props: MockApporteurCardProps) => {
      mockApporteurCard(props)

      return React.createElement(
        'section',
        { 'data-testid': 'apporteur-card' },
        props.apporteur.nom ?? props.apporteur.id ?? 'apporteur sans nom'
      )
    },
  }
})

vi.mock('./ApporteurProspectsTable', async () => {
  const React = await import('react')
  return {
    ApporteurProspectsTable: (props: { partenaireId?: string }) =>
      React.createElement('div', {
        'data-testid': 'apporteur-prospects-table',
        'data-partenaire-id': props.partenaireId ?? '',
      }),
  }
})

vi.mock('./ApporteurContextCards', () => ({
  ApporteurContextCards: () => <aside data-testid="apporteur-context-cards" />,
}))

vi.mock('./useApporteurProspects', () => ({
  useApporteurProspects: () => ({ prospects: [], isLoading: false }),
}))

vi.mock('@/hooks/crm/useProspects', () => ({
  useProspects: () => ({ data: [], isLoading: false }),
}))

import { ApporteurDetailTab } from './ApporteurDetailTab'

const createApporteur = (overrides: Partial<Record<string, unknown>> = {}): Apporteur =>
  ({
    id: 'app-1',
    nom: 'Cabinet Martin',
    email: 'contact@example.fr',
    telephone: '0102030405',
    statut: 'sain',
    type: 'cabinet',
    ville: 'Lyon',
    clients: [],
    prospects: [],
    journal: [],
    nextSteps: [],
    ...overrides,
  }) as unknown as Apporteur

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ApporteurDetailTab', () => {
  it('affiche la fiche apporteur en mode compact', () => {
    const apporteur = createApporteur({
      id: 'app-martin',
      nom: 'Cabinet Martin',
      statut: 'sain',
      ville: 'Lyon',
    })

    render(<ApporteurDetailTab apporteur={apporteur} />)

    expect(screen.getByTestId('apporteur-card')).toHaveTextContent('Cabinet Martin')
    expect(mockApporteurCard).toHaveBeenCalledTimes(1)
    expect(mockApporteurCard).toHaveBeenCalledWith(
      expect.objectContaining({ apporteur, compact: true })
    )
  })

  it('ne rend plus de bloc complémentaire sous la fiche', () => {
    const apporteur = createApporteur()

    const { container } = render(<ApporteurDetailTab apporteur={apporteur} />)

    expect(screen.getByTestId('apporteur-card')).toBeInTheDocument()
    expect(screen.getByTestId('apporteur-prospects-table')).toBeInTheDocument()
    expect(container.firstElementChild?.children).toHaveLength(3)
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Détails complémentaires' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Cet espace accueillera prochainement l'historique complet des échanges/)
    ).not.toBeInTheDocument()
  })

  it('transmet sans transformation un autre apporteur à ApporteurCard', () => {
    const apporteur = createApporteur({
      id: 'app-atlantique',
      nom: 'Réseau Atlantique',
      email: 'reseau@example.fr',
      statut: 'en_negociation',
      ville: 'Nantes',
    })

    render(<ApporteurDetailTab apporteur={apporteur} />)

    expect(screen.getByTestId('apporteur-card')).toHaveTextContent('Réseau Atlantique')
    expect(mockApporteurCard).toHaveBeenCalledTimes(1)
    expect(mockApporteurCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ apporteur, compact: true })
    )
  })
})
