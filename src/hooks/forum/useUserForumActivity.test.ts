import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUserForumActivity } from './useUserForumActivity'

const { postsData, commentsData, mockFrom } = vi.hoisted(() => ({
  postsData: [
    {
      id: 'post-1',
      titre: 'Mon premier post',
      theme: 'technique',
      upvotes: 8,
      nombre_commentaires: 2,
      created_at: '2024-01-10T10:00:00Z',
    },
    {
      id: 'post-2',
      titre: 'Mon deuxième post',
      theme: 'general',
      upvotes: 3,
      nombre_commentaires: 0,
      created_at: '2024-01-09T08:00:00Z',
    },
  ],
  commentsData: [
    {
      id: 'comment-1',
      upvotes: 5,
      created_at: '2024-01-11T09:00:00Z',
      forum_posts: { titre: "Post de quelqu'un d'autre" },
    },
  ],
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
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

// Builder qui gère 2 appels successifs (posts puis comments)
function createSequentialBuilders() {
  let callCount = 0

  const postsBuilder: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (cb: (v: unknown) => unknown) =>
      Promise.resolve({ data: postsData, error: null }).then(cb),
    catch: (cb: (e: unknown) => unknown) =>
      Promise.resolve({ data: postsData, error: null }).catch(cb),
  }
  ;(postsBuilder.select as ReturnType<typeof vi.fn>).mockReturnValue(postsBuilder)
  ;(postsBuilder.eq as ReturnType<typeof vi.fn>).mockReturnValue(postsBuilder)
  ;(postsBuilder.order as ReturnType<typeof vi.fn>).mockReturnValue(postsBuilder)

  const commentsBuilder: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (cb: (v: unknown) => unknown) =>
      Promise.resolve({ data: commentsData, error: null }).then(cb),
    catch: (cb: (e: unknown) => unknown) =>
      Promise.resolve({ data: commentsData, error: null }).catch(cb),
  }
  ;(commentsBuilder.select as ReturnType<typeof vi.fn>).mockReturnValue(commentsBuilder)
  ;(commentsBuilder.eq as ReturnType<typeof vi.fn>).mockReturnValue(commentsBuilder)
  ;(commentsBuilder.order as ReturnType<typeof vi.fn>).mockReturnValue(commentsBuilder)
  ;(commentsBuilder.limit as ReturnType<typeof vi.fn>).mockReturnValue(commentsBuilder)

  mockFrom.mockImplementation(() => {
    callCount++
    return callCount === 1 ? postsBuilder : commentsBuilder
  })
}

describe('useUserForumActivity', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('retourne posts, comments et totalUpvotes agrégés', async () => {
    createSequentialBuilders()

    const { result } = renderHook(() => useUserForumActivity('user-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.posts).toHaveLength(2)
    expect(result.current.data?.posts[0].titre).toBe('Mon premier post')
    expect(result.current.data?.comments).toHaveLength(1)
    expect(result.current.data?.comments[0].post_titre).toBe("Post de quelqu'un d'autre")
    expect(result.current.data?.comments[0].upvotes).toBe(5)

    // totalUpvotes = 8 + 3 (posts) + 5 (comments) = 16
    expect(result.current.data?.totalUpvotes).toBe(16)
    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(mockFrom).toHaveBeenCalledWith('forum_comments')
  })

  it('utilise "Post supprimé" si forum_posts est null dans un commentaire', async () => {
    const commentsWithNullPost = [
      {
        id: 'comment-orphan',
        upvotes: 1,
        created_at: '2024-01-12T00:00:00Z',
        forum_posts: null,
      },
    ]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const builder: Record<string, unknown> = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
      }
      const responseData = callCount === 1 ? [] : commentsWithNullPost
      ;(builder.then as unknown) = (cb: (v: unknown) => unknown) =>
        Promise.resolve({ data: responseData, error: null }).then(cb)
      ;(builder.catch as unknown) = (cb: (e: unknown) => unknown) =>
        Promise.resolve({ data: responseData, error: null }).catch(cb)
      ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
      ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
      ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
      ;(builder.limit as ReturnType<typeof vi.fn>).mockReturnValue(builder)
      return builder
    })

    const { result } = renderHook(() => useUserForumActivity('user-2'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.comments[0].post_titre).toBe('Post supprimé')
  })

  it('expose isError si la première requête échoue', async () => {
    const err = new Error('Accès refusé')
    const builder: Record<string, unknown> = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: err }).then(cb),
      catch: (cb: (e: unknown) => unknown) => Promise.resolve({ data: null, error: err }).catch(cb),
    }
    ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
    ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
    ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUserForumActivity('user-3'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })
})
