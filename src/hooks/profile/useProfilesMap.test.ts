/* @vitest-environment jsdom */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProfilesMap } from './useProfilesMap'

const { RPC_ROWS, RPC_ERROR, mockRpc, mockFrom } = vi.hoisted(() => ({
  RPC_ROWS: [
    {
      id: 'p1',
      prenom: 'Ada',
      nom: 'Lovelace',
      email: 'ada@example.test',
      avatar_url: 'avatar-1',
      linkedin_url: 'linkedin-1',
    },
    {
      id: 'p2',
      prenom: '',
      nom: '',
      email: 'grace@example.test',
      avatar_url: null,
      linkedin_url: null,
    },
    {
      id: 'p3',
      prenom: 'Alan',
      nom: '',
      email: '',
      avatar_url: null,
      linkedin_url: 'linkedin-3',
    },
    {
      id: '',
      prenom: 'Ignored',
      nom: 'Profile',
      email: 'ignored@example.test',
      avatar_url: null,
      linkedin_url: null,
    },
  ],
  RPC_ERROR: { message: 'x' },
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (
        onFulfilled?: (value: { data: null; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  }
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useProfilesMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expose isLoading puis construit une map métier correcte après succès', async () => {
    mockRpc.mockResolvedValue({ data: RPC_ROWS, error: null })

    const { result } = renderHook(() => useProfilesMap(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.map.size).toBe(0)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('get_profiles_public')

    expect(result.current.map.size).toBe(3)

    expect(result.current.map.get('p1')).toEqual({
      id: 'p1',
      prenom: 'Ada',
      nom: 'Lovelace',
      full_name: 'Ada Lovelace',
      email: 'ada@example.test',
      avatar_url: 'avatar-1',
      linkedin_url: 'linkedin-1',
    })

    expect(result.current.map.get('p2')).toEqual({
      id: 'p2',
      prenom: '',
      nom: '',
      full_name: 'grace@example.test',
      email: 'grace@example.test',
      avatar_url: null,
      linkedin_url: null,
    })

    expect(result.current.map.get('p3')).toEqual({
      id: 'p3',
      prenom: 'Alan',
      nom: '',
      full_name: 'Alan',
      email: '',
      avatar_url: null,
      linkedin_url: 'linkedin-3',
    })

    expect(result.current.map.has('')).toBe(false)
  })

  it('retourne une map vide quand la rpc renvoie null data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useProfilesMap(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.map.size).toBe(0)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockRpc).toHaveBeenCalledWith('get_profiles_public')
    expect(result.current.map.size).toBe(0)
    expect(Array.from(result.current.map.keys())).toEqual([])
  })

  it('passe en erreur quand la rpc renvoie une erreur', async () => {
    mockRpc.mockResolvedValue({ data: null, error: RPC_ERROR })

    const { result } = renderHook(() => useProfilesMap(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.map.size).toBe(0)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('get_profiles_public')
    expect(result.current.map.size).toBe(0)
  })
})
