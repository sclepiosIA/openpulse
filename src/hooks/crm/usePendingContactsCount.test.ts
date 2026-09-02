/// <reference types="vitest" />
// @vitest-environment jsdom

import React, { type PropsWithChildren } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { stableCount, stableAllRows, mockFrom, builder, setBuilderResolve, setBuilderReject } = vi.hoisted(() => {
  type SupabaseError = { message: string }
  type PendingContactRow = { partenaire_id: string | null }
  type BuilderResult = {
    data?: PendingContactRow[] | null
    count?: number | null
    error?: SupabaseError | null
  }

  let resolveResult: BuilderResult = { data: null, count: null, error: null }
  let rejectError: unknown = null

  const setBuilderResolve = (next: BuilderResult) => {
    rejectError = null
    resolveResult = next
  }

  const setBuilderReject = (err: unknown) => {
    rejectError = err
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),

    then: (onFulfilled: (v: BuilderResult) => unknown, onRejected?: (e: unknown) => unknown) => {
      if (rejectError) return Promise.reject(rejectError).then(onFulfilled, onRejected)
      return Promise.resolve(resolveResult).then(onFulfilled, onRejected)
    },
    catch: (onRejected: (e: unknown) => unknown) => {
      if (rejectError) return Promise.reject(rejectError).catch(onRejected)
      return Promise.resolve(resolveResult).catch(onRejected)
    },
  }

  const mockFrom = vi.fn(() => builder)

  const stableCount = 7
  const stableAllRows: PendingContactRow[] = [
    { partenaire_id: 'p1' },
    { partenaire_id: 'p1' },
    { partenaire_id: 'p2' },
    { partenaire_id: null },
  ]

  return { stableCount, stableAllRows, mockFrom, builder, setBuilderResolve, setBuilderReject }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

import { useAllPendingContactsCounts, usePendingContactsCount } from './usePendingContactsCount'

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

function resetBuilderMocks() {
  builder.select.mockClear()
  builder.eq.mockClear()
  builder.gte.mockClear()
  builder.lte.mockClear()
  builder.in.mockClear()
  builder.order.mockClear()
  builder.limit.mockClear()
  builder.insert.mockClear()
  builder.update.mockClear()
  builder.delete.mockClear()
  builder.upsert.mockClear()
  builder.range.mockClear()
  builder.single.mockClear()
  builder.maybeSingle.mockClear()
  mockFrom.mockClear()
  setBuilderReject(null)
  setBuilderResolve({ data: null, count: null, error: null })
}

describe('usePendingContactsCount', () => {
  it('passe de isLoading à succès et applique le filtre partenaire_id quand fourni', async () => {
    resetBuilderMocks()
    setBuilderResolve({ data: null, count: stableCount, error: null })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePendingContactsCount('p1'), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(stableCount)
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
    expect(builder.select).toHaveBeenCalledWith('partenaire_id', { count: 'exact', head: true })
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
    expect(builder.eq).toHaveBeenCalledWith('partenaire_id', 'p1')
  })

  it("retourne 0 quand count est null et n'applique pas de filtre partenaire_id si absent", async () => {
    resetBuilderMocks()
    setBuilderResolve({ data: null, count: null, error: null })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePendingContactsCount(undefined), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(0)
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')

    const partenaireEqCalls = builder.eq.mock.calls.filter((c) => c[0] === 'partenaire_id')
    expect(partenaireEqCalls.length).toBe(0)
  })

  it('passe en erreur si supabase renvoie error (résultat thenable)', async () => {
    resetBuilderMocks()
    setBuilderResolve({ data: null, count: null, error: { message: 'x' } })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePendingContactsCount('p1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
  })

  it('passe en erreur si la promesse est rejetée', async () => {
    resetBuilderMocks()
    setBuilderReject(new Error('x'))

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePendingContactsCount('p1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
  })
})

describe('useAllPendingContactsCounts', () => {
  it('passe de isLoading à succès et groupe par partenaire_id', async () => {
    resetBuilderMocks()
    setBuilderResolve({ data: stableAllRows, error: null })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useAllPendingContactsCounts(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ p1: 2, p2: 1 })
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
    expect(builder.select).toHaveBeenCalledWith('partenaire_id')
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('passe en erreur si supabase renvoie error', async () => {
    resetBuilderMocks()
    setBuilderResolve({ data: null, error: { message: 'x' } })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useAllPendingContactsCounts(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
    expect(mockFrom).toHaveBeenCalledWith('pending_contacts')
  })
})