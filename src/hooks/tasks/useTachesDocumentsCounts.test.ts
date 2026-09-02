// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useTachesDocumentsCounts } from './useTachesDocumentsCounts'

const {
  mockFrom,
  mockIsOccurrenceId,
  builder,
  setResultsQueue,
  resetBuilder,
} = vi.hoisted(() => {
  type Row = { tache_id: string }
  type SupabaseResult = { data: Row[] | null; error: { message: string } | null }

  const mockFrom = vi.fn()
  const mockIsOccurrenceId = vi.fn<(id: string) => boolean>()

  let resultsQueue: SupabaseResult[] = [{ data: [], error: null }]

  const getCurrentResult = () => {
    if (resultsQueue.length > 1) return resultsQueue.shift() as SupabaseResult
    return resultsQueue[0]
  }

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(async () => getCurrentResult()),
    maybeSingle: vi.fn(async () => getCurrentResult()),
    then: vi.fn((onFulfilled?: (value: SupabaseResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(getCurrentResult()).then(onFulfilled, onRejected)
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(getCurrentResult()).catch(onRejected)
    ),
  }

  mockFrom.mockImplementation(() => chain)

  const setResultsQueue = (results: SupabaseResult[]) => {
    resultsQueue = results
  }

  const resetBuilder = () => {
    resultsQueue = [{ data: [], error: null }]
    mockFrom.mockClear()
    mockIsOccurrenceId.mockReset()
    chain.select.mockClear()
    chain.eq.mockClear()
    chain.gte.mockClear()
    chain.lte.mockClear()
    chain.in.mockClear()
    chain.order.mockClear()
    chain.limit.mockClear()
    chain.insert.mockClear()
    chain.update.mockClear()
    chain.delete.mockClear()
    chain.single.mockClear()
    chain.maybeSingle.mockClear()
    chain.then.mockClear()
    chain.catch.mockClear()
  }

  return {
    mockFrom,
    mockIsOccurrenceId,
    builder: chain,
    setResultsQueue,
    resetBuilder,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/recurrenceUtils', () => ({
  isOccurrenceId: mockIsOccurrenceId,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useTachesDocumentsCounts', () => {
  beforeEach(() => {
    resetBuilder()
  })

  it('commence en chargement puis retourne les comptes agrégés en ignorant les occurrence ids', async () => {
    mockIsOccurrenceId.mockImplementation((id: string) => id.includes('_occ_'))
    setResultsQueue([
      {
        data: [
          { tache_id: 't1' },
          { tache_id: 't1' },
          { tache_id: 't2' },
        ],
        error: null,
      },
    ])

    const { result } = renderHook(
      () => useTachesDocumentsCounts(['t1', 'virt_occ_2024-01-01', 't2']),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('taches_documents')
    expect(builder.select).toHaveBeenCalledWith('tache_id')
    expect(builder.in).toHaveBeenCalledWith('tache_id', ['t1', 't2'])
    expect(result.current.data).toEqual({ t1: 2, t2: 1 })
  })

  it('ne lance aucune requête quand tous les ids sont des occurrences', async () => {
    mockIsOccurrenceId.mockReturnValue(true)

    const { result } = renderHook(
      () => useTachesDocumentsCounts(['a_occ_2024-01-01', 'b_occ_2024-01-02']),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle')
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('passe en erreur quand supabase retourne une erreur', async () => {
    mockIsOccurrenceId.mockReturnValue(false)
    setResultsQueue([
      {
        data: null,
        error: { message: 'x' },
      },
    ])

    const { result } = renderHook(
      () => useTachesDocumentsCounts(['t1']),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('taches_documents')
    expect(builder.in).toHaveBeenCalledWith('tache_id', ['t1'])
    expect(result.current.error).toBeTruthy()
    expect(result.current.error?.message).toBe('x')
  })

  it('découpe les ids en chunks de 30 et agrège les résultats de plusieurs requêtes', async () => {
    mockIsOccurrenceId.mockReturnValue(false)

    const ids = Array.from({ length: 31 }, (_, index) => `t${index + 1}`)

    setResultsQueue([
      {
        data: [{ tache_id: 't1' }, { tache_id: 't1' }, { tache_id: 't30' }],
        error: null,
      },
      {
        data: [{ tache_id: 't31' }],
        error: null,
      },
    ])

    const { result } = renderHook(() => useTachesDocumentsCounts(ids), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledTimes(2)
    expect(builder.in).toHaveBeenNthCalledWith(1, 'tache_id', ids.slice(0, 30))
    expect(builder.in).toHaveBeenNthCalledWith(2, 'tache_id', ids.slice(30, 31))
    expect(result.current.data).toEqual({ t1: 2, t30: 1, t31: 1 })
  })
})