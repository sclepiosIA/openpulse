import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { pinsData, mockFrom, mockUseAuth } = vi.hoisted(() => ({
  pinsData: [
    {
      user_id: 'user-1',
      activity_key: 'interaction:evt-1',
      pinned_at: '2024-01-15T10:00:00Z',
      note: 'Important',
    },
    {
      user_id: 'user-1',
      activity_key: 'tache:task-2',
      pinned_at: '2024-01-14T08:00:00Z',
      note: null,
    },
  ],
  mockFrom: vi.fn(),
  mockUseAuth: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function createChainableBuilder(response: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  }
  for (const k of ['select', 'order', 'eq', 'delete', 'insert']) {
    builder[k].mockReturnValue(builder)
  }
  ;(builder as unknown as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
    cb
  ) => Promise.resolve(response).then(cb)
  ;(builder as unknown as { catch: (cb: (e: unknown) => unknown) => Promise<unknown> }).catch = (
    cb
  ) => Promise.resolve(response).catch(cb)
  return builder
}

describe('useActivityPins', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('charge les pins et retourne pinnedKeys avec les bonnes clés', async () => {
    const { useActivityPins } = await import('./useActivityPins')
    const builder = createChainableBuilder({ data: pinsData, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.pins).toHaveLength(2)
    expect(result.current.pinnedKeys.has('interaction:evt-1')).toBe(true)
    expect(result.current.pinnedKeys.has('tache:task-2')).toBe(true)
    expect(result.current.pinnedKeys.has('email:unknown')).toBe(false)
    expect(mockFrom).toHaveBeenCalledWith('activity_feed_pins')
  })

  it('ne fait aucun appel si user est null (query disabled)', async () => {
    mockUseAuth.mockReturnValue({ user: null })

    const { useActivityPins } = await import('./useActivityPins')
    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() })

    expect(result.current.pins).toHaveLength(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('expose isLoading=false et pins vides sur erreur', async () => {
    const { useActivityPins } = await import('./useActivityPins')
    const err = new Error('accès refusé')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // pins est un tableau vide (fallback `query.data ?? []`)
    expect(result.current.pins).toHaveLength(0)
  })

  it('togglePin avec currentlyPinned=false appelle insert et invalide la query', async () => {
    const { useActivityPins } = await import('./useActivityPins')
    const builder = createChainableBuilder({ data: pinsData, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Reset après le chargement initial
    mockFrom.mockReset()
    const mutBuilder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(mutBuilder)

    await act(async () => {
      result.current.togglePin('email:new-key', false)
      // la mutation est fire-and-forget via mutate
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockFrom).toHaveBeenCalledWith('activity_feed_pins')
    expect(mutBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', activity_key: 'email:new-key' })
    )
  })

  it('togglePin avec currentlyPinned=true appelle delete', async () => {
    const { useActivityPins } = await import('./useActivityPins')
    const builder = createChainableBuilder({ data: pinsData, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useActivityPins(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFrom.mockReset()
    const mutBuilder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(mutBuilder)

    await act(async () => {
      result.current.togglePin('interaction:evt-1', true)
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockFrom).toHaveBeenCalledWith('activity_feed_pins')
    expect(mutBuilder.delete).toHaveBeenCalled()
    expect(mutBuilder.eq).toHaveBeenCalledWith('activity_key', 'interaction:evt-1')
  })
})
