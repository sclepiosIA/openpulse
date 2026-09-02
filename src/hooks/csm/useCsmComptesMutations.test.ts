import { type PropsWithChildren } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  stableError,
  mockFrom,
  mockBuilder,
  mockUpdate,
  mockInsert,
  mockDelete,
  mockEq,
  mockToastSuccess,
  mockToastError,
  mockSanitize,
} = vi.hoisted(() => {
  const stableError = { message: 'x' }

  const mockUpdate = vi.fn()
  const mockInsert = vi.fn()
  const mockDelete = vi.fn()
  const mockEq = vi.fn()

  type ResolveShape = { data: null; error: null | { message: string } }
  const state: { response: ResolveShape } = { response: { data: null, error: null } }

  const builder: Record<string, unknown> = {}

  const chainReturningBuilder = [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
  ] as const

  for (const m of chainReturningBuilder) {
    ;(builder as Record<string, unknown>)[m] = vi.fn(() => builder)
  }

  ;(builder.eq as unknown as ReturnType<typeof vi.fn>).mockImplementation((field: unknown, value: unknown) => {
    mockEq(field, value)
    return builder
  })

  ;(builder.update as unknown as ReturnType<typeof vi.fn>).mockImplementation((payload: unknown) => {
    mockUpdate(payload)
    return builder
  })

  ;(builder.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation((payload: unknown) => {
    mockInsert(payload)
    return builder
  })

  ;(builder.delete as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
    mockDelete()
    return builder
  })

  ;(builder.single as unknown as ReturnType<typeof vi.fn>) = vi.fn(() => Promise.resolve(state.response))
  ;(builder.maybeSingle as unknown as ReturnType<typeof vi.fn>) = vi.fn(() => Promise.resolve(state.response))

  ;(builder.then as unknown as ReturnType<typeof vi.fn>) = vi.fn(
    (onFulfilled?: (v: ResolveShape) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(state.response).then(onFulfilled, onRejected),
  )
  ;(builder.catch as unknown as ReturnType<typeof vi.fn>) = vi.fn((onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(state.response).catch(onRejected),
  )

  const mockFrom = vi.fn(() => builder)

  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()

  const mockSanitize = vi.fn((e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e) return String((e as { message?: unknown }).message)
    return 'error'
  })

  return {
    stableError,
    mockFrom,
    mockBuilder: builder,
    mockUpdate,
    mockInsert,
    mockDelete,
    mockEq,
    mockToastSuccess,
    mockToastError,
    mockSanitize,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}))

import { useCsmComptesMutations } from './useCsmComptesMutations'

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return QueryClientProvider({ client, children })
  }
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function setSupabaseResponse(response: { data: null; error: null | { message: string } }) {
  const thenMock = mockBuilder.then as unknown as ReturnType<typeof vi.fn>
  const catchMock = mockBuilder.catch as unknown as ReturnType<typeof vi.fn>

  thenMock.mockImplementation(
    (onFulfilled?: (v: { data: null; error: null | { message: string } }) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
  )
  catchMock.mockImplementation((onRejected?: (e: unknown) => unknown) => Promise.resolve(response).catch(onRejected))
}

describe('useCsmComptesMutations', () => {
  it('handleUpdate: succès → update/eq appelés et invalidateQueries sur production', async () => {
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    setSupabaseResponse({ data: null, error: null })

    mockFrom.mockClear()
    mockUpdate.mockClear()
    mockEq.mockClear()
    mockToastError.mockClear()
    mockToastSuccess.mockClear()

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleUpdate('e1', 'nom', 'ACME')
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['production'] })
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mockUpdate).toHaveBeenCalledWith({ nom: 'ACME' })
    expect(mockEq).toHaveBeenCalledWith('id', 'e1')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('handleUpdate: erreur → toast.error avec erreur sanitizée', async () => {
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    setSupabaseResponse({ data: null, error: stableError })

    mockSanitize.mockClear()
    mockToastError.mockClear()
    mockToastSuccess.mockClear()

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleUpdate('e2', 'statut', 'Client')
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('x')
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockSanitize).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('handleAdd: succès → insert payload métier + invalidate + toast.success', async () => {
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    setSupabaseResponse({ data: null, error: null })

    mockInsert.mockClear()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleAdd()
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['production'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Compte ajouté')
    })

    expect(mockInsert).toHaveBeenCalledWith({
      nom: 'Nouveau compte',
      statut: 'Prospect',
      type_etablissement: 'Public',
    })
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('handleAdd: erreur → toast.error avec erreur sanitizée', async () => {
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    setSupabaseResponse({ data: null, error: stableError })

    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockSanitize.mockClear()

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleAdd()
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('x')
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockSanitize).toHaveBeenCalledTimes(1)
  })

  it('handleDelete: confirm=false → ne déclenche pas la mutation', async () => {
    const client = createClient()

    setSupabaseResponse({ data: null, error: null })

    mockDelete.mockClear()
    mockEq.mockClear()

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false)

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleDelete('e3', 'Nom')
    })

    expect(confirmSpy).toHaveBeenCalledWith('Supprimer le compte "Nom" ?')
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockEq).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('handleDelete: succès → delete/eq appelés + invalidate + toast.success', async () => {
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    setSupabaseResponse({ data: null, error: null })

    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockDelete.mockClear()
    mockEq.mockClear()

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true)

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleDelete('e4', 'Entreprise')
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['production'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Compte supprimé')
    })

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith('id', 'e4')
    expect(mockToastError).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('handleDelete: erreur → toast.error avec erreur sanitizée', async () => {
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    setSupabaseResponse({ data: null, error: stableError })

    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockSanitize.mockClear()

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true)

    const { result } = renderHook(() => useCsmComptesMutations(), { wrapper: createWrapper(client) })

    await act(async () => {
      result.current.handleDelete('e5', 'Bad')
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('x')
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockSanitize).toHaveBeenCalledTimes(1)

    confirmSpy.mockRestore()
  })
})