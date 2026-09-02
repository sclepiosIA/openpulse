import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useForumPosts,
  useForumPost,
  useCreateForumPost,
  useUpdateForumPost,
  useDeleteOwnPost,
  useToggleResolved,
  useVotePost,
} from './useForumPosts'

// Données stables via vi.hoisted — jamais recréées à chaque render
const { posts, mockFrom, mockNavigate, mockRpc, toastSuccess, toastError } = vi.hoisted(() => ({
  posts: [
    {
      id: 'post-1',
      titre: 'Comment configurer le DPI',
      contenu: 'Contenu du post 1',
      theme: 'technique',
      visibilite: 'public',
      upvotes: 12,
      nombre_commentaires: 3,
      nombre_vues: 87,
      resolu: false,
      epingle: false,
      archive: false,
      modere: false,
      author_nom: 'Dupont',
      author_prenom: 'Jean',
      author_role: 'admin',
      author_service: 'Cardiologie',
      author_etablissement_nom: 'CHU Lille',
      user_id: 'user-1',
      etablissement_id: 'etab-1',
      tags: ['dpi', 'configuration'],
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:00:00Z',
    },
    {
      id: 'post-2',
      titre: 'Problème de connexion',
      contenu: 'Contenu du post 2',
      theme: 'support',
      visibilite: 'interne',
      upvotes: 5,
      nombre_commentaires: 1,
      nombre_vues: 34,
      resolu: true,
      epingle: false,
      archive: false,
      modere: false,
      author_nom: 'Martin',
      author_prenom: 'Sophie',
      author_role: 'user',
      author_service: null,
      author_etablissement_nom: 'Clinique Sud',
      user_id: 'user-2',
      etablissement_id: 'etab-2',
      tags: [],
      created_at: '2024-01-09T08:00:00Z',
      updated_at: '2024-01-09T08:00:00Z',
    },
  ],
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockRpc: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
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
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    is: vi.fn(),
    then: (cb: (v: unknown) => unknown) => Promise.resolve(response).then(cb),
    catch: (cb: (e: unknown) => unknown) => Promise.resolve(response).catch(cb),
  }
  ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.limit as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.insert as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.delete as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.single as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.is as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  return builder
}

describe('useForumPosts', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('passe de isLoading à succès et retourne les posts avec titre et upvotes', async () => {
    const builder = createBuilder({ data: posts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumPosts(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].titre).toBe('Comment configurer le DPI')
    expect(result.current.data?.[0].upvotes).toBe(12)
    expect(result.current.data?.[1].resolu).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('RLS denied')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumPosts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })

  it('filtre par thème quand filters.theme est fourni', async () => {
    const builder = createBuilder({ data: [posts[0]], error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumPosts({ theme: 'technique' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('theme', 'technique')
  })

  it("trie par popularité quand sortBy='popular'", async () => {
    const builder = createBuilder({ data: posts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumPosts({ sortBy: 'popular' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.order as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('upvotes', {
      ascending: false,
    })
  })
})

describe('useForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('charge un post unique par id', async () => {
    const singlePost = posts[0]
    const builder = createBuilder({ data: singlePost, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumPost('post-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('post-1')
    expect(result.current.data?.titre).toBe('Comment configurer le DPI')
  })
})

describe('useCreateForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('insère le post et appelle toast.success', async () => {
    const newPost = { id: 'post-new', titre: 'Nouveau post', upvotes: 0 }
    const builder = createBuilder({ data: newPost, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        titre: 'Nouveau post',
        contenu: 'Contenu',
        theme: 'technique',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(toastSuccess).toHaveBeenCalledWith('Post créé avec succès')
  })

  it('appelle toast.error si la création échoue', async () => {
    const err = new Error('Contrainte violée')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useCreateForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ titre: 'Test' })
      } catch {
        // attendu
      }
    })

    expect(toastError).toHaveBeenCalled()
  })
})

describe('useUpdateForumPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
  })

  it('met à jour le post et appelle toast.success', async () => {
    const updatedPost = { ...posts[0], titre: 'Titre modifié' }
    const builder = createBuilder({ data: updatedPost, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useUpdateForumPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1', updates: { titre: 'Titre modifié' } })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(toastSuccess).toHaveBeenCalledWith('Post modifié avec succès')
  })
})

describe('useToggleResolved', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('appelle update sur forum_posts avec la valeur resolu', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleResolved(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1', resolu: true })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(builder.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ resolu: true })
  })
})

describe('useDeleteOwnPost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    mockNavigate.mockReset()
  })

  it('supprime le post et navigue vers /forum-moderation si isTeamMember', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useDeleteOwnPost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1', isTeamMember: true })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_posts')
    expect(toastSuccess).toHaveBeenCalledWith('Post supprimé')
    expect(mockNavigate).toHaveBeenCalledWith('/forum-moderation')
  })
})

describe('useVotePost', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockRpc.mockReset()
    localStorage.clear()
  })

  it('ajoute un vote (première fois) et appelle toast.success', async () => {
    // maybeSingle → pas de vote existant
    const checkBuilder = createBuilder({ data: null, error: null })
    const insertBuilder = createBuilder({ data: null, error: null })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return callCount <= 1 ? checkBuilder : insertBuilder
    })

    const { result } = renderHook(() => useVotePost(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1' })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_votes')
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Vote'))
  })

  it('lève une erreur si déjà voté (localStorage)', async () => {
    localStorage.setItem('voted_posts', JSON.stringify(['post-1']))

    const { result } = renderHook(() => useVotePost(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ postId: 'post-1' })
      } catch {
        // attendu
      }
    })

    expect(toastError).toHaveBeenCalledWith('Vous avez déjà voté pour ce post')
  })
})
