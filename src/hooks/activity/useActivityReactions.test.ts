import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { reactionsData, mockFrom, mockChannel, mockRemoveChannel, mockUseAuth } = vi.hoisted(() => {
  const channelObj = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  channelObj.on.mockReturnValue(channelObj)
  channelObj.subscribe.mockReturnValue({ unsubscribe: vi.fn() })

  return {
    reactionsData: [
      { activity_key: 'interaction:evt-1', user_id: 'user-1', emoji: '👍' },
      { activity_key: 'interaction:evt-1', user_id: 'user-2', emoji: '👍' },
      { activity_key: 'interaction:evt-1', user_id: 'user-1', emoji: '❤️' },
      { activity_key: 'tache:task-2', user_id: 'user-2', emoji: '🎉' },
    ],
    mockFrom: vi.fn(),
    mockChannel: vi.fn().mockReturnValue(channelObj),
    mockRemoveChannel: vi.fn(),
    mockUseAuth: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
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
    in: vi.fn(),
    eq: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  }
  for (const k of ['select', 'in', 'eq', 'delete', 'insert']) {
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

describe('useActivityReactions', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockChannel.mockClear()
    mockRemoveChannel.mockClear()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('ne fait aucun appel si activityKeys est vide (query disabled)', async () => {
    const { useActivityReactions } = await import('./useActivityReactions')
    const { result } = renderHook(() => useActivityReactions([]), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.reactionsByKey).toEqual({})
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('charge et agrège les réactions par clé et par emoji', async () => {
    const { useActivityReactions } = await import('./useActivityReactions')
    const builder = createChainableBuilder({ data: reactionsData, error: null })
    mockFrom.mockReturnValue(builder)

    const keys = ['interaction:evt-1', 'tache:task-2']
    const { result } = renderHook(() => useActivityReactions(keys), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const reactions = result.current.reactionsByKey
    // 2 utilisateurs ont liké 'interaction:evt-1' avec 👍
    const likesOnEvt1 = reactions['interaction:evt-1']?.find((r) => r.emoji === '👍')
    expect(likesOnEvt1?.count).toBe(2)
    expect(likesOnEvt1?.reactedByMe).toBe(true) // user-1 a réagi

    // 1 ❤️ de user-1 sur interaction:evt-1
    const heartOnEvt1 = reactions['interaction:evt-1']?.find((r) => r.emoji === '❤️')
    expect(heartOnEvt1?.count).toBe(1)
    expect(heartOnEvt1?.reactedByMe).toBe(true)

    // tache:task-2 = 🎉 de user-2 (pas user-1)
    const confettiOnTask2 = reactions['tache:task-2']?.find((r) => r.emoji === '🎉')
    expect(confettiOnTask2?.count).toBe(1)
    expect(confettiOnTask2?.reactedByMe).toBe(false)

    expect(mockFrom).toHaveBeenCalledWith('activity_feed_reactions')
    expect(builder.in).toHaveBeenCalledWith('activity_key', expect.arrayContaining(keys))
  })

  it('expose isLoading=true puis false et reactionsByKey vide sur erreur', async () => {
    const { useActivityReactions } = await import('./useActivityReactions')
    const err = new Error('accès refusé')
    const builder = createChainableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useActivityReactions(['interaction:evt-1']), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // reactionsByKey est {} en fallback
    expect(result.current.reactionsByKey).toEqual({})
  })

  it('souscrit au canal realtime et appelle removeChannel au démontage', async () => {
    const { useActivityReactions } = await import('./useActivityReactions')
    const builder = createChainableBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)

    const { unmount } = renderHook(() => useActivityReactions(['interaction:evt-1']), {
      wrapper: createWrapper(),
    })

    await waitFor(() =>
      expect(mockChannel).toHaveBeenCalledWith(
        expect.stringMatching(/^activity-reactions-rt-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/)
      )
    )

    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })

  it('toggle avec currently=false appelle insert', async () => {
    const { useActivityReactions } = await import('./useActivityReactions')
    const queryBuilder = createChainableBuilder({ data: reactionsData, error: null })
    mockFrom.mockReturnValue(queryBuilder)

    const { result } = renderHook(() => useActivityReactions(['interaction:evt-1']), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFrom.mockReset()
    const mutBuilder = createChainableBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(mutBuilder)

    await act(async () => {
      result.current.toggle('tache:task-2', '🚀', false)
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockFrom).toHaveBeenCalledWith('activity_feed_reactions')
    expect(mutBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ activity_key: 'tache:task-2', user_id: 'user-1', emoji: '🚀' })
    )
  })
})
