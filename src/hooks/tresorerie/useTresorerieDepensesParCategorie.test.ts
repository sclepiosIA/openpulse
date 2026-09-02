/* @vitest-environment jsdom */

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTresorerieDepensesParCategorie } from './useTresorerieDepensesParCategorie'

type SupabaseResult = { data: unknown; error: { message: string } | null }

const {
  CATEGORIES_ROWS,
  DEPENSES_ROWS,
  REVENUS_ROWS,
  AUTH_STATE,
  toastSuccess,
  toastError,
  navigateMock,
  mockFrom,
} = vi.hoisted(() => ({
  CATEGORIES_ROWS: [
    { id: 'root-dep', code: 'DEP', nom: 'Dépenses', parent_id: null, niveau: 0, ordre: 1, type: 'root' },
    { id: 'root-rec', code: 'REC', nom: 'Recettes', parent_id: null, niveau: 0, ordre: 2, type: 'root' },

    { id: 'dep-sal', code: 'DEP_SALAIRES_NETS', nom: 'Salaires nets', parent_id: 'root-dep', niveau: 1, ordre: 1, type: 'depense' },
    { id: 'dep-ops', code: 'DEP_OPERATIONS', nom: 'Opérations', parent_id: 'root-dep', niveau: 1, ordre: 2, type: 'depense' },
    { id: 'dep-ops-soft', code: 'DEP_SOFTWARE', nom: 'Logiciels', parent_id: 'dep-ops', niveau: 2, ordre: 1, type: 'depense' },

    { id: 'rec-ventes', code: 'REC_VENTES', nom: 'Ventes', parent_id: 'root-rec', niveau: 1, ordre: 1, type: 'recette' },
    { id: 'rec-autres', code: 'REC_AUTRES', nom: 'Autres revenus', parent_id: 'root-rec', niveau: 1, ordre: 2, type: 'recette' },
  ],
  DEPENSES_ROWS: [
    {
      categorie_code: 'DEP_SALAIRES_NETS',
      date_prevue: '2025-02-15',
      montant: 1000,
      statut: 'paye',
      nom: 'Salaire - Alice',
      source: 'qonto_sync',
    },
    {
      categorie_code: 'DEP_SALAIRES_NETS',
      date_prevue: '2025-02-28',
      montant: 1000,
      statut: 'prevu',
      nom: 'Salaire - Alice',
      source: 'rh_salaires_net',
    },
    {
      categorie_code: 'DEP_SALAIRES_NETS',
      date_prevue: '2025-02-20',
      montant: 800,
      statut: 'prevu',
      nom: 'Salaire - Bob',
      source: 'rh_salaires_net',
    },
    {
      categorie_code: 'DEP_SOFTWARE',
      date_prevue: '2025-02-05',
      montant: 300,
      statut: 'prevu',
      nom: 'Notion',
      source: 'manual',
    },
    {
      categorie_code: 'DEP_OPERATIONS',
      date_prevue: '2025-03-12',
      montant: 200,
      statut: 'paye',
      nom: 'Frais bancaires',
      source: 'manual',
    },
    {
      categorie_code: null,
      date_prevue: '2025-03-25',
      montant: 50,
      statut: null,
      nom: null,
      source: 'manual',
    },
  ],
  REVENUS_ROWS: [
    {
      mois: '2025-02-01',
      montant_prevu: 5000,
      statut: 'prevu',
      type_revenu: 'abonnement_mensuel',
      notes: 'MRR Février',
    },
    {
      mois: '2025-02-01',
      montant_prevu: 700,
      statut: 'encaisse',
      type_revenu: 'autre',
      notes: 'Subvention',
    },
    {
      mois: '2025-03-01',
      montant_prevu: 2000,
      statut: 'prevu',
      type_revenu: 'paiement_initial',
      notes: null,
    },
    {
      mois: '2025-03-01',
      montant_prevu: 100,
      statut: null,
      type_revenu: null,
      notes: null,
    },
  ],
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  navigateMock: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

function createThenableBuilder(result: SupabaseResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled?: (value: SupabaseResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }
  return builder
}

function setupSupabaseSuccess() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tresorerie_categories') {
      return createThenableBuilder({ data: CATEGORIES_ROWS, error: null })
    }
    if (table === 'tresorerie_depenses') {
      return createThenableBuilder({ data: DEPENSES_ROWS, error: null })
    }
    if (table === 'tresorerie_revenus') {
      return createThenableBuilder({ data: REVENUS_ROWS, error: null })
    }
    return createThenableBuilder({ data: [], error: null })
  })
}

function setupSupabaseErrorOnDepenses() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'tresorerie_categories') {
      return createThenableBuilder({ data: CATEGORIES_ROWS, error: null })
    }
    if (table === 'tresorerie_depenses') {
      return createThenableBuilder({ data: null, error: { message: 'depenses boom' } })
    }
    if (table === 'tresorerie_revenus') {
      return createThenableBuilder({ data: REVENUS_ROWS, error: null })
    }
    return createThenableBuilder({ data: [], error: null })
  })
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useTresorerieDepensesParCategorie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gère le chargement puis agrège correctement dépenses, revenus, transactions et soldes', async () => {
    setupSupabaseSuccess()
    const wrapper = createWrapper()

    const { result } = renderHook(() => useTresorerieDepensesParCategorie(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.tree).toEqual([])
    expect(Array.isArray(result.current.months)).toBe(true)
    expect(result.current.months[0]).toBe('2025-01')

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const feb = '2025-02'
    const mar = '2025-03'

    expect(result.current.tree).toHaveLength(2)
    expect(result.current.tree.map((n) => n.code)).toEqual(['DEP_SALAIRES_NETS', 'DEP_OPERATIONS'])

    const salaires = result.current.tree.find((n) => n.code === 'DEP_SALAIRES_NETS')
    const operations = result.current.tree.find((n) => n.code === 'DEP_OPERATIONS')
    expect(salaires).toBeDefined()
    expect(operations).toBeDefined()

    if (salaires && operations) {
      expect(salaires.monthlyData[feb]).toBe(1800)
      expect(salaires.transactions[feb]).toEqual([
        { nom: 'Salaire - Alice', montant: 1000, statut: 'paye' },
        { nom: 'Salaire - Bob', montant: 800, statut: 'prevu' },
      ])
      expect(salaires.total).toBe(1800)

      expect(operations.children).toHaveLength(1)
      expect(operations.children[0].code).toBe('DEP_SOFTWARE')
      expect(operations.monthlyData[feb]).toBe(300)
      expect(operations.monthlyData[mar]).toBe(200)
      expect(operations.transactions[feb]).toEqual([{ nom: 'Notion', montant: 300, statut: 'prevu' }])
      expect(operations.transactions[mar]).toEqual([{ nom: 'Frais bancaires', montant: 200, statut: 'paye' }])
      expect(operations.total).toBe(500)
    }

    expect(result.current.grandTotal[feb]).toBe(2100)
    expect(result.current.grandTotal[mar]).toBe(200)
    expect(result.current.grandTotalAll).toBe(2300)
    expect(result.current.grandTransactions[feb]).toEqual([
      { nom: 'Salaire - Alice', montant: 1000, statut: 'paye' },
      { nom: 'Salaire - Bob', montant: 800, statut: 'prevu' },
      { nom: 'Notion', montant: 300, statut: 'prevu' },
    ])
    expect(result.current.grandTransactions[mar]).toEqual([{ nom: 'Frais bancaires', montant: 200, statut: 'paye' }])

    expect(result.current.revenueTree).toHaveLength(2)
    expect(result.current.revenueTree.map((n) => n.code)).toEqual(['REC_VENTES', 'REC_AUTRES'])

    const ventes = result.current.revenueTree.find((n) => n.code === 'REC_VENTES')
    const autres = result.current.revenueTree.find((n) => n.code === 'REC_AUTRES')
    expect(ventes).toBeDefined()
    expect(autres).toBeDefined()

    if (ventes && autres) {
      expect(ventes.monthlyData[feb]).toBe(5000)
      expect(ventes.monthlyData[mar]).toBe(2000)
      expect(ventes.transactions[feb]).toEqual([{ nom: 'MRR Février', montant: 5000, statut: 'prevu' }])
      expect(ventes.transactions[mar]).toEqual([{ nom: 'paiement_initial', montant: 2000, statut: 'prevu' }])

      expect(autres.monthlyData[feb]).toBe(700)
      expect(autres.monthlyData[mar]).toBe(100)
      expect(autres.transactions[feb]).toEqual([{ nom: 'Subvention', montant: 700, statut: 'encaisse' }])
      expect(autres.transactions[mar]).toEqual([{ nom: 'Revenu', montant: 100, statut: 'prevu' }])
    }

    expect(result.current.revenueGrandTotal[feb]).toBe(5700)
    expect(result.current.revenueGrandTotal[mar]).toBe(2100)
    expect(result.current.revenueGrandTotalAll).toBe(7800)
    expect(result.current.revenueGrandTransactions[feb]).toEqual([
      { nom: 'MRR Février', montant: 5000, statut: 'prevu' },
      { nom: 'Subvention', montant: 700, statut: 'encaisse' },
    ])
    expect(result.current.revenueGrandTransactions[mar]).toEqual([
      { nom: 'paiement_initial', montant: 2000, statut: 'prevu' },
      { nom: 'Revenu', montant: 100, statut: 'prevu' },
    ])

    expect(result.current.solde[feb]).toBe(3600)
    expect(result.current.solde[mar]).toBe(1900)
    expect(result.current.soldeCumule['2025-01']).toBe(0)
    expect(result.current.soldeCumule[feb]).toBe(3600)
    expect(result.current.soldeCumule[mar]).toBe(5500)

    expect(mockFrom).toHaveBeenCalledWith('tresorerie_categories')
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_depenses')
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_revenus')
    expect(result.current.currentMonth).toMatch(/^\d{4}-\d{2}$/)
  })

  it('gère une erreur sur les dépenses sans faire planter le hook, et calcule les soldes à partir des seules recettes', async () => {
    setupSupabaseErrorOnDepenses()
    const wrapper = createWrapper()

    const { result } = renderHook(() => useTresorerieDepensesParCategorie(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const feb = '2025-02'
    const mar = '2025-03'

    expect(result.current.tree).toEqual([])
    expect(result.current.grandTotal[feb] || 0).toBe(0)
    expect(result.current.grandTotal[mar] || 0).toBe(0)
    expect(result.current.grandTotalAll).toBe(0)

    expect(result.current.revenueTree.map((n) => n.code)).toEqual(['REC_VENTES', 'REC_AUTRES'])
    expect(result.current.revenueGrandTotal[feb]).toBe(5700)
    expect(result.current.revenueGrandTotal[mar]).toBe(2100)
    expect(result.current.revenueGrandTotalAll).toBe(7800)

    expect(result.current.solde[feb]).toBe(5700)
    expect(result.current.solde[mar]).toBe(2100)
    expect(result.current.soldeCumule['2025-01']).toBe(0)
    expect(result.current.soldeCumule[feb]).toBe(5700)
    expect(result.current.soldeCumule[mar]).toBe(7800)

    expect(mockFrom).toHaveBeenCalledWith('tresorerie_categories')
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_depenses')
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_revenus')
  })
})