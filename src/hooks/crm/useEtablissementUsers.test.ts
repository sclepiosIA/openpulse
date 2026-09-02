import React, { type PropsWithChildren } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const hoisted = vi.hoisted(() => {
  const ETAB_ID = 'etab_1'
  const ROWS = [
    {
      id: 'eu_1',
      etablissement_id: ETAB_ID,
      user_id: 'auth_1',
      nom: 'Alpha',
      prenom: 'Alice',
      email: 'alice@example.test',
      actif: true,
      etablissement_user_roles: [{ role: 'admin' }],
    },
    {
      id: 'eu_2',
      etablissement_id: ETAB_ID,
      user_id: 'auth_2',
      nom: 'Zeta',
      prenom: 'Zoe',
      email: 'zoe@example.test',
      actif: true,
      etablissement_user_roles: [{ role: 'viewer' }],
    },
  ] as const

  const toastSuccess = vi.fn()
  const toastError = vi.fn()

  const sanitizeSupabaseError = vi.fn((e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message
    }
    return 'Erreur'
  })

  const debugLog = vi.fn()
  const debugError = vi.fn()

  const mockInvalidateQueries = vi.fn()

  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  const mockEq = vi.fn()
  const mockOrder = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockThen = vi.fn()
  const mockCatch = vi.fn()
  const mockSignUp = vi.fn()

  type SupabaseQueryResult<T> = { data: T | null; error: { message: string } | null }

  function createBuilder<T>() {
    const state: { result: SupabaseQueryResult<T> } = { result: { data: null, error: null } }

    const builder = {
      __setResult(next: SupabaseQueryResult<T>) {
        state.result = next
        return builder
      },
      select: mockSelect.mockImplementation(() => builder),
      eq: mockEq.mockImplementation(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: mockOrder.mockImplementation(() => builder),
      limit: vi.fn(() => builder),
      insert: mockInsert.mockImplementation(() => builder),
      update: mockUpdate.mockImplementation(() => builder),
      delete: mockDelete.mockImplementation(() => builder),
      single: mockSingle.mockImplementation(async () => state.result),
      maybeSingle: mockMaybeSingle.mockImplementation(async () => state.result),
      then: mockThen.mockImplementation(
        (onFulfilled: (v: SupabaseQueryResult<T>) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(state.result).then(onFulfilled, onRejected),
      ),
      catch: mockCatch.mockImplementation((onRejected: (e: unknown) => unknown) => Promise.resolve(state.result).catch(onRejected)),
    }

    return builder
  }

  const builder = createBuilder<unknown>()

  return {
    ETAB_ID,
    ROWS,
    toastSuccess,
    toastError,
    sanitizeSupabaseError,
    debugLog,
    debugError,
    mockInvalidateQueries,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    mockThen,
    mockCatch,
    mockSignUp,
    builder,
  }
})

const {
  ETAB_ID,
  ROWS,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
  debugLog,
  debugError,
  mockInvalidateQueries,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockSignUp,
  builder,
} = hoisted

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => builder),
    auth: {
      signUp: mockSignUp,
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLog,
    error: debugError,
  },
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    reference: { staleTime: 30 * 60 * 1000 },
  },
}))

function createQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  vi.spyOn(qc, 'invalidateQueries').mockImplementation(mockInvalidateQueries)
  return qc
}

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useEtablissementUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builder.__setResult({ data: null, error: null })
  })

  it('charge puis retourne les users, et construit la requête attendue', async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    builder.__setResult({ data: ROWS as unknown, error: null })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useEtablissementUsers(ETAB_ID), { wrapper })

    expect(result.current.isLoading || result.current.isFetching).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(ROWS)
    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data?.[0]?.nom).toBe('Alpha')
    expect(result.current.data?.[1]?.nom).toBe('Zeta')

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(mockSelect).toHaveBeenCalledWith('*, etablissement_user_roles(role)')
    expect(mockEq).toHaveBeenCalledWith('etablissement_id', ETAB_ID)
    expect(mockEq).toHaveBeenCalledWith('actif', true)
    expect(mockOrder).toHaveBeenCalledWith('nom', { ascending: true })
  })

  it("passe en erreur quand supabase renvoie une erreur (data:null, error:{message:'x'})", async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    builder.__setResult({ data: null, error: { message: 'x' } })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useEtablissementUsers(ETAB_ID), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeTruthy()
    expect(debugError).toHaveBeenCalled()
  })
})

describe('useCreateEtablissementUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builder.__setResult({ data: null, error: null })
  })

  it('crée un user (auth + insert) puis invalide les queries et toast success', async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    const createdRow = {
      id: 'eu_new',
      etablissement_id: ETAB_ID,
      user_id: 'auth_new',
      nom: 'Durand',
      prenom: 'Camille',
      email: 'camille@example.test',
      telephone: '0102030405',
      fonction: 'Infirmier',
      service: 'Urgences',
      specialite: 'Trauma',
    }

    mockSignUp.mockResolvedValue({
      data: { user: { id: 'auth_new' } },
      error: null,
    })

    builder.__setResult({ data: createdRow as unknown, error: null })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useCreateEtablissementUser(), { wrapper })

    const input = {
      etablissement_id: ETAB_ID,
      nom: 'Durand',
      prenom: 'Camille',
      email: 'camille@example.test',
      telephone: '0102030405',
      fonction: 'Infirmier',
      service: 'Urgences',
      specialite: 'Trauma',
      password: 'pw_test_1',
    }

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    expect(mockSignUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: { data: { type: 'etablissement_user' } },
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'auth_new',
      etablissement_id: input.etablissement_id,
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      telephone: input.telephone,
      fonction: input.fonction,
      service: input.service,
      specialite: input.specialite,
    })
    expect(mockSingle).toHaveBeenCalled()

    expect(toastSuccess).toHaveBeenCalledWith('Utilisateur créé avec succès')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement-users'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement-analytics'] })
  })

  it('toast error avec sanitizeSupabaseError si signUp échoue', async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'x' },
    })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useCreateEtablissementUser(), { wrapper })

    const input = {
      etablissement_id: ETAB_ID,
      nom: 'N',
      prenom: 'P',
      email: 'np@example.test',
      fonction: 'F',
      password: 'pw_test_2',
    }

    await act(async () => {
      try {
        await result.current.mutateAsync(input)
      } catch {
        // ignore
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(sanitizeSupabaseError).toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('x')
  })
})

describe('useUpdateEtablissementUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builder.__setResult({ data: null, error: null })
  })

  it('met à jour un user et invalide les queries', async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    const updatedRow = { id: 'eu_1', nom: 'Alpha', prenom: 'Alicia' }
    builder.__setResult({ data: updatedRow as unknown, error: null })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useUpdateEtablissementUser(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'eu_1',
        updates: { prenom: 'Alicia' },
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(mockUpdate).toHaveBeenCalledWith({ prenom: 'Alicia' })
    expect(mockEq).toHaveBeenCalledWith('id', 'eu_1')
    expect(mockSingle).toHaveBeenCalled()

    expect(toastSuccess).toHaveBeenCalledWith('Utilisateur mis à jour')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement-users'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement-analytics'] })
  })

  it("passe en erreur si update renvoie {data:null, error:{message:'x'}}", async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    builder.__setResult({ data: null, error: { message: 'x' } })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useUpdateEtablissementUser(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'eu_1', updates: { nom: 'B' } })
      } catch {
        // ignore
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(sanitizeSupabaseError).toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('x')
  })
})

describe('useDeleteEtablissementUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builder.__setResult({ data: null, error: null })
  })

  it('supprime un user et invalide les queries + toast success', async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    builder.__setResult({ data: null, error: null })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useDeleteEtablissementUser(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('eu_2')
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'eu_2')

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement-users'] })
    expect(toastSuccess).toHaveBeenCalledWith('Utilisateur supprimé avec succès')
  })

  it("toast error si delete renvoie une erreur (message:'x')", async () => {
    const qc = createQueryClient()
    const wrapper = createWrapper(qc)

    builder.__setResult({ data: null, error: { message: 'x' } })

    const mod = await import('./useEtablissementUsers')
    const { result } = renderHook(() => mod.useDeleteEtablissementUser(), { wrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync('eu_2')
      } catch {
        // ignore
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(sanitizeSupabaseError).toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('x')
  })
})