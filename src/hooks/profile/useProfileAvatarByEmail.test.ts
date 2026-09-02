// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useProfileAvatarByEmail } from './useProfileAvatarByEmail'

const { DIRECT_PROFILE, MAPPING_ROW, MAPPED_PROFILE, NULL_RESULT, ERROR_RESULT, mockFrom } =
  vi.hoisted(() => {
    const DIRECT_PROFILE = {
      id: 'p1',
      avatar_url: 'https://img/p1.png',
      prenom: 'Jane',
      nom: 'Doe',
    }

    const MAPPING_ROW = {
      profile_id: 'p2',
    }

    const MAPPED_PROFILE = {
      id: 'p2',
      avatar_url: null,
      prenom: 'John',
      nom: 'Smith',
    }

    const NULL_RESULT = { data: null, error: null }
    const ERROR_RESULT = { data: null, error: { message: 'x' } }
    const mockFrom = vi.fn()

    return {
      DIRECT_PROFILE,
      MAPPING_ROW,
      MAPPED_PROFILE,
      NULL_RESULT,
      ERROR_RESULT,
      mockFrom,
    }
  })

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

type Builder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: <TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) => Promise<QueryResult | TResult>
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

function createBuilder(steps: QueryResult[]): Builder {
  let stepIndex = 0
  let currentResult: QueryResult = steps[0] ?? NULL_RESULT

  const builder = {} as Builder

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)

  builder.single = vi.fn(async () => {
    const result = steps[stepIndex] ?? currentResult
    currentResult = result
    stepIndex += 1
    if (result.error) {
      throw result.error
    }
    return result
  })

  builder.maybeSingle = vi.fn(async () => {
    const result = steps[stepIndex] ?? currentResult
    currentResult = result
    stepIndex += 1
    if (result.error) {
      throw result.error
    }
    return result
  })

  builder.then = (onfulfilled, onrejected) => {
    const result = currentResult
    if (result.error) {
      return Promise.reject(result.error).then(onfulfilled ?? undefined, onrejected ?? undefined)
    }
    return Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  builder.catch = (onrejected) => {
    const result = currentResult
    if (result.error) {
      return Promise.reject(result.error).catch(onrejected ?? undefined)
    }
    return Promise.resolve(result).catch(onrejected ?? undefined)
  }

  return builder
}

describe('useProfileAvatarByEmail', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it("retourne le profil direct en normalisant l'email et passe de loading à success", async () => {
    const profilesBuilder = createBuilder([{ data: DIRECT_PROFILE, error: null }])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      return createBuilder([NULL_RESULT])
    })

    const { result } = renderHook(() => useProfileAvatarByEmail('  Jane.Doe@Example.com  '), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(profilesBuilder.select).toHaveBeenCalledWith('id, avatar_url, prenom, nom')
    expect(profilesBuilder.eq).toHaveBeenCalledWith('email', 'jane.doe@example.com')
    expect(profilesBuilder.maybeSingle).toHaveBeenCalledTimes(1)

    expect(result.current.data).toEqual({
      avatarUrl: 'https://img/p1.png',
      profileId: 'p1',
      displayName: 'Jane Doe',
    })
  })

  it("utilise le mapping equipe puis charge le profil mappé si aucun profil direct n'existe", async () => {
    const directProfilesBuilder = createBuilder([NULL_RESULT])
    const mappingBuilder = createBuilder([{ data: MAPPING_ROW, error: null }])
    const mappedProfilesBuilder = createBuilder([{ data: MAPPED_PROFILE, error: null }])

    let profilesCallCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesCallCount += 1
        return profilesCallCount === 1 ? directProfilesBuilder : mappedProfilesBuilder
      }

      if (table === 'email_specific_mappings') {
        return mappingBuilder
      }

      return createBuilder([NULL_RESULT])
    })

    const { result } = renderHook(() => useProfileAvatarByEmail('Jean Dupont <alias@team.test>'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'profiles')
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_specific_mappings')
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'profiles')

    expect(directProfilesBuilder.select).toHaveBeenCalledWith('id, avatar_url, prenom, nom')
    expect(directProfilesBuilder.eq).toHaveBeenCalledWith('email', 'alias@team.test')
    expect(mappingBuilder.select).toHaveBeenCalledWith('profile_id')
    expect(mappingBuilder.eq).toHaveBeenCalledWith('email_address', 'alias@team.test')
    expect(mappingBuilder.eq).toHaveBeenCalledWith('niveau_mapping', 'equipe')
    expect(mappedProfilesBuilder.select).toHaveBeenCalledWith('id, avatar_url, prenom, nom')
    expect(mappedProfilesBuilder.eq).toHaveBeenCalledWith('id', 'p2')

    expect(result.current.data).toEqual({
      avatarUrl: null,
      profileId: 'p2',
      displayName: 'John Smith',
    })
  })

  it('remonte une erreur React Query quand la requête supabase échoue', async () => {
    const profilesBuilder = createBuilder([ERROR_RESULT])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profilesBuilder
      }
      return createBuilder([NULL_RESULT])
    })

    const { result } = renderHook(() => useProfileAvatarByEmail('fail@test.io'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(profilesBuilder.select).toHaveBeenCalledWith('id, avatar_url, prenom, nom')
    expect(profilesBuilder.eq).toHaveBeenCalledWith('email', 'fail@test.io')
    expect(result.current.error).toEqual({ message: 'x' })
  })

  it("n'exécute aucune requête et reste idle pour un email invalide", () => {
    const { result } = renderHook(() => useProfileAvatarByEmail('pas-un-email'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
