import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  ABSENCES_ROWS,
  CREATED_ROW,
  UPDATED_ROW,
  mockFrom,
  builderState,
  toastSuccess,
  toastError,
  debugError,
  resetBuilderState,
} = vi.hoisted(() => {
  type Row = {
    id: string
    profile_id: string
    date_debut: string
    date_fin: string
    type_absence: string
    motif?: string
    statut: string
    validateur_id?: string
    validated_at?: string
    rejection_reason?: string
    demandeur_commentaire?: string
    jours_ouvres?: number
    created_at?: string
    updated_at?: string
    profiles?: { prenom: string; nom: string; email: string }
  }

  const ABSENCES_ROWS: Row[] = [
    {
      id: 'a1',
      profile_id: 'p1',
      date_debut: '2026-01-10',
      date_fin: '2026-01-12',
      type_absence: 'CP',
      motif: 'Vacances',
      statut: 'en_attente',
      jours_ouvres: 2,
      profiles: { prenom: 'Jean', nom: 'Dupont', email: 'jean.dupont@test.local' },
    },
    {
      id: 'a2',
      profile_id: 'p2',
      date_debut: '2026-02-01',
      date_fin: '2026-02-01',
      type_absence: 'RTT',
      statut: 'validee',
      profiles: { prenom: 'Marie', nom: 'Durand', email: 'marie.durand@test.local' },
    },
  ]

  const CREATED_ROW: Row = {
    id: 'a3',
    profile_id: 'p1',
    date_debut: '2026-03-10',
    date_fin: '2026-03-10',
    type_absence: 'RTT',
    statut: 'en_attente',
    profiles: { prenom: 'Jean', nom: 'Dupont', email: 'jean.dupont@test.local' },
  }

  const UPDATED_ROW: Row = {
    ...ABSENCES_ROWS[0],
    statut: 'validee',
    validateur_id: 'manager-1',
  }

  type SupaError = { message: string }
  type SupaResult<T> = { data: T; error: SupaError | null }

  const builderState: {
    listData: Row[]
    listError: SupaError | null
    singleData: Row | null
    singleError: SupaError | null
    deleteError: SupaError | null
    filters: Array<{ op: string; col: string; val: unknown }>
    orders: Array<{ col: string; ascending?: boolean }>
    inserts: unknown[]
    updates: unknown[]
    deletes: number
    lastTable: string | null
    lastSelectArg: string | null
    lastInsertArg: unknown
    lastUpdateArg: unknown
    lastDeleteCalled: boolean
  } = {
    listData: ABSENCES_ROWS,
    listError: null,
    singleData: CREATED_ROW,
    singleError: null,
    deleteError: null,
    filters: [],
    orders: [],
    inserts: [],
    updates: [],
    deletes: 0,
    lastTable: null,
    lastSelectArg: null,
    lastInsertArg: undefined,
    lastUpdateArg: undefined,
    lastDeleteCalled: false,
  }

  const resetBuilderState = () => {
    builderState.listData = ABSENCES_ROWS
    builderState.listError = null
    builderState.singleData = CREATED_ROW
    builderState.singleError = null
    builderState.deleteError = null
    builderState.filters = []
    builderState.orders = []
    builderState.inserts = []
    builderState.updates = []
    builderState.deletes = 0
    builderState.lastTable = null
    builderState.lastSelectArg = null
    builderState.lastInsertArg = undefined
    builderState.lastUpdateArg = undefined
    builderState.lastDeleteCalled = false
  }

  const makeBuilder = () => {
    const b: {
      select: (arg?: string) => typeof b
      eq: (col: string, val: unknown) => typeof b
      gte: (col: string, val: unknown) => typeof b
      lte: (col: string, val: unknown) => typeof b
      in: (col: string, val: unknown) => typeof b
      order: (col: string, opts?: { ascending?: boolean }) => typeof b
      limit: (n: number) => typeof b
      insert: (val: unknown) => typeof b
      update: (val: unknown) => typeof b
      delete: () => typeof b
      single: () => Promise<SupaResult<Row | null>>
      maybeSingle: () => Promise<SupaResult<Row | null>>
      then: <TResult1 = SupaResult<Row[] | null>, TResult2 = never>(
        onfulfilled?:
          | ((value: SupaResult<Row[] | null>) => TResult1 | PromiseLike<TResult1>)
          | undefined
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | undefined
          | null
      ) => Promise<TResult1 | TResult2>
      catch: <TResult = never>(
        onrejected?:
          | ((reason: unknown) => TResult | PromiseLike<TResult>)
          | undefined
          | null
      ) => Promise<SupaResult<Row[] | null> | TResult>
    } = {
      select: (arg?: string) => {
        builderState.lastSelectArg = typeof arg === 'string' ? arg : null
        return b
      },
      eq: (col: string, val: unknown) => {
        builderState.filters.push({ op: 'eq', col, val })
        return b
      },
      gte: (col: string, val: unknown) => {
        builderState.filters.push({ op: 'gte', col, val })
        return b
      },
      lte: (col: string, val: unknown) => {
        builderState.filters.push({ op: 'lte', col, val })
        return b
      },
      in: (col: string, val: unknown) => {
        builderState.filters.push({ op: 'in', col, val })
        return b
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        builderState.orders.push({ col, ascending: opts?.ascending })
        return b
      },
      limit: (_n: number) => b,
      insert: (val: unknown) => {
        builderState.lastInsertArg = val
        builderState.inserts.push(val)
        return b
      },
      update: (val: unknown) => {
        builderState.lastUpdateArg = val
        builderState.updates.push(val)
        return b
      },
      delete: () => {
        builderState.lastDeleteCalled = true
        builderState.deletes += 1
        return b
      },
      single: async () => {
        if (builderState.singleError) return { data: null, error: builderState.singleError }
        return { data: builderState.singleData, error: null }
      },
      maybeSingle: async () => {
        if (builderState.singleError) return { data: null, error: builderState.singleError }
        return { data: builderState.singleData, error: null }
      },
      then: (onfulfilled, onrejected) => {
        const result: SupaResult<Row[] | null> =
          builderState.listError != null
            ? { data: null, error: builderState.listError }
            : { data: builderState.listData, error: null }
        return Promise.resolve(result).then(onfulfilled as never, onrejected as never)
      },
      catch: (onrejected) => {
        const result: SupaResult<Row[] | null> =
          builderState.listError != null
            ? { data: null, error: builderState.listError }
            : { data: builderState.listData, error: null }
        return Promise.resolve(result).catch(onrejected as never)
      },
    }
    return b
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.lastTable = table
    return makeBuilder()
  })

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const debugError = vi.fn()

  return {
    ABSENCES_ROWS,
    CREATED_ROW,
    UPDATED_ROW,
    mockFrom,
    builderState,
    toastSuccess,
    toastError,
    debugError,
    resetBuilderState,
  }
})

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

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

import { useRHAbsences } from './useRHAbsences'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useRHAbsences', () => {
  it('charge puis retourne les absences (avec filtres) et construit la requête attendue', async () => {
    resetBuilderState()

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const profileId = 'p1'
    const startDate = '2026-01-01'
    const endDate = '2026-12-31'

    const { result } = renderHook(() => useRHAbsences(profileId, startDate, endDate), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.absences).toBeUndefined()

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(builderState.lastTable).toBe('rh_absences')
    expect(builderState.orders).toEqual([{ col: 'date_debut', ascending: false }])
    expect(builderState.filters).toEqual([
      { op: 'eq', col: 'profile_id', val: profileId },
      { op: 'gte', col: 'date_debut', val: startDate },
      { op: 'lte', col: 'date_fin', val: endDate },
    ])

    expect(result.current.absences).toEqual(ABSENCES_ROWS)
    expect(result.current.absences?.[0]?.id).toBe('a1')
    expect(result.current.absences?.[0]?.profiles?.email).toBe('jean.dupont@test.local')
    expect(result.current.absences?.[1]?.type_absence).toBe('RTT')
  })

  it("met la query en erreur si supabase renvoie { data:null, error }", async () => {
    resetBuilderState()
    builderState.listError = { message: 'x' }

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHAbsences(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const q = queryClient.getQueryCache().find({
      queryKey: ['rh-absences', undefined, undefined, undefined],
    })
    expect(q?.state.status).toBe('error')
    expect(q?.state.error).toBeTruthy()
  })

  it('createAbsence appelle insert avec la payload attendue et invalide + toast success', async () => {
    resetBuilderState()
    builderState.singleData = CREATED_ROW
    builderState.singleError = null

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHAbsences('p1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const payload = {
      profile_id: 'p1',
      date_debut: '2026-03-10',
      date_fin: '2026-03-10',
      type_absence: 'RTT',
      motif: 'RDV',
      statut: 'en_attente',
      validateur_id: undefined,
      validated_at: undefined,
      rejection_reason: undefined,
      demandeur_commentaire: undefined,
      jours_ouvres: 1,
      profiles: { prenom: 'Jean', nom: 'Dupont', email: 'jean.dupont@test.local' },
    }

    await act(async () => {
      await result.current.createAbsence(payload)
    })

    expect(builderState.lastTable).toBe('rh_absences')
    expect(builderState.inserts.length).toBe(1)
    expect(builderState.lastInsertArg).toEqual(payload)

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rh-absences'] })
    expect(toastSuccess).toHaveBeenCalledWith('Absence créée avec succès')
  })

  it("createAbsence remonte l'erreur et toast error + debug.error", async () => {
    resetBuilderState()
    builderState.singleError = { message: 'x' }

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHAbsences('p1'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const payload = {
      profile_id: 'p1',
      date_debut: '2026-03-10',
      date_fin: '2026-03-10',
      type_absence: 'RTT',
      statut: 'en_attente',
    }

    await act(async () => {
      await expect(result.current.createAbsence(payload)).rejects.toBeTruthy()
    })

    expect(toastError).toHaveBeenCalledWith("Erreur lors de la création de l'absence")
    expect(debugError).toHaveBeenCalled()
  })

  it('updateAbsence appelle update + eq(id) avec la payload attendue et toast success', async () => {
    resetBuilderState()
    builderState.singleData = UPDATED_ROW
    builderState.singleError = null

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHAbsences('p1', '2026-01-01', '2026-12-31'), {
      wrapper,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const updatePatch = { id: 'a1', statut: 'validee', validateur_id: 'manager-1' }

    await act(async () => {
      await result.current.updateAbsence(updatePatch)
    })

    expect(builderState.updates.length).toBe(1)
    expect(builderState.lastUpdateArg).toEqual({ statut: 'validee', validateur_id: 'manager-1' })
    expect(builderState.filters.some((f) => f.op === 'eq' && f.col === 'id' && f.val === 'a1')).toBe(true)
    expect(toastSuccess).toHaveBeenCalledWith('Absence mise à jour avec succès')
  })

  it('deleteAbsence appelle delete + eq(id) avec le bon id et toast success', async () => {
    resetBuilderState()
    builderState.deleteError = null

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHAbsences(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.deleteAbsence('a2')
    })

    expect(builderState.lastDeleteCalled).toBe(true)
    expect(builderState.filters.some((f) => f.op === 'eq' && f.col === 'id' && f.val === 'a2')).toBe(true)
    expect(toastSuccess).toHaveBeenCalledWith('Absence supprimée avec succès')
  })
})