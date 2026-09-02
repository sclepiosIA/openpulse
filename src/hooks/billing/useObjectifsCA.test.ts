import React, { type PropsWithChildren } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  STABLE_USER,
  mockToastSuccess,
  mockToastError,
  mockDebugError,

  OBJECTIFS_ROWS,
  OBJECTIFS_ANNUELS,
  OBJECTIFS_TRIMESTRIELS,
  ETABLISSEMENTS_ROWS,
  CREATED_ROW,

  mockFrom,

  mockBuilderBase,
  builderForObjectifsRows,
  builderForError,
  builderForObjectifsAnnuelsThenEtablissements,
  builderForObjectifsEmptyThenTrimestrielsThenEtablissementsEmpty,
  builderForInsertReturningCreatedRow,
  builderForUpdateReturningError,

  mockSelect,
  mockEq,
  mockIs,
  mockNot,
  mockGte,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockSingle,
  mockThen,
  mockCatch,
} = vi.hoisted(() => {
  const STABLE_USER = { id: 'u1', email: 't@t.co' }

  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockDebugError = vi.fn()

  const nowYear = new Date().getFullYear()

  const OBJECTIFS_ROWS = [
    {
      id: 'o1',
      user_id: 'u1',
      annee: nowYear,
      trimestre: 1,
      mois: null,
      cible_ca: 1000,
      realise_ca: 200,
      commentaire: null,
      created_by: 'u1',
      created_at: `${nowYear}-01-01T00:00:00Z`,
      updated_at: `${nowYear}-01-01T00:00:00Z`,
    },
    {
      id: 'o2',
      user_id: 'u1',
      annee: nowYear,
      trimestre: 2,
      mois: 5,
      cible_ca: 2000,
      realise_ca: 1000,
      commentaire: 'ok',
      created_by: 'u1',
      created_at: `${nowYear}-02-01T00:00:00Z`,
      updated_at: `${nowYear}-02-01T00:00:00Z`,
    },
  ]

  const OBJECTIFS_ANNUELS = [{ cible_ca: 150000, realise_ca: 10000 }]
  const OBJECTIFS_TRIMESTRIELS = [
    { cible_ca: 0, realise_ca: 5000 },
    { cible_ca: 0, realise_ca: 12000 },
  ]

  const ETABLISSEMENTS_ROWS = [
    {
      type_offre: 'Au succès',
      pallier_vise: 'Palier 2',
      tarifs_palliers: { palier2: 40000 },
      modele_statique_succes: null,
      nombre_passages_urgences_annuel: 1000,
      date_signature: `${nowYear}-02-10`,
    },
    {
      type_offre: 'Autre',
      pallier_vise: null,
      tarifs_palliers: null,
      modele_statique_succes: '30000',
      nombre_passages_urgences_annuel: 500,
      date_signature: `${nowYear}-03-12`,
    },
    {
      type_offre: 'Autre',
      pallier_vise: null,
      tarifs_palliers: null,
      modele_statique_succes: 'not-a-number',
      nombre_passages_urgences_annuel: 10000,
      date_signature: `${nowYear}-04-20`,
    },
  ]

  const CREATED_ROW = {
    id: 'new1',
    user_id: 'u1',
    annee: nowYear,
    trimestre: null,
    mois: null,
    cible_ca: 90000,
    realise_ca: 0,
    commentaire: 'created',
    created_by: 'u1',
    created_at: `${nowYear}-01-05T00:00:00Z`,
    updated_at: `${nowYear}-01-05T00:00:00Z`,
  }

  type Payload = { data: unknown; error: null | { message: string } }
  const makeThenableBuilder = (payloadGetter: () => Payload) => {
    const b: {
      select: (s?: string) => typeof b
      eq: (k: string, v: unknown) => typeof b
      is: (k: string, v: unknown) => typeof b
      not: (k: string, op: string, v: unknown) => typeof b
      gte: (k: string, v: unknown) => typeof b
      lte: (k: string, v: unknown) => typeof b
      in: (k: string, v: unknown) => typeof b
      order: (k: string, opts?: unknown) => typeof b
      limit: (n: number) => typeof b
      insert: (v: unknown) => typeof b
      update: (v: unknown) => typeof b
      delete: () => typeof b
      single: () => Promise<Payload>
      maybeSingle: () => Promise<Payload>
      then: (onFulfilled?: (v: Payload) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>
      catch: (onRejected?: (e: unknown) => unknown) => Promise<unknown>
    } = {} as unknown as never

    const select = (s?: string) => {
      mockSelect(s)
      return b
    }
    const eq = (k: string, v: unknown) => {
      mockEq(k, v)
      return b
    }
    const is = (k: string, v: unknown) => {
      mockIs(k, v)
      return b
    }
    const not = (k: string, op: string, v: unknown) => {
      mockNot(k, op, v)
      return b
    }
    const gte = (k: string, v: unknown) => {
      mockGte(k, v)
      return b
    }
    const lte = (k: string, v: unknown) => {
      mockLte(k, v)
      return b
    }
    const _in = (k: string, v: unknown) => {
      mockIn(k, v)
      return b
    }
    const order = (k: string, opts?: unknown) => {
      mockOrder(k, opts)
      return b
    }
    const limit = (n: number) => {
      mockLimit(n)
      return b
    }
    const insert = (v: unknown) => {
      mockInsert(v)
      return b
    }
    const update = (v: unknown) => {
      mockUpdate(v)
      return b
    }
    const del = () => {
      mockDelete()
      return b
    }

    const single = async () => {
      mockSingle()
      return payloadGetter()
    }
    const maybeSingle = async () => {
      mockMaybeSingle()
      return payloadGetter()
    }

    const then = (onFulfilled?: (v: Payload) => unknown, onRejected?: (e: unknown) => unknown) => {
      mockThen(onFulfilled, onRejected)
      try {
        const payload = payloadGetter()
        const res = onFulfilled ? onFulfilled(payload) : payload
        return Promise.resolve(res)
      } catch (e) {
        if (onRejected) return Promise.resolve(onRejected(e))
        return Promise.reject(e)
      }
    }
    const _catch = (onRejected?: (e: unknown) => unknown) => {
      mockCatch(onRejected)
      if (!onRejected) return Promise.resolve(payloadGetter())
      return Promise.resolve(payloadGetter()).catch(onRejected)
    }

    Object.assign(b, {
      select,
      eq,
      is,
      not,
      gte,
      lte,
      in: _in,
      order,
      limit,
      insert,
      update,
      delete: del,
      single,
      maybeSingle,
      then,
      catch: _catch,
    })

    return b
  }

  const mockSelect = vi.fn()
  const mockEq = vi.fn()
  const mockIs = vi.fn()
  const mockNot = vi.fn()
  const mockGte = vi.fn()
  const mockLte = vi.fn()
  const mockIn = vi.fn()
  const mockOrder = vi.fn()
  const mockLimit = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockThen = vi.fn()
  const mockCatch = vi.fn()

  const mockBuilderBase = makeThenableBuilder(() => ({ data: null, error: null }))

  const builderForObjectifsRows = makeThenableBuilder(() => ({ data: OBJECTIFS_ROWS, error: null }))
  const builderForError = makeThenableBuilder(() => ({ data: null, error: { message: 'x' } }))

  const builderForObjectifsAnnuelsThenEtablissements = (() => {
    let objectifsCall = 0
    let etablissementsCall = 0

    return (table: string) => {
      if (table === 'objectifs_commerciaux') {
        objectifsCall += 1
        void objectifsCall
        return makeThenableBuilder(() => ({ data: OBJECTIFS_ANNUELS, error: null }))
      }
      if (table === 'etablissements') {
        etablissementsCall += 1
        void etablissementsCall
        return makeThenableBuilder(() => ({ data: ETABLISSEMENTS_ROWS, error: null }))
      }
      return mockBuilderBase
    }
  })()

  const builderForObjectifsEmptyThenTrimestrielsThenEtablissementsEmpty = (() => {
    let objectifsThenStep = 0
    return (table: string) => {
      if (table === 'objectifs_commerciaux') {
        const localBuilder = makeThenableBuilder(() => {
          objectifsThenStep += 1
          if (objectifsThenStep === 1) return { data: [], error: null }
          return { data: OBJECTIFS_TRIMESTRIELS, error: null }
        })
        return localBuilder
      }
      if (table === 'etablissements') {
        return makeThenableBuilder(() => ({ data: [], error: null }))
      }
      return mockBuilderBase
    }
  })()

  const builderForInsertReturningCreatedRow = (() => {
    return (table: string) => {
      if (table !== 'objectifs_commerciaux') return mockBuilderBase

      const b = makeThenableBuilder(() => ({ data: null, error: null }))

      const originalInsert = b.insert
      b.insert = (v: unknown) => {
        originalInsert(v)
        return b
      }

      b.select = (s?: string) => {
        mockSelect(s)
        return b
      }

      b.single = async () => {
        mockSingle()
        return { data: CREATED_ROW, error: null }
      }

      return b
    }
  })()

  const builderForUpdateReturningError = (() => {
    return (table: string) => {
      if (table !== 'objectifs_commerciaux') return mockBuilderBase

      const b = makeThenableBuilder(() => ({ data: null, error: null }))

      const originalUpdate = b.update
      b.update = (v: unknown) => {
        originalUpdate(v)
        return b
      }

      const originalEq = b.eq
      b.eq = (k: string, v: unknown) => {
        originalEq(k, v)
        return b
      }

      b.select = (s?: string) => {
        mockSelect(s)
        return b
      }

      b.single = async () => {
        mockSingle()
        return { data: null, error: { message: 'x' } }
      }

      return b
    }
  })()

  const mockFrom = vi.fn((table: string) => {
    void table
    return mockBuilderBase
  })

  return {
    STABLE_USER,
    mockToastSuccess,
    mockToastError,
    mockDebugError,

    OBJECTIFS_ROWS,
    OBJECTIFS_ANNUELS,
    OBJECTIFS_TRIMESTRIELS,
    ETABLISSEMENTS_ROWS,
    CREATED_ROW,

    mockFrom,

    mockBuilderBase,
    builderForObjectifsRows,
    builderForError,
    builderForObjectifsAnnuelsThenEtablissements,
    builderForObjectifsEmptyThenTrimestrielsThenEtablissementsEmpty,
    builderForInsertReturningCreatedRow,
    builderForUpdateReturningError,

    mockSelect,
    mockEq,
    mockIs,
    mockNot,
    mockGte,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockSingle,
    mockThen,
    mockCatch,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: STABLE_USER,
    session: { user: STABLE_USER },
    isLoading: false,
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

async function importModule() {
  return await import('./useObjectifsCA')
}

describe('useObjectifsCA', () => {
  it('charge puis retourne les objectifs (succès) et construit la requête attendue', async () => {
    const { useObjectifsCA } = await importModule()

    mockFrom.mockReset()
    mockFrom.mockImplementation(() => builderForObjectifsRows)

    const year = new Date().getFullYear()
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useObjectifsCA(year, 'u1'), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.length).toBe(2)
    expect(result.current.data?.[0]?.id).toBe('o1')
    expect(result.current.data?.[1]?.cible_ca).toBe(2000)

    expect(mockFrom).toHaveBeenCalledWith('objectifs_commerciaux')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, user_id, annee, trimestre, mois, cible_ca, realise_ca, commentaire, created_by, created_at, updated_at'
    )
    expect(mockEq).toHaveBeenCalledWith('annee', year)
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockOrder).toHaveBeenCalledWith('trimestre', { ascending: true })
    expect(mockOrder).toHaveBeenCalledWith('mois', { ascending: true })
    expect(mockLimit).toHaveBeenCalledWith(200)
  })

  it('passe en erreur si la requête renvoie une erreur', async () => {
    const { useObjectifsCA } = await importModule()

    mockFrom.mockReset()
    mockFrom.mockImplementation(() => builderForError)

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useObjectifsCA(new Date().getFullYear(), 'u1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })
})

describe('useObjectifCASummary', () => {
  it('calcule le résumé avec objectif annuel et CA production (réalisé = max(manuel, production))', async () => {
    const { useObjectifCASummary } = await importModule()
    const year = new Date().getFullYear()
    const startOfYear = `${year}-01-01`

    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) => builderForObjectifsAnnuelsThenEtablissements(table))

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useObjectifCASummary('u1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const expectedProduction = 40000 + 30000 + 20000
    const expectedManuel = 10000
    const expectedRealise = Math.max(expectedManuel, expectedProduction)
    const expectedCible = 150000
    const expectedProgression = Math.min(Math.round((expectedRealise / expectedCible) * 100), 100)
    const expectedReste = Math.max(0, expectedCible - expectedRealise)

    expect(result.current.data).toEqual({
      cible: expectedCible,
      realise: expectedRealise,
      progression: expectedProgression,
      resteAFaire: expectedReste,
    })

    expect(mockFrom).toHaveBeenCalledWith('objectifs_commerciaux')
    expect(mockEq).toHaveBeenCalledWith('annee', year)
    expect(mockIs).toHaveBeenCalledWith('trimestre', null)
    expect(mockIs).toHaveBeenCalledWith('mois', null)

    expect(mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mockEq).toHaveBeenCalledWith('statut', 'Production')
    expect(mockGte).toHaveBeenCalledWith('date_signature', startOfYear)
    expect(mockLimit).toHaveBeenCalledWith(500)
  })

  it('fallback sur les objectifs trimestriels et applique la cible par défaut si cible=0', async () => {
    const { useObjectifCASummary } = await importModule()
    const year = new Date().getFullYear()

    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) =>
      builderForObjectifsEmptyThenTrimestrielsThenEtablissementsEmpty(table)
    )

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useObjectifCASummary('u1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const realise = 5000 + 12000
    const cibleFallback = 500000
    const progression = Math.min(Math.round((realise / cibleFallback) * 100), 100)
    const resteAFaire = Math.max(0, cibleFallback - realise)

    expect(result.current.data).toEqual({
      cible: cibleFallback,
      realise,
      progression,
      resteAFaire,
    })

    expect(mockFrom).toHaveBeenCalledWith('objectifs_commerciaux')
    expect(mockEq).toHaveBeenCalledWith('annee', year)
    expect(mockNot).toHaveBeenCalledWith('trimestre', 'is', null)
    expect(mockLimit).toHaveBeenCalledWith(20)
  })
})

describe('mutations', () => {
  it('useCreateObjectifCA appelle insert avec le payload et affiche un toast success', async () => {
    const { useCreateObjectifCA } = await importModule()

    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockDebugError.mockClear()
    mockInsert.mockClear()
    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) => builderForInsertReturningCreatedRow(table))

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateObjectifCA(), { wrapper: Wrapper })

    const payload = {
      user_id: 'u1',
      annee: new Date().getFullYear(),
      trimestre: null,
      mois: null,
      cible_ca: 90000,
      realise_ca: 0,
      commentaire: 'created',
      created_by: 'u1',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockInsert).toHaveBeenCalledWith(payload)
    expect(mockToastSuccess).toHaveBeenCalledWith('Objectif CA créé avec succès')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("useUpdateObjectifCA passe en erreur si supabase renvoie une erreur et log via debug.error + toast.error", async () => {
    const { useUpdateObjectifCA } = await importModule()

    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockDebugError.mockClear()
    mockUpdate.mockClear()
    mockEq.mockClear()
    mockFrom.mockReset()
    mockFrom.mockImplementation((table: string) => builderForUpdateReturningError(table))

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateObjectifCA(), { wrapper: Wrapper })

    const patch = { id: 'o1', cible_ca: 1111, commentaire: 'updated' }

    await act(async () => {
      try {
        await result.current.mutateAsync(patch)
      } catch {
        // expected
      }
    })

    expect(mockUpdate).toHaveBeenCalledWith({ cible_ca: 1111, commentaire: 'updated' })
    expect(mockEq).toHaveBeenCalledWith('id', 'o1')
    expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la mise à jour')
    expect(mockDebugError).toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})