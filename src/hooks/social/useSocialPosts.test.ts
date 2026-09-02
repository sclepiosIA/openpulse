import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSocialPosts } from './useSocialPosts'

const { posts, mockFrom } = vi.hoisted(() => ({
  posts: [
    {
      id: 'post-1',
      account_id: 'acc-1',
      brand_id: 'brand-1',
      platform: 'instagram',
      external_id: 'ext-1',
      permalink: 'https://instagram.com/p/1',
      message: 'Premier post',
      media_urls: ['https://img.example.com/1.jpg'],
      media_type: 'image',
      published_at: '2024-01-10T10:00:00Z',
      likes_count: 42,
      comments_count: 5,
      shares_count: 2,
      views_count: 350,
    },
    {
      id: 'post-2',
      account_id: 'acc-2',
      brand_id: 'brand-1',
      platform: 'linkedin',
      external_id: 'ext-2',
      permalink: 'https://linkedin.com/posts/2',
      message: 'Deuxième post',
      media_urls: [],
      media_type: null,
      published_at: '2024-01-09T08:00:00Z',
      likes_count: 18,
      comments_count: 3,
      shares_count: 7,
      views_count: 200,
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

function createBuilder(limitResponse: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockResolvedValue(limitResponse)
  return builder
}

describe('useSocialPosts', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et retourne les posts avec likes_count et platform', async () => {
    const builder = createBuilder({ data: posts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialPosts(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].platform).toBe('instagram')
    expect(result.current.data?.[0].likes_count).toBe(42)
    expect(result.current.data?.[1].platform).toBe('linkedin')
    expect(result.current.data?.[1].shares_count).toBe(7)
    expect(mockFrom).toHaveBeenCalledWith('social_posts')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('published_at', {
      ascending: false,
      nullsFirst: false,
    })
    expect(builder.limit).toHaveBeenCalledWith(25)
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('timeout base de données')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialPosts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })

  it('utilise un limit custom (50)', async () => {
    const builder = createBuilder({ data: posts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialPosts({ limit: 50 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.limit).toHaveBeenCalledWith(50)
    expect(builder.order).toHaveBeenCalledWith('published_at', {
      ascending: false,
      nullsFirst: false,
    })
  })

  it('filtre par brandId quand fourni', async () => {
    const builder = createBuilder({ data: [posts[0]], error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialPosts({ brandId: 'brand-1' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.eq).toHaveBeenCalledWith('brand_id', 'brand-1')
    expect(result.current.data?.[0].brand_id).toBe('brand-1')
  })
})
