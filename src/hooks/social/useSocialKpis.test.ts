import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSocialKpis } from './useSocialKpis'

// Données stables hoisted : 3 posts, 2 comptes
const { postsData, accountsData, mockUseSocialPosts, mockUseSocialAccounts } = vi.hoisted(() => ({
  postsData: [
    {
      id: 'p1',
      platform: 'instagram',
      likes_count: 10,
      comments_count: 0,
      shares_count: 0,
      views_count: 100,
    },
    {
      id: 'p2',
      platform: 'instagram',
      likes_count: 20,
      comments_count: 0,
      shares_count: 0,
      views_count: 200,
    },
    {
      id: 'p3',
      platform: 'tiktok',
      likes_count: 30,
      comments_count: 0,
      shares_count: 0,
      views_count: 300,
    },
  ],
  accountsData: [
    { id: 'a1', followers_count: 100 },
    { id: 'a2', followers_count: 200 },
  ],
  mockUseSocialPosts: vi.fn(),
  mockUseSocialAccounts: vi.fn(),
}))

vi.mock('./useSocialPosts', () => ({
  useSocialPosts: mockUseSocialPosts,
}))

vi.mock('./useSocialAccounts', () => ({
  useSocialAccounts: mockUseSocialAccounts,
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

describe('useSocialKpis', () => {
  beforeEach(() => {
    // État nominal par défaut
    mockUseSocialPosts.mockReturnValue({
      data: postsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseSocialAccounts.mockReturnValue({
      data: accountsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('retourne isLoading=true quand useSocialPosts charge encore', () => {
    mockUseSocialPosts.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useSocialKpis('brand-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)
  })

  it('calcule correctement totalEngagement=60, avgEngagementPerPost=20, byPlatform, totalFollowers', () => {
    const { result } = renderHook(() => useSocialKpis('brand-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)

    const { kpis } = result.current
    expect(kpis.postsCount).toBe(3)
    // 10 + 20 + 30 = 60
    expect(kpis.totalEngagement).toBe(60)
    // 60 / 3 = 20
    expect(kpis.avgEngagementPerPost).toBe(20)
    // 100 + 200 + 300 = 600
    expect(kpis.totalReach).toBe(600)
    // 100 + 200 = 300
    expect(kpis.totalFollowers).toBe(300)

    expect(kpis.byPlatform).toEqual({
      instagram: { posts: 2, engagement: 30 },
      tiktok: { posts: 1, engagement: 30 },
    })

    expect(kpis.recent).toHaveLength(3)
  })

  it('retourne 0 pour avgEngagementPerPost quand postsCount=0', () => {
    mockUseSocialPosts.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useSocialKpis(), {
      wrapper: createWrapper(),
    })

    expect(result.current.kpis.postsCount).toBe(0)
    expect(result.current.kpis.avgEngagementPerPost).toBe(0)
  })

  it('retourne isError=true si useSocialAccounts échoue', () => {
    const err = new Error('erreur comptes')
    mockUseSocialAccounts.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: err,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useSocialKpis('brand-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe(err)
  })
})
