import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useIsForumModerator,
  useForumPostsForModeration,
  useMaskForumPost,
  useDeleteForumPost,
  useApproveForumPost,
  useArchiveForumPost,
} from './useForumModeration'

const { mockFrom, mockRpc, toastSuccess, toastError } = vi.hoisted(() => ({
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

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'auth-user-1' } }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn() },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: Error) => e.message,
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
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: (cb: (v: unknown) => unknown) => Promise.resolve(response).then(cb),
    catch: (cb: (e: unknown) => unknown) => Promise.resolve(response).catch(cb),
  }
  ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.limit as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.delete as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.single as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  return builder
}

describe('useIsForumModerator', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it("retourne true si l'utilisateur est moderateur", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const { result } = renderHook(() => useIsForumModerator(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('is_forum_moderator')
  })

  it('retourne false (sans erreur) si la RPC renvoie une erreur', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('permission denied') })

    const { result } = renderHook(() => useIsForumModerator(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBe(false)
  })
})

describe('useForumPostsForModeration', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('charge tous les posts pour modération', async () => {
    const posts = [
      { id: 'post-1', titre: 'Post à modérer', modere: true, archive: false },
      { id: 'post-2', titre: 'Post normal', modere: false, archive: false },
    ]
    const builder = createBuilder({ data: posts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumPostsForModeration(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
  })
})

describe('useMaskForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('masque un post en passant modere=true après avoir récupéré le profil', async () => {
    const profileData = { id: 'profile-1' }
    const maskedPost = { id: 'post-1', modere: true }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Premier appel : profiles → maybeSingle
        return createBuilder({ data: profileData, error: null })
      }
      // Deuxième appel : forum_posts update → single
      return createBuilder({ data: maskedPost, error: null })
    })

    const { result } = renderHook(() => useMaskForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1', reason: 'Contenu inapproprié' })
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(toastSuccess).toHaveBeenCalledWith('Post masqué avec succès')
  })

  it('leve une erreur si le profil est introuvable', async () => {
    mockFrom.mockReturnValue(createBuilder({ data: null, error: null }))

    const { result } = renderHook(() => useMaskForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ postId: 'post-1' })
      } catch {
        // attendu
      }
    })

    expect(toastError).toHaveBeenCalled()
  })
})

describe('useDeleteForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
  })

  it('supprime définitivement un post et appelle toast.success', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('post-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(toastSuccess).toHaveBeenCalledWith('Post supprimé définitivement')
  })
})

describe('useApproveForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
  })

  it('approuve un post (modere=false) et appelle toast.success', async () => {
    const approvedPost = { id: 'post-1', modere: false }
    const builder = createBuilder({ data: approvedPost, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useApproveForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('post-1')
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(builder.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ modere: false })
    )
    expect(toastSuccess).toHaveBeenCalledWith('Post approuvé avec succès')
  })
})

describe('useArchiveForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
  })

  it('archive un post (archive=true) et appelle toast.success', async () => {
    const archivedPost = { id: 'post-1', archive: true }
    const builder = createBuilder({ data: archivedPost, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useArchiveForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('post-1')
    })

    expect(builder.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ archive: true })
    expect(toastSuccess).toHaveBeenCalledWith('Post archivé avec succès')
  })
})
