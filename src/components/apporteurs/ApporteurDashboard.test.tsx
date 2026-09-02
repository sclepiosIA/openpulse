import { render } from '@testing-library/react'
import type { Apporteur } from './types'

const { APPORTEURS, mockApporteurCard } = vi.hoisted(() => {
  type MockedApporteur = {
    id: string
    nom: string
    statut: 'sain' | 'a_surveiller' | 'en_negociation'
    portefeuille: number
    commissionMensuelle: number
  }

  const APPORTEURS: MockedApporteur[] = [
    {
      id: 'apporteur-001',
      nom: 'Claire Durand',
      statut: 'sain',
      portefeuille: 8,
      commissionMensuelle: 1240,
    },
    {
      id: 'apporteur-002',
      nom: 'Nassim Bernard',
      statut: 'a_surveiller',
      portefeuille: 3,
      commissionMensuelle: 520,
    },
    {
      id: 'apporteur-003',
      nom: 'Sophie Martin',
      statut: 'en_negociation',
      portefeuille: 5,
      commissionMensuelle: 890,
    },
  ]

  return {
    APPORTEURS,
    mockApporteurCard: vi.fn((props: { apporteur: MockedApporteur }) => {
      void props
      return null
    }),
  }
})

vi.mock('./ApporteurCard', () => ({
  ApporteurCard: mockApporteurCard,
}))

vi.mock('./useApporteurProspects', () => ({
  useApporteurProspects: () => ({ prospects: [], isLoading: false }),
}))

vi.mock('./useApporteurManualScores', () => ({
  useApporteurManualScores: () => ({
    scores: {
      organisation: { value: 70, comment: '', updatedAt: new Date().toISOString() },
      relation: { value: 70, comment: '', updatedAt: new Date().toISOString() },
    },
    isLoading: false,
    updateScore: { mutate: vi.fn() },
  }),
}))

vi.mock('./useApporteursArr', () => ({
  useApporteursArr: () => ({ arrByApporteurId: {}, totalArr: 0, isLoading: false, isReady: true }),
  APPORTEUR_CLIENT_STATUTS: [],
}))

vi.mock('@/hooks/crm/useProspects', () => ({
  useProspects: () => ({ data: [], isLoading: false }),
}))

import { ApporteurDashboard } from './ApporteurDashboard'

describe('ApporteurDashboard', () => {
  beforeEach(() => {
    mockApporteurCard.mockClear()
  })

  it('rend une grille vide quand aucun apporteur est fourni', () => {
    const { container } = render(<ApporteurDashboard apporteurs={[]} />)

    const grid = container.firstElementChild

    expect(grid?.tagName).toBe('DIV')
    expect(grid?.getAttribute('class')).toBe('grid gap-4 md:grid-cols-2 xl:grid-cols-3')
    expect(grid?.children.length).toBe(0)
    expect(mockApporteurCard).toHaveBeenCalledTimes(0)
  })

  it('rend une carte par apporteur en conservant les données métier et l’ordre', () => {
    const apporteurs = APPORTEURS as unknown as Apporteur[]

    const { container } = render(<ApporteurDashboard apporteurs={apporteurs} />)

    expect(container.firstElementChild?.getAttribute('class')).toBe(
      'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
    )
    expect(mockApporteurCard).toHaveBeenCalledTimes(3)

    const receivedIds = mockApporteurCard.mock.calls.map(([props]) => props.apporteur.id)
    const receivedNames = mockApporteurCard.mock.calls.map(([props]) => props.apporteur.nom)
    const receivedStatuses = mockApporteurCard.mock.calls.map(([props]) => props.apporteur.statut)

    expect(receivedIds).toEqual(['apporteur-001', 'apporteur-002', 'apporteur-003'])
    expect(receivedNames).toEqual(['Claire Durand', 'Nassim Bernard', 'Sophie Martin'])
    expect(receivedStatuses).toEqual(['sain', 'a_surveiller', 'en_negociation'])

    expect(mockApporteurCard.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ apporteur: APPORTEURS[0] })
    )
    expect(mockApporteurCard.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ apporteur: APPORTEURS[1] })
    )
    expect(mockApporteurCard.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ apporteur: APPORTEURS[2] })
    )
  })

  it('met à jour les cartes rendues après changement de la liste', () => {
    const initialApporteurs = APPORTEURS.slice(0, 2) as unknown as Apporteur[]
    const nextApporteurs = APPORTEURS.slice(2) as unknown as Apporteur[]

    const { rerender } = render(<ApporteurDashboard apporteurs={initialApporteurs} />)

    expect(mockApporteurCard).toHaveBeenCalledTimes(2)
    expect(mockApporteurCard.mock.calls.map(([props]) => props.apporteur.id)).toEqual([
      'apporteur-001',
      'apporteur-002',
    ])

    mockApporteurCard.mockClear()

    rerender(<ApporteurDashboard apporteurs={nextApporteurs} />)

    expect(mockApporteurCard).toHaveBeenCalledTimes(1)
    expect(mockApporteurCard.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ apporteur: APPORTEURS[2] })
    )
    expect(mockApporteurCard.mock.calls[0]?.[0].apporteur.commissionMensuelle).toBe(890)
  })
})
