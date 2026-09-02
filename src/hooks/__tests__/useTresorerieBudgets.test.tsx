import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mocks stables via vi.hoisted pour éviter les boucles de re-render
const { mockFrom, mockToast } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockToast = vi.fn()
  return { mockFrom, mockToast }
})

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (err: Error) => err.message,
}))

import { useTresorerieBudgets } from '@/hooks/tresorerie/useTresorerieBudgets'
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Helper : crée un proxy chaînable qui se résout à `resolvedValue`
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

const mockBudgets = [
  {
    id: 'b-1',
    categorie_code: 'LOYER',
    mois: '2026-06',
    montant_prevu: 2000,
    montant_alerte: 1800,
    notes: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    created_by: 'user-1',
  },
  {
    id: 'b-2',
    categorie_code: 'SALAIRES',
    mois: '2026-06',
    montant_prevu: 5000,
    montant_alerte: null,
    notes: 'Salaires juin',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    created_by: 'user-1',
  },
]

const mockCategories = [
  { id: 'cat-1', code: 'LOYER', nom: 'Loyer', couleur: '#FF0000' },
  { id: 'cat-2', code: 'SALAIRES', nom: 'Salaires', couleur: '#00FF00' },
]

const mockDepenses = [
  { categorie_code: 'LOYER', montant: 1900, statut: 'paye' },
  { categorie_code: 'SALAIRES', montant: 6000, statut: 'paye' },
]

describe('useTresorerieBudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Structure initiale', () => {
    it("retourne les proprietes correctes a l'etat initial", () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(Array.isArray(result.current.budgets)).toBe(true)
      expect(typeof result.current.createBudget).toBe('function')
      expect(typeof result.current.updateBudget).toBe('function')
      expect(typeof result.current.deleteBudget).toBe('function')
      expect(typeof result.current.duplicateBudgets).toBe('function')
    })
  })

  describe('Calculs avec données réelles', () => {
    it('calcule montant_reel et pourcentage_utilise correctement', async () => {
      // Ordre des appels : tresorerie_budgets, tresorerie_categories, tresorerie_depenses
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockBudgets, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const loyer = result.current.budgets.find((b) => b.categorie_code === 'LOYER')
      expect(loyer).toBeDefined()
      expect(loyer!.montant_reel).toBe(1900)
      // 1900 / 2000 * 100 = 95
      expect(loyer!.pourcentage_utilise).toBeCloseTo(95, 1)
      expect(loyer!.est_depasse).toBe(false)
      // montant_alerte = 1800, montant_reel = 1900 >= 1800 => alerte
      expect(loyer!.est_alerte).toBe(true)
    })

    it('détecte est_depasse quand réel > prévu', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockBudgets, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const salaires = result.current.budgets.find((b) => b.categorie_code === 'SALAIRES')
      expect(salaires!.montant_reel).toBe(6000)
      expect(salaires!.est_depasse).toBe(true)
    })

    it('calcule les totaux globaux correctement', async () => {
      mockFrom
        .mockReturnValueOnce(makeChain({ data: mockBudgets, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockCategories, error: null }))
        .mockReturnValueOnce(makeChain({ data: mockDepenses, error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // prevu total = 2000 + 5000 = 7000
      expect(result.current.totaux.prevu).toBe(7000)
      // reel = 1900 + 6000 = 7900
      expect(result.current.totaux.reel).toBe(7900)
      // 1 dépassé (SALAIRES)
      expect(result.current.totaux.nbDepasse).toBe(1)
      // 1 en alerte non dépassé (LOYER)
      expect(result.current.totaux.nbAlerte).toBe(1)
    })

    it('retourne budgets vides quand aucune donnée', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.budgets).toEqual([])
      expect(result.current.totaux.prevu).toBe(0)
      expect(result.current.totaux.reel).toBe(0)
    })
  })

  describe('Gestion des erreurs', () => {
    it('expose isError quand Supabase retourne une erreur', async () => {
      // Le hook throw quand error est non-null. react-query passe en isError.
      // On utilise un proxy qui throw directement pour simuler l'erreur.
      const throwingHandler: ProxyHandler<object> = {
        get(_t, prop) {
          if (prop === 'then') {
            return (cb: (v: unknown) => unknown, errCb: (e: unknown) => unknown) =>
              Promise.reject(new Error('DB error')).then(cb, errCb)
          }
          return vi.fn((..._args: unknown[]) => new Proxy({}, throwingHandler))
        },
      }
      const throwingProxy = new Proxy({}, throwingHandler) as Chainable
      mockFrom.mockReturnValue(throwingProxy)

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.budgets).toEqual([])
    })
  })

  describe('Calcul avec montant_alerte=null', () => {
    it('utilise le seuil 80% quand montant_alerte est null', async () => {
      const budgetSansSeuil = [
        {
          id: 'b-3',
          categorie_code: 'AUTRE',
          mois: '2026-06',
          montant_prevu: 1000,
          montant_alerte: null,
          notes: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
          created_by: 'user-1',
        },
      ]
      const depense90pct = [{ categorie_code: 'AUTRE', montant: 900, statut: 'paye' }]

      mockFrom
        .mockReturnValueOnce(makeChain({ data: budgetSansSeuil, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: depense90pct, error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const budget = result.current.budgets[0]
      expect(budget.pourcentage_utilise).toBeCloseTo(90, 1)
      // 90% >= 80% => alerte sans seuil explicite
      expect(budget.est_alerte).toBe(true)
    })
  })

  describe('États des mutations', () => {
    it('isCreating, isUpdating, isDeleting, isDuplicating sont false au repos', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }))

      const { result } = renderHook(() => useTresorerieBudgets('2026-06'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.isCreating).toBe(false)
      expect(result.current.isUpdating).toBe(false)
      expect(result.current.isDeleting).toBe(false)
      expect(result.current.isDuplicating).toBe(false)
    })
  })
})
