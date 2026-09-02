import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForumComments, useCreateForumComment, useVoteComment } from './useForumComments'

const { comments, mockFrom, mockRpc, toastSuccess, toastError } = vi.hoisted(() => ({
  comments: [
    {
      id: 'comment-1',
      post_id: 'post-1',
      parent_comment_id: null,
      user_id: 'user-1',
      contenu: 'Super post !',
      upvotes: 3,
      created_at: '2024-01-10T11:00:00Z',
      updated_at: '2024-01-10T11:00:00Z',
    },
    {
      id: 'comment-2',
      post_id: 'post-1',
      parent_comment_id: 'comment-1',
      user_id: 'user-2',
      contenu: "Je suis d'accord",
      upvotes: 1,
      created_at: '2024-01-10T12:00:00Z',
      updated_at: '2024-01-10T12:00:00Z',
    },
  ],
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

const waitForOptions = { timeout: 3000 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReset()
  mockRpc.mockReset()
  toastSuccess.mockClear()
  toastError.mockClear()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals?.()
  vi.unstubAllEnvs?.()
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function createBuilder(response: { data: unknown; error: unknown }) {
  const resolved = Promise.resolve(response)

  const builder: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    is: vi.fn(),
    delete: vi.fn(),
    limit: vi.fn(),
    then: (
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => resolved.then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => resolved.catch(onRejected),
  }

  ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.insert as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.single as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.is as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.delete as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.limit as ReturnType<typeof vi.fn>).mockResolvedValue(response)

  return builder
}

describe('useForumComments', () => {
  it("charge les commentaires et construit l'arbre (comment-2 est reply de comment-1)", async () => {
    const builder = createBuilder({ data: comments, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumComments('post-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toBeDefined()
    }, waitForOptions)

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('comment-1')
    expect(result.current.data?.[0].replies).toHaveLength(1)
    expect(result.current.data?.[0].replies?.[0].id).toBe('comment-2')
    expect(mockFrom).toHaveBeenCalledWith('forum_comments')
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('Accès refusé')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumComments('post-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true), waitForOptions)
    expect(result.current.error).toBe(err)
  })

  it("n'appelle pas supabase si postId est vide (disabled)", () => {
    const { result } = renderHook(() => useForumComments(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useCreateForumComment', () => {
  it('crée un commentaire et incrémente le compteur via rpc', async () => {
    const newComment = { id: 'comment-new', contenu: 'Nouveau commentaire', upvotes: 0 }
    mockRpc.mockResolvedValue({ data: null, error: null })
    const builder = createBuilder({ data: newComment, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateForumComment(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({
        post_id: 'post-1',
        user_id: 'user-1',
        contenu: 'Nouveau commentaire',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), waitForOptions)

    expect(mockFrom).toHaveBeenCalledWith('forum_comments')
    expect(mockRpc).toHaveBeenCalledWith('increment_comment_count', { post_id: 'post-1' })
  })

  it("lève une erreur si l'insert supabase échoue", async () => {
    const err = new Error('Contrainte violée')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateForumComment(), {
      wrapper: createWrapper(),
    })

    let thrownError: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync({
          post_id: 'post-1',
          user_id: 'user-1',
          contenu: 'Test',
        })
      } catch (error) {
        thrownError = error
      }
    })

    expect(thrownError).toBe(err)
    await waitFor(() => expect(result.current.isError).toBe(true), waitForOptions)
  })
})

describe('useVoteComment', () => {
  it('ajoute un vote commentaire (première fois)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'forum_comments') {
        return createBuilder({ data: { post_id: 'post-1' }, error: null })
      }

      if (table === 'forum_votes') {
        return createBuilder({ data: null, error: null })
      }

      return createBuilder({ data: null, error: null })
    })

    const { result } = renderHook(() => useVoteComment(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ commentId: 'comment-1' })
    })

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Vote'))
    }, waitForOptions)

    expect(JSON.parse(localStorage.getItem('voted_comments') || '[]')).toContain('comment-1')
    expect(mockFrom).toHaveBeenCalledWith('forum_comments')
    expect(mockFrom).toHaveBeenCalledWith('forum_votes')
  })

  it('lève une erreur si déjà voté (localStorage)', async () => {
    localStorage.setItem('voted_comments', JSON.stringify(['comment-1']))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'forum_comments') {
        return createBuilder({ data: { post_id: 'post-1' }, error: null })
      }

      return createBuilder({ data: null, error: null })
    })

    const { result } = renderHook(() => useVoteComment(), { wrapper: createWrapper() })

    await act(async () => {
      await expect(result.current.mutateAsync({ commentId: 'comment-1' })).rejects.toThrow(
        'Vous avez déjà voté pour ce commentaire',
      )
    })

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erreur lors du vote')
    }, waitForOptions)

    expect(JSON.parse(localStorage.getItem('voted_comments') || '[]')).toContain('comment-1')
    expect(mockFrom).toHaveBeenCalledWith('forum_comments')
  })
})