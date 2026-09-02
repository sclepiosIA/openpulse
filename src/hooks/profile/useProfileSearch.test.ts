/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useProfileSearch } from './useProfileSearch'

type ProfileRow = {
  id: string
  user_id?: string | null
  nom: string | null
  prenom: string | null
  email: string | null
  avatar_url: string | null
}

type SupabaseResult<T> = {
  data: T | null
  error: { message: string } | null
}

const { SEARCH_ROWS, EMPTY_ROWS, mockFrom, mockSanitizePostgrestValue } = vi.hoisted(() => ({
  SEARCH_ROWS: [
    {
      id: 'p1',
      user_id: 'u1',
      nom: 'Dupont',
      prenom: 'Jean',
      email: 'jean.one@example.test',
      avatar_url: 'avatar-1',
    },
    {
      id: 'p2',
      user_id: 'u2',
      nom: 'Durand',
      prenom: 'Jeanne',
      email: 'jeanne.two@example.test',
      avatar_url: 'avatar-2',
    },
  ] as ProfileRow[],
  EMPTY_ROWS: [] as ProfileRow[],
  mockFrom: vi.fn(),
  mockSanitizePostgrestValue: vi.fn((value: string) => value),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: mockSanitizePostgrestValue,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createBuilder<T>(result: SupabaseResult<T>) {
  const builder = {
    select: vi.fn(() => builder),
    or: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled?: (value: SupabaseResult<T>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }
  return builder
}

function createRejectingBuilder(message: string) {
  const error = new Error(message)
  const builder = {
    select: vi.fn(() => builder),
    or: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => {
      throw error
    }),
    maybeSingle: vi.fn(async () => {
      throw error
    }),
    then: (
      onFulfilled?: (value: SupabaseResult<ProfileRow[]>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.reject(error).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.reject(error).catch(onRejected),
  }
  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      QueryClientProvider({ client: queryClient, children }),
    queryClient,
  }
}

describe('useProfileSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizePostgrestValue.mockImplementation((value: string) => value)
  })

  it('reste idle quand la recherche contient moins de 2 caractères', () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useProfileSearch('a'), { wrapper })

    expect(result.current.status).toBe('pending')
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockSanitizePostgrestValue).not.toHaveBeenCalled()
  })

  it('charge puis retourne les profils trouvés avec les colonnes par défaut', async () => {
    const builder = createBuilder<ProfileRow[]>({ data: SEARCH_ROWS, error: null })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useProfileSearch('je'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('profiles')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(builder.select).toHaveBeenCalledWith('id, nom, prenom, email, avatar_url')
    expect(mockSanitizePostgrestValue).toHaveBeenCalledTimes(3)
    expect(mockSanitizePostgrestValue).toHaveBeenNthCalledWith(1, 'je')
    expect(mockSanitizePostgrestValue).toHaveBeenNthCalledWith(2, 'je')
    expect(mockSanitizePostgrestValue).toHaveBeenNthCalledWith(3, 'je')
    expect(builder.or).toHaveBeenCalledWith('nom.ilike.%je%,prenom.ilike.%je%,email.ilike.%je%')
    expect(builder.limit).toHaveBeenCalledWith(10)
    expect(builder.neq).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([
      {
        id: 'p1',
        user_id: 'u1',
        nom: 'Dupont',
        prenom: 'Jean',
        email: 'jean.one@example.test',
        avatar_url: 'avatar-1',
      },
      {
        id: 'p2',
        user_id: 'u2',
        nom: 'Durand',
        prenom: 'Jeanne',
        email: 'jeanne.two@example.test',
        avatar_url: 'avatar-2',
      },
    ])
  })

  it('inclut user_id et exclut un utilisateur donné quand les options sont fournies', async () => {
    const builder = createBuilder<ProfileRow[]>({ data: SEARCH_ROWS, error: null })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()

    const { result } = renderHook(
      () =>
        useProfileSearch('du', {
          includeUserId: true,
          excludeUserId: 'u2',
          queryKey: 'group-member-search',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(builder.select).toHaveBeenCalledWith('id, user_id, nom, prenom, email, avatar_url')
    expect(builder.or).toHaveBeenCalledWith('nom.ilike.%du%,prenom.ilike.%du%,email.ilike.%du%')
    expect(builder.limit).toHaveBeenCalledWith(10)
    expect(builder.neq).toHaveBeenCalledWith('user_id', 'u2')
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data).toEqual(SEARCH_ROWS)
  })

  it('retourne un tableau vide quand Supabase renvoie data à null', async () => {
    const builder = createBuilder<ProfileRow[]>({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useProfileSearch('zz'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(EMPTY_ROWS)
    expect(builder.select).toHaveBeenCalledWith('id, nom, prenom, email, avatar_url')
    expect(builder.limit).toHaveBeenCalledWith(10)
  })

  it('passe en erreur si la requête Supabase rejette', async () => {
    const builder = createRejectingBuilder('x')
    mockFrom.mockReturnValue(builder)

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useProfileSearch('er'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe('x')
    expect(builder.select).toHaveBeenCalledWith('id, nom, prenom, email, avatar_url')
    expect(builder.or).toHaveBeenCalledWith('nom.ilike.%er%,prenom.ilike.%er%,email.ilike.%er%')
    expect(builder.limit).toHaveBeenCalledWith(10)
  })
})
