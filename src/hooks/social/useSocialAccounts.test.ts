import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSocialAccounts } from './useSocialAccounts'

const { accounts, brandAccounts, mockFrom } = vi.hoisted(() => ({
  accounts: [
    {
      id: 'acc-1',
      brand_id: 'brand-1',
      platform: 'instagram',
      display_name: 'Insta Account',
      followers_count: 1500,
      is_active: true,
    },
    {
      id: 'acc-2',
      brand_id: 'brand-2',
      platform: 'tiktok',
      display_name: 'TikTok Account',
      followers_count: 3200,
      is_active: true,
    },
  ],
  brandAccounts: [
    {
      id: 'acc-3',
      brand_id: 'brand-123',
      platform: 'facebook',
      display_name: 'FB Account',
      followers_count: 800,
      is_active: true,
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
    eq: vi.fn(),
    order: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockResolvedValue(orderResponse)
  return builder
}

describe('useSocialAccounts', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et retourne les comptes avec platform et followers_count', async () => {
    const builder = createBuilder({ data: accounts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialAccounts(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].platform).toBe('instagram')
    expect(result.current.data?.[0].followers_count).toBe(1500)
    expect(result.current.data?.[1].platform).toBe('tiktok')
    expect(result.current.data?.[1].followers_count).toBe(3200)
    expect(builder.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockFrom).toHaveBeenCalledWith('social_accounts')
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('connexion refusée')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialAccounts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBe(err)
    expect(result.current.data).toBeUndefined()
  })

  it('filtre par brandId quand fourni', async () => {
    const builder = createBuilder({ data: brandAccounts, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialAccounts('brand-123'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].brand_id).toBe('brand-123')
    expect(result.current.data?.[0].platform).toBe('facebook')
    expect(result.current.data?.[0].followers_count).toBe(800)
    expect(builder.eq).toHaveBeenCalledWith('is_active', true)
    expect(builder.eq).toHaveBeenCalledWith('brand_id', 'brand-123')
  })
})
