/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useProfilesWithRoles,
  useActiveProfilesWithRoles,
  useCurrentProfileWithRole,
} from './useProfilesWithRoles'

const {
  PROFILES_WITH_ROLES,
  ACTIVE_PROFILES_WITH_ROLES,
  CURRENT_PROFILE,
  CURRENT_ROLE,
  AUTH_STATE,
  toastFn,
  debugError,
  debugWarn,
  mockRpc,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  PROFILES_WITH_ROLES: [
    {
      id: 'p1',
      user_id: 'u1',
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'jean@example.test',
      actif: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      role: 'admin' as const,
      telephone: '0102030405',
      fonction: 'Manager',
      date_embauche: '2023-01-10',
      type_contrat: 'cdi' as const,
      salaire_brut: 45000,
      avatar_url: null,
      linkedin_url: 'https://lnkd.test/jean',
    },
    {
      id: 'p2',
      user_id: 'u2',
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice@example.test',
      actif: false,
      created_at: '2024-02-01',
      updated_at: '2024-02-02',
      role: 'commercial' as const,
      telephone: null,
      fonction: 'Sales',
      date_embauche: null,
      type_contrat: 'freelance' as const,
      salaire_brut: null,
      avatar_url: null,
      linkedin_url: null,
    },
  ],
  ACTIVE_PROFILES_WITH_ROLES: [
    {
      id: 'p1',
      user_id: 'u1',
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'jean@example.test',
      actif: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      role: 'admin' as const,
      telephone: '0102030405',
      fonction: 'Manager',
      date_embauche: '2023-01-10',
      type_contrat: 'cdi' as const,
      salaire_brut: 45000,
      avatar_url: null,
      linkedin_url: 'https://lnkd.test/jean',
    },
  ],
  CURRENT_PROFILE: {
    id: 'p1',
    user_id: 'u1',
    nom: 'Dupont',
    prenom: 'Jean',
    email: 'jean@example.test',
    telephone: '0102030405',
    fonction: 'Manager',
    actif: true,
    avatar_url: null,
    linkedin_url: 'https://lnkd.test/jean',
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
    date_embauche: '2023-01-10',
    type_contrat: 'cdi' as const,
  },
  CURRENT_ROLE: { role: 'direction' as const },
  AUTH_STATE: {
    user: { id: 'u1', email: 'jean@example.test' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastFn: vi.fn(),
  debugError: vi.fn(),
  debugWarn: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    reference: {
      staleTime: 30 * 60 * 1000,
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    warn: debugWarn,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: (
      onFulfilled?: ((value: { data: null; error: null }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) =>
      Promise.resolve({ data: null, error: null }).then(
        onFulfilled ?? undefined,
        onRejected ?? undefined
      ),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected ?? undefined),
  }

  mockSelect.mockImplementation(() => builder)
  mockEq.mockImplementation(() => builder)
  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  }
}

describe('useProfilesWithRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'jean@example.test' }
    mockRpc.mockResolvedValue({ data: PROFILES_WITH_ROLES, error: null })
  })

  it('passe de isLoading à succès et retourne les profils avec rôles', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useProfilesWithRoles(), {
      wrapper,
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledWith('get_profiles_with_roles')
    expect(result.current.data).toEqual(PROFILES_WITH_ROLES)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'p1',
      user_id: 'u1',
      prenom: 'Jean',
      nom: 'Dupont',
      role: 'admin',
      actif: true,
    })
    expect(result.current.data?.[1]).toMatchObject({
      id: 'p2',
      user_id: 'u2',
      prenom: 'Alice',
      role: 'commercial',
      actif: false,
    })
    expect(toastFn).not.toHaveBeenCalled()
  })

  it('retourne un tableau vide et déclenche debug + toast quand le rpc échoue', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useProfilesWithRoles(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledWith('get_profiles_with_roles')
    expect(debugError).toHaveBeenCalledWith('Error loading profiles with roles:', {
      message: 'rpc failed',
    })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les profils avec leurs rôles',
      variant: 'destructive',
    })
    expect(result.current.data).toEqual([])
    expect(result.current.isError).toBe(false)
  })
})

describe('useActiveProfilesWithRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'jean@example.test' }
    mockRpc.mockResolvedValue({ data: ACTIVE_PROFILES_WITH_ROLES, error: null })
  })

  it('charge les profils actifs avec leurs rôles', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useActiveProfilesWithRoles(), {
      wrapper,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledWith('get_active_profiles_with_roles')
    expect(result.current.data).toEqual(ACTIVE_PROFILES_WITH_ROLES)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]).toMatchObject({
      id: 'p1',
      actif: true,
      role: 'admin',
      email: 'jean@example.test',
    })
    expect(toastFn).not.toHaveBeenCalled()
  })

  it('retourne un tableau vide et déclenche debug + toast quand le rpc actif échoue', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'active failed' },
    })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useActiveProfilesWithRoles(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledWith('get_active_profiles_with_roles')
    expect(debugError).toHaveBeenCalledWith('Error loading active profiles with roles:', {
      message: 'active failed',
    })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les profils actifs',
      variant: 'destructive',
    })
    expect(result.current.data).toEqual([])
    expect(result.current.isError).toBe(false)
  })
})

describe('useCurrentProfileWithRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'jean@example.test' }
    mockMaybeSingle.mockResolvedValue({ data: CURRENT_PROFILE, error: null })
    mockSingle.mockResolvedValue({ data: CURRENT_ROLE, error: null })
  })

  it('charge le profil courant puis son rôle', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCurrentProfileWithRole(), {
      wrapper,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'profiles')
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'user_roles')
    expect(mockSelect).toHaveBeenNthCalledWith(
      1,
      'id, user_id, nom, prenom, email, telephone, fonction, actif, avatar_url, linkedin_url, created_at, updated_at, date_embauche, type_contrat'
    )
    expect(mockSelect).toHaveBeenNthCalledWith(2, 'role')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
    expect(mockSingle).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual({
      ...CURRENT_PROFILE,
      role: 'direction',
    })
    expect(result.current.data?.prenom).toBe('Jean')
    expect(result.current.data?.nom).toBe('Dupont')
    expect(result.current.data?.role).toBe('direction')
    expect(result.current.data?.type_contrat).toBe('cdi')
    expect(toastFn).not.toHaveBeenCalled()
  })

  it('retourne null si aucun utilisateur authentifié', async () => {
    AUTH_STATE.user = null

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCurrentProfileWithRole(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockMaybeSingle).not.toHaveBeenCalled()
    expect(mockSingle).not.toHaveBeenCalled()
    expect(toastFn).not.toHaveBeenCalled()
  })

  it('passe en erreur si la récupération du profil échoue', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'profile failed' },
    })

    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useCurrentProfileWithRole(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(debugWarn).toHaveBeenCalledWith('Profile fetch error:', { message: 'profile failed' })
    expect(result.current.error).toEqual({ message: 'profile failed' })
    expect(mockSingle).not.toHaveBeenCalled()
    expect(toastFn).not.toHaveBeenCalled()
  })
})
