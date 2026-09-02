import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useScheduledPosts } from './useScheduledPosts'

const { scheduledPosts, brandPosts, mockError, mockFrom } = vi.hoisted(() => ({
  scheduledPosts: [
    { id: 'p1', brand_id: 'b1', scheduled_at: '2024-01-10T10:00:00Z', message: 'Post 1' },
    { id: 'p2', brand_id: 'b2', scheduled_at: '2024-01-11T10:00:00Z', message: 'Post 2' },
  ],
  brandPosts: [
    {
      id: 'p3',
      brand_id: 'brand-42',
      scheduled_at: '2024-02-01T09:00:00Z',
      message: 'Brand 42 Post',
    },
  ],
  mockError: { message: 'Database failure' },
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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
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

describe('useScheduledPosts', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et retourne les posts planifiés sans filtre de marque', async () => {
    const builder = createBuilder({ data: scheduledPosts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useScheduledPosts(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(scheduledPosts)
    expect(result.current.data).toHaveLength(2)
    expect(mockFrom).toHaveBeenCalledWith('social_scheduled_posts')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).not.toHaveBeenCalled()
    expect(builder.order).toHaveBeenCalledWith('scheduled_at', {
      ascending: true,
      nullsFirst: false,
    })
    expect(builder.limit).toHaveBeenCalledWith(100)
  })

  it('applique le filtre brandId quand fourni', async () => {
    const builder = createBuilder({ data: brandPosts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useScheduledPosts('brand-42'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(brandPosts)
    expect(result.current.data?.[0].brand_id).toBe('brand-42')
    expect(builder.eq).toHaveBeenCalledWith('brand_id', 'brand-42')
    expect(builder.order).toHaveBeenCalledWith('scheduled_at', {
      ascending: true,
      nullsFirst: false,
    })
  })

  it('expose isError quand la requête échoue', async () => {
    const builder = createBuilder({ data: null, error: mockError })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useScheduledPosts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(mockError)
    expect(result.current.data).toBeUndefined()
  })
})
