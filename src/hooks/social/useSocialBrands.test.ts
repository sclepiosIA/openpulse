import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSocialBrands } from './useSocialBrands'

const { socialBrands, mockFrom } = vi.hoisted(() => ({
  socialBrands: [
    {
      id: '1',
      slug: 'brand-a',
      name: 'Brand A',
      tagline: 'Tagline A',
      description: 'Description A',
      color_hex: '#111111',
      logo_url: 'https://cdn.example.com/a.png',
      is_active: true,
      is_anonymous: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
    },
    {
      id: '2',
      slug: 'brand-b',
      name: 'Brand B',
      tagline: 'Tagline B',
      description: 'Description B',
      color_hex: '#222222',
      logo_url: 'https://cdn.example.com/b.png',
      is_active: false,
      is_anonymous: true,
      created_at: '2023-02-01T00:00:00Z',
      updated_at: '2023-02-02T00:00:00Z',
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

function createBuilder(orderResponse: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    order: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.order.mockResolvedValue(orderResponse)
  return builder
}

describe('useSocialBrands', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et vérifie name/slug/is_active', async () => {
    const builder = createBuilder({ data: socialBrands, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialBrands(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].name).toBe('Brand A')
    expect(result.current.data?.[0].slug).toBe('brand-a')
    expect(result.current.data?.[0].is_active).toBe(true)
    expect(result.current.data?.[1].is_active).toBe(false)
    expect(result.current.data?.[1].is_anonymous).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('social_brands')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('name')
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('réseau indisponible')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialBrands(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBe(err)
    expect(result.current.data).toBeUndefined()
  })

  it('retourne [] si data est null', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialBrands(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
