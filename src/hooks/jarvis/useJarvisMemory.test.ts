import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { USER, TOAST, ROWS, SINGLE_ROW, builder, setNextResolve, setNextReject, DEBUG } = vi.hoisted(() => {
  const USER = { user: { id: 'u1', email: 'test@domain.co' } }
  const TOAST = { toast: vi.fn() }

  const ROWS = [
    {
      id: '1',
      user_id: 'u1',
      category: 'preference',
      key: 'theme',
      value: 'dark',
      metadata: {},
      importance: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      expires_at: null,
    },
    {
      id: '2',
      user_id: 'u1',
      category: 'fact',
      key: 'city',
      value: 'Paris',
      metadata: {},
      importance: 4,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-04T00:00:00Z',
      expires_at: null,
    },
  ] as const

  const SINGLE_ROW = {
    id: '3',
    user_id: 'u1',
    category: 'preference',
    key: 'language',
    value: 'fr',
    metadata: {},
    importance: 3,
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
    expires_at: null,
  } as const

  type NextResult = { type: 'resolve' | 'reject'; value: unknown }

  let nextResult: NextResult = { type: 'resolve', value: { data: ROWS, error: null } }

  function setNextResolve(v: unknown) {
    nextResult = { type: 'resolve', value: v }
  }
  function setNextReject(err: unknown) {
    nextResult = { type: 'reject', value: err }
  }

  const builder: Record<string, any> = {}

  ;[
    'select',
    'eq',
    'order',
    'upsert',
    'delete',
    'single',
    'maybeSingle',
    'insert',
    'update',
    'limit',
    'in',
    'gte',
    'lte',
  ].forEach((m) => {
    builder[m] = vi.fn(() => builder)
  })

  // thenable behavior
  builder.then = (onFulfilled?: any, onRejected?: any) => {
    const p =
      nextResult.type === 'resolve'
        ? Promise.resolve(nextResult.value)
        : Promise.reject(nextResult.value)
    p.finally(() => {
      nextResult = { type: 'resolve', value: { data: ROWS, error: null } }
    })
    return p.then(onFulfilled, onRejected)
  }
  builder.catch = (fn: any) => builder.then(undefined, fn)

  const DEBUG = { error: vi.fn() }

  return { USER, TOAST, ROWS, SINGLE_ROW, builder, setNextResolve, setNextReject, DEBUG }
})

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => USER,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => TOAST,
}))

vi.mock('@/lib/debug', () => ({
  debug: DEBUG,
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: vi.fn(() => builder),
}))

import { useJarvisMemory } from './useJarvisMemory'

describe('useJarvisMemory', () => {
  function createWrapper(qc: QueryClient) {
    return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children)
  }

  function makeQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
  }

  beforeEach(() => {
    TOAST.toast.mockClear()
    DEBUG.error.mockClear()
    // clear builder spies
    Object.keys(builder).forEach((k) => {
      if (typeof builder[k] === 'function') builder[k].mockClear?.()
    })
    // default query response
    setNextResolve({ data: ROWS, error: null })
  })

  it('loads memories successfully and exposes helpers', async () => {
    const qc = makeQueryClient()
    const wrapper = createWrapper(qc)

    const { result } = renderHook(() => useJarvisMemory(), { wrapper })

    // initial loading is true while query resolves
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.memories).toHaveLength(2)
    })

    const context = result.current.getMemoryContext()
    expect(typeof context).toBe('string')
    expect(context).toContain('MÉMOIRE PERSISTANTE')
    expect(context).toContain('PRÉFÉRENCES')
    expect(context).toContain('- theme: dark')

    expect(result.current.getMemoriesByCategory('preference')).toHaveLength(1)
    expect(result.current.hasMemory('theme')).toBe(true)
    expect(result.current.getMemoryValue('theme')).toBe('dark')

    expect(result.current.isAdding).toBe(false)
    expect(result.current.isDeleting).toBe(false)
  })

  it('addMemory calls upsert with correct payload and invalidates queries', async () => {
    const qc = makeQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = createWrapper(qc)

    setNextResolve({ data: ROWS, error: null })
    const { result } = renderHook(() => useJarvisMemory(), { wrapper })

    await waitFor(() => {
      expect(result.current.memories).toHaveLength(2)
    })

    const newRow = { ...SINGLE_ROW }
    setNextResolve({ data: newRow, error: null })

    await act(async () => {
      await result.current.addMemory({
        category: 'preference',
        key: 'language',
        value: 'fr',
        importance: 2,
        metadata: { src: 'test' },
      })
    })

    expect(builder.upsert).toHaveBeenCalled()
    const upsertCall = builder.upsert.mock.calls[0][0]
    expect(upsertCall).toMatchObject({
      user_id: 'u1',
      category: 'preference',
      key: 'language',
      value: 'fr',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-memory', 'u1'] })
  })

  it('addMemory error triggers toast and debug.error', async () => {
    const qc = makeQueryClient()
    const wrapper = createWrapper(qc)

    setNextResolve({ data: ROWS, error: null })
    const { result } = renderHook(() => useJarvisMemory(), { wrapper })

    await waitFor(() => {
      expect(result.current.memories).toHaveLength(2)
    })

    setNextResolve({ data: null, error: { message: 'boom' } })

    await act(async () => {
      await expect(
        result.current.addMemory({
          category: 'preference',
          key: 'broken',
          value: 'x',
        })
      ).rejects.toBeDefined()
    })

    expect(TOAST.toast).toHaveBeenCalled()
    const toastArg = TOAST.toast.mock.calls[0][0]
    expect(toastArg).toMatchObject({
      title: 'Erreur',
      variant: 'destructive',
    })
    expect(DEBUG.error).toHaveBeenCalled()
  })

  it('deleteMemory calls delete and eq then invalidates', async () => {
    const qc = makeQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = createWrapper(qc)

    setNextResolve({ data: ROWS, error: null })
    const { result } = renderHook(() => useJarvisMemory(), { wrapper })

    await waitFor(() => {
      expect(result.current.memories).toHaveLength(2)
    })

    setNextResolve({ data: null, error: null })

    await act(async () => {
      await result.current.deleteMemory('theme')
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.eq).toHaveBeenCalledWith('key', 'theme')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-memory', 'u1'] })
  })

  it('clearCategory deletes by category and invalidates', async () => {
    const qc = makeQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = createWrapper(qc)

    setNextResolve({ data: ROWS, error: null })
    const { result } = renderHook(() => useJarvisMemory(), { wrapper })

    await waitFor(() => {
      expect(result.current.memories).toHaveLength(2)
    })

    setNextResolve({ data: null, error: null })

    await act(async () => {
      await result.current.clearCategory('preference')
    })

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.eq).toHaveBeenCalledWith('category', 'preference')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['jarvis-memory', 'u1'] })
  })
})