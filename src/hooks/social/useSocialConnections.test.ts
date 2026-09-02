import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSocialConnections } from './useSocialConnections'

const { connections, brandConnections, mockFrom } = vi.hoisted(() => ({
  connections: [
    {
      id: 'sc-1',
      brand_id: 'brand-1',
      platform: 'linkedin',
      status: 'active',
      external_user_id: 'ext-1',
      external_user_name: 'Alice',
      expires_at: null,
      last_refresh_at: null,
      last_error: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'sc-2',
      brand_id: 'brand-2',
      platform: 'instagram',
      status: 'expired',
      external_user_id: 'ext-2',
      external_user_name: 'Bob',
      expires_at: '2024-06-01T00:00:00Z',
      last_refresh_at: null,
      last_error: 'Token expired',
      created_at: '2023-12-01T00:00:00Z',
    },
  ],
  brandConnections: [
    {
      id: 'sc-3',
      brand_id: 'brand-xyz',
      platform: 'facebook',
      status: 'active',
      external_user_id: 'ext-3',
      external_user_name: 'Carol',
      expires_at: null,
      last_refresh_at: '2024-01-15T00:00:00Z',
      last_error: null,
      created_at: '2024-01-01T00:00:00Z',
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

describe('useSocialConnections', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et vérifie platform/status', async () => {
    const builder = createBuilder({ data: connections, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialConnections(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].platform).toBe('linkedin')
    expect(result.current.data?.[0].status).toBe('active')
    expect(result.current.data?.[1].status).toBe('expired')
    expect(result.current.data?.[1].last_error).toBe('Token expired')
    expect(mockFrom).toHaveBeenCalledWith('social_connections')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('platform')
  })

  it('expose isError quand la requête échoue', async () => {
    const err = new Error('connexion impossible')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialConnections(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })

  it("filtre par brandId via eq('brand_id')", async () => {
    const builder = createBuilder({ data: brandConnections, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSocialConnections('brand-xyz'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.[0].brand_id).toBe('brand-xyz')
    expect(result.current.data?.[0].platform).toBe('facebook')
    expect(builder.eq).toHaveBeenCalledWith('brand_id', 'brand-xyz')
  })
})
