import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useForumBookmarks,
  useToggleBookmark,
  useForumUserStats,
  useTopContributors,
} from './useForumBookmarks'

const { mockFrom, mockEtablissementUser, toastSuccess, toastError } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockEtablissementUser: {
    id: 'etab-user-1',
    nom: 'Dupont',
    prenom: 'Jean',
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../crm/useEtablissementUser', () => ({
  useEtablissementUser: () => ({ etablissementUser: mockEtablissementUser }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
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
    delete: vi.fn(),
    maybeSingle: vi.fn(),
    then: (cb: (v: unknown) => unknown) => Promise.resolve(response).then(cb),
    catch: (cb: (e: unknown) => unknown) => Promise.resolve(response).catch(cb),
  }
  ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.limit as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  ;(builder.delete as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(response)
  return builder
}

describe('useForumBookmarks', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('retourne la liste des post_id mis en favoris', async () => {
    const bookmarksData = [{ post_id: 'post-1' }, { post_id: 'post-3' }]
    const builder = createBuilder({ data: bookmarksData, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumBookmarks(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(['post-1', 'post-3'])
    expect(mockFrom).toHaveBeenCalledWith('forum_bookmarks')
    expect(builder.eq as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('user_id', 'etab-user-1')
  })

  it('expose isError si la requête échoue', async () => {
    const err = new Error('timeout')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumBookmarks(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useToggleBookmark', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it('ajoute un favori (isBookmarked=false) et affiche le toast', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleBookmark(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1', isBookmarked: false })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_bookmarks')
    expect(builder.insert as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
      user_id: 'etab-user-1',
      post_id: 'post-1',
    })
    expect(toastSuccess).toHaveBeenCalledWith('Ajouté aux favoris')
  })

  it('retire un favori (isBookmarked=true) et affiche le toast', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleBookmark(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ postId: 'post-1', isBookmarked: true })
    })

    expect(mockFrom).toHaveBeenCalledWith('forum_bookmarks')
    expect(toastSuccess).toHaveBeenCalledWith('Retiré des favoris')
  })

  it("appelle toast.error si l'operation échoue", async () => {
    const err = new Error('FK violation')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useToggleBookmark(), { wrapper: createWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ postId: 'post-1', isBookmarked: false })
      } catch {
        // attendu
      }
    })

    expect(toastError).toHaveBeenCalled()
  })
})

describe('useForumUserStats', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('charge les stats pour un userId donné', async () => {
    const stats = {
      id: 'stats-1',
      user_id: 'user-1',
      posts_count: 5,
      comments_count: 12,
      total_upvotes_received: 34,
      reputation_score: 150,
      badges: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    const builder = createBuilder({ data: stats, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useForumUserStats('user-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.posts_count).toBe(5)
    expect(result.current.data?.reputation_score).toBe(150)
    expect(mockFrom).toHaveBeenCalledWith('forum_user_stats')
  })

  it('ne charge pas si userId est undefined (disabled)', () => {
    const { result } = renderHook(() => useForumUserStats(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useTopContributors', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('charge les top contributeurs (limit=5 par défaut)', async () => {
    const contributors = [
      {
        id: 'stats-1',
        user_id: 'user-1',
        reputation_score: 500,
        etablissement_users: { nom: 'Dupont', prenom: 'Jean', fonction: 'Médecin' },
      },
    ]
    const builder = createBuilder({ data: contributors, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useTopContributors(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(builder.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(5)
    expect(mockFrom).toHaveBeenCalledWith('forum_user_stats')
  })

  it('passe un limit custom (3)', async () => {
    const builder = createBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useTopContributors(3), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.limit as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(3)
  })
})
