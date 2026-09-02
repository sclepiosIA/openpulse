import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mocks stables via vi.hoisted
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

import { useTresorerieDepensesParCategorie } from '@/hooks/tresorerie/useTresorerieDepensesParCategorie'
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

type Chainable = { [k: string]: (...args: unknown[]) => Chainable | Promise<unknown> }
function makeChain(resolvedValue: unknown): Chainable {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then')
        return (cb: (v: unknown) => unknown) => Promise.resolve(resolvedValue).then(cb)
      return vi.fn((..._args: unknown[]) => new Proxy({}, handler))
    },
  }
  return new Proxy({}, handler) as Chainable
}

// Arbre minimal pour tests : racine DEP avec un enfant depense, racine REC avec un enfant recette
const mockCategories = [
  {
    id: 'dep-root',
    code: 'DEP',
    nom: 'Depenses',
    parent_id: null,
    niveau: 0,
    ordre: 1,
    type: 'depense',
  },
  {
    id: 'loyer-cat',
    code: 'LOYER',
    nom: 'Loyer',
    parent_id: 'dep-root',
    niveau: 1,
    ordre: 1,
    type: 'depense',
  },
  {
    id: 'rec-root',
    code: 'REC',
    nom: 'Recettes',
    parent_id: null,
    niveau: 0,
    ordre: 2,
    type: 'recette',
  },
  {
    id: 'ventes-cat',
    code: 'REC_VENTES',
    nom: 'Ventes',
    parent_id: 'rec-root',
    niveau: 1,
    ordre: 1,
    type: 'recette',
  },
]

const mockDepenses = [
  {
    categorie_code: 'LOYER',
    date_prevue: '2026-03-15',
    montant: 1200,
    statut: 'paye',
    nom: 'Loyer mars',
    source: 'manuel',
  },
  {
    categorie_code: 'LOYER',
    date_prevue: '2026-04-15',
    montant: 1200,
    statut: 'paye',
    nom: 'Loyer avril',
    source: 'manuel',
  },
]

const mockRevenus = [
  {
    mois: '2026-03-01',
    montant_prevu: 5000,
    statut: 'encaisse',
    type_revenu: 'abonnement_mensuel',
    notes: 'Abonnement CHU',
  },
  {
    mois: '2026-04-01',
    montant_prevu: 3000,
    statut: 'prevu',
    type_revenu: 'paiement_initial',
    notes: null,
  },
]

describe('useTresorerieDepensesParCategorie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Structure de retour', () => {
    it('retourne la structure complete attendue', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      // Proprietes toujours presentes
      expect(Array.isArray(result.current.tree)).toBe(true)
      expect(Array.isArray(result.current.months)).toBe(true)
      expect(typeof result.current.currentMonth).toBe('string')
      expect(typeof result.current.grandTotalAll).toBe('number')
      expect(typeof result.current.revenueGrandTotalAll).toBe('number')
      expect(typeof result.current.isLoading).toBe('boolean')
    })

    it('months contient au moins le mois courant', () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      const now = new Date()
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      expect(result.current.months).toContain(currentMonthKey)
      // Commence en janvier 2025
      expect(result.current.months[0]).toBe('2025-01')
    })
  })

  describe('Agregation des depenses', () => {
    it('aggrege les depenses par categorie et par mois', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null })) // categories
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null })) // depenses
        .mockReturnValueOnce(makeChain({ data: [], error: null })) // revenus

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // LOYER mars = 1200, avril = 1200
      const loyerNode = result.current.tree.find((n) => n.code === 'LOYER')
      expect(loyerNode).toBeDefined()
      expect(loyerNode!.monthlyData['2026-03']).toBe(1200)
      expect(loyerNode!.monthlyData['2026-04']).toBe(1200)
      // total = 2400
      expect(loyerNode!.total).toBeGreaterThanOrEqual(2400)
    })

    it('grandTotalAll est la somme de tous les mois', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // 2 depenses LOYER de 1200 = 2400 total
      expect(result.current.grandTotalAll).toBe(2400)
    })
  })

  describe('Agregation des revenus', () => {
    it('aggrege les revenus par type et par mois', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: mockRevenus, error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // abonnement_mensuel -> REC_VENTES : 5000 en mars
      const ventesNode = result.current.revenueTree.find((n) => n.code === 'REC_VENTES')
      expect(ventesNode).toBeDefined()
      expect(ventesNode!.monthlyData['2026-03']).toBe(5000)
      // paiement_initial -> REC_VENTES : 3000 en avril
      expect(ventesNode!.monthlyData['2026-04']).toBe(3000)
    })

    it('revenueGrandTotalAll = 8000 pour les deux revenus', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: mockRevenus, error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.revenueGrandTotalAll).toBe(8000)
    })
  })

  describe('Calcul des soldes', () => {
    it('calcule le solde mensuel (recettes - depenses)', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockRevenus, error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Mars : recette 5000 - depense 1200 = 3800
      expect(result.current.solde['2026-03']).toBe(3800)
      // Avril : recette 3000 - depense 1200 = 1800
      expect(result.current.solde['2026-04']).toBe(1800)
    })

    it('calcule le solde cumule correctement', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockRevenus, error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // soldeCumule pour un mois = somme cumulative de tous les mois precedents
      // On verifie juste que le cumule avril > cumule mars (croissant)
      const soldeMars = result.current.soldeCumule['2026-03']
      const soldeAvril = result.current.soldeCumule['2026-04']
      expect(soldeAvril).toBeGreaterThan(soldeMars)
    })
  })

  describe('Deduplication salaires', () => {
    it('exclut les salaires RH quand qonto existe pour le meme mois', async () => {
      const depensesAvecSalaires = [
        {
          categorie_code: 'DEP_SALAIRES_NETS',
          date_prevue: '2026-03-28',
          montant: 3000,
          statut: 'paye',
          nom: 'Salaire - Alice',
          source: 'qonto_sync',
        },
        {
          categorie_code: 'DEP_SALAIRES_NETS',
          date_prevue: '2026-03-28',
          montant: 3000,
          statut: 'paye',
          nom: 'Salaire - Alice',
          source: 'rh_salaires_net',
        },
      ]

      // Inclure DEP_SALAIRES_NETS comme enfant de DEP pour que les montants remontent
      const catsAvecSalaires = [
        {
          id: 'dep-root',
          code: 'DEP',
          nom: 'Depenses',
          parent_id: null,
          niveau: 0,
          ordre: 1,
          type: 'depense',
        },
        {
          id: 'salaires-cat',
          code: 'DEP_SALAIRES_NETS',
          nom: 'Salaires nets',
          parent_id: 'dep-root',
          niveau: 1,
          ordre: 2,
          type: 'depense',
        },
        {
          id: 'rec-root',
          code: 'REC',
          nom: 'Recettes',
          parent_id: null,
          niveau: 0,
          ordre: 2,
          type: 'recette',
        },
      ]

      mockFrom
        .mockReturnValueOnce(makeChain({ data: catsAvecSalaires, error: null }))
        .mockReturnValueOnce(makeChain({ data: depensesAvecSalaires, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Seul le qonto reste, total = 3000 (pas 6000)
      expect(result.current.grandTotal['2026-03']).toBe(3000)
    })
  })

  describe('Cas limite : donnees vides', () => {
    it('retourne des structures vides sans erreur', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.tree).toEqual([])
      expect(result.current.revenueTree).toEqual([])
      expect(result.current.grandTotalAll).toBe(0)
      expect(result.current.revenueGrandTotalAll).toBe(0)
    })
  })
})
