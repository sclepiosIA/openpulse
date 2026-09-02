import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSocialComments } from './useSocialComments'

// Données stables hoisted pour éviter les boucles de re-render
const { pendingComments, brandComments, mockFrom } = vi.hoisted(() => ({
  pendingComments: [
    {
      id: 'c1',
      post_id: 'post-1',
      brand_id: 'brand-1',
      platform: 'facebook',
      external_id: 'fb-ext-1',
      parent_external_id: null,
      author_name: 'Jane Doe',
      author_id: 'author-1',
      message: 'Bonjour, question ici',
      created_time: '2024-01-10T10:00:00Z',
      likes_count: 2,
      is_hidden: false,
      is_handled: false,
      handled_at: null,
    },
  ],
  brandComments: [
    {
      id: 'c2',
      post_id: 'post-2',
      brand_id: 'brand-specific',
      platform: 'instagram',
      external_id: 'ig-ext-2',
      parent_external_id: null,
      author_name: 'John Smith',
      author_id: 'author-2',
      message: 'Super post !',
      created_time: '2024-01-11T11:00:00Z',
      likes_count: 5,
      is_hidden: false,
      is_handled: false,
      handled_at: null,
    },
  ],
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/lib/supabaseSocial', () => ({
  socialClient: { from: mockFrom },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// Le hook utilise un builder chaînable qui se termine par await q (then)
// On crée un proxy thenable pour simuler la résolution finale
function createThenableBuilder(response: { data: unknown; error: unknown }) {
  const eqSpy = vi.fn()
  const builder: Record<string, unknown> = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: eqSpy,
    then: (cb: (v: unknown) => unknown) => Promise.resolve(response).then(cb),
    catch: (cb: (e: unknown) => unknown) => Promise.resolve(response).catch(cb),
  }
  ;(builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  ;(builder.limit as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  eqSpy.mockReturnValue(builder)
  return { builder, eqSpy }
}

describe('useSocialComments', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et retourne les commentaires pending avec platform/author_name', async () => {
    const { builder } = createThenableBuilder({ data: pendingComments, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialComments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].platform).toBe('facebook')
    expect(result.current.data?.[0].author_name).toBe('Jane Doe')
    expect(result.current.data?.[0].is_handled).toBe(false)
    expect(mockFrom).toHaveBeenCalledWith('social_comments')
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('erreur réseau')
    const { builder } = createThenableBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialComments(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })

  it('filtre par brandId quand fourni', async () => {
    const { builder, eqSpy } = createThenableBuilder({ data: brandComments, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialComments('brand-specific'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.[0].brand_id).toBe('brand-specific')
    expect(eqSpy).toHaveBeenCalledWith('brand_id', 'brand-specific')
    // handled="pending" par défaut → eq is_handled false
    expect(eqSpy).toHaveBeenCalledWith('is_handled', false)
  })

  it('ne filtre pas is_handled quand handled="all"', async () => {
    const { builder, eqSpy } = createThenableBuilder({ data: pendingComments, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialComments(undefined, 'all'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(eqSpy).not.toHaveBeenCalledWith('is_handled', false)
  })
})
