import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReactionCounts, useToggleReaction } from './useForumReactions'

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
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

function createBuilder(response: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    then: (cb: (v: unknown) => unknown) => Promise.resolve(response).then(cb),
    catch: (cb: (e: unknown) => unknown) => Promise.resolve(response).catch(cb),
  }
  ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.delete as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  return builder
}

describe('useReactionCounts', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('retourne les counts des réactions via RPC', async () => {
    const reactionData = { '👍': 5, '❤️': 2, '😂': 1 }
    mockRpc.mockResolvedValue({ data: reactionData, error: null })

    const { result } = renderHook(() => useReactionCounts('post-1', 'post'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.['👍']).toBe(5)
    expect(result.current.data?.['❤️']).toBe(2)
    expect(mockRpc).toHaveBeenCalledWith('get_reaction_counts', {
      target_id: 'post-1',
      target_type: 'post',
    })
  })

  it('retourne {} si la RPC renvoie null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useReactionCounts('post-1', 'post'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({})
  })

  it('expose isError si la RPC échoue', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC error') })

    const { result } = renderHook(() => useReactionCounts('post-1', 'post'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('fonctionne pour target_type comment', async () => {
    mockRpc.mockResolvedValue({ data: { '👍': 3 }, error: null })

    const { result } = renderHook(() => useReactionCounts('comment-1', 'comment'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_reaction_counts', {
      target_id: 'comment-1',
      target_type: 'comment',
    })
  })
})

describe('useToggleReaction', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it("ajoute une reaction si elle n'existait pas", async () => {
    // Les deux from('forum_reactions') appellent le même builder :
    // maybeSingle() → null (pas de réaction), insert() → succès
    const sharedBuilder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(sharedBuilder)

    const { result } = renderHook(() => useToggleReaction(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        targetId: 'post-1',
        targetType: 'post',
        emoji: '👍',
        userId: 'user-1',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_reactions')
    expect(result.current.isError).toBe(false)
  })

  it('supprime la réaction si elle existait déjà', async () => {
    // Premier from : maybeSingle → réaction existante
    const existingReaction = { id: 'reaction-1' }
    const checkBuilder = createBuilder({ data: existingReaction, error: null })
    const deleteBuilder = createBuilder({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(checkBuilder) // check existing
      .mockReturnValueOnce(deleteBuilder) // delete

    const { result } = renderHook(() => useToggleReaction(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        targetId: 'post-1',
        targetType: 'post',
        emoji: '👍',
        userId: 'user-1',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_reactions')
    expect(result.current.isError).toBe(false)
  })

  it('utilise post_id pour targetType=post et comment_id pour targetType=comment', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleReaction(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        targetId: 'comment-1',
        targetType: 'comment',
        emoji: '❤️',
        userId: 'user-2',
      })
    })

    expect(builder.eq as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('comment_id', 'comment-1')
  })
})
