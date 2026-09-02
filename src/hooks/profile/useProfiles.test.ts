import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useProfiles,
  useActiveProfiles,
  useCurrentProfile,
  useCreateProfile,
  useUpdateProfile,
  useDeleteProfile
} from './useProfiles'

const {
  PROFILES_PUBLIC,
  UNSORTED_PROFILES,
  PROFILE_BY_USER,
  CREATED_PROFILE,
  UPDATED_PROFILE,
  OFFBOARD_OK,
  supabaseRpc,
  supabaseFromHandler,
  supabaseFunctionsInvoke,
  mockToast,
  mockUseAuth,
  mockDebugError,
  mockDebugWarn
} = vi.hoisted(() => {
  const PROFILES_PUBLIC = [
    { id: 'p1', user_id: 'u1', prenom: 'Alice', nom: 'Alpha', email: 'a@example.com', avatar_url: null, linkedin_url: null },
    { id: 'p2', user_id: 'u2', prenom: 'Bob', nom: 'Beta', email: 'b@example.com', avatar_url: null, linkedin_url: null },
  ]

  const UNSORTED_PROFILES = [
    { id: 'p3', user_id: 'u3', prenom: 'Charlie', nom: 'Zulu', email: 'c@example.com', avatar_url: null, linkedin_url: null },
    { id: 'p4', user_id: 'u4', prenom: 'Dana', nom: 'Alpha', email: 'd@example.com', avatar_url: null, linkedin_url: null },
  ]

  const PROFILE_BY_USER = {
    id: 'p1',
    user_id: 'u1',
    prenom: 'First',
    nom: 'User',
    email: 'first.user@example.com',
    actif: true,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2020-01-02T00:00:00Z',
    avatar_url: null,
    linkedin_url: null,
  }

  const CREATED_PROFILE = {
    id: 'p-created',
    user_id: 'u-created',
    prenom: 'New',
    nom: 'User',
    email: 'new.user@example.com',
    actif: true,
    created_at: '2021-01-01T00:00:00Z',
    updated_at: '2021-01-01T00:00:00Z',
    avatar_url: null,
    linkedin_url: null,
  }

  const UPDATED_PROFILE = {
    id: 'p1',
    user_id: 'u1',
    prenom: 'Updated',
    nom: 'User',
    email: 'first.user@example.com',
    actif: true,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2022-01-01T00:00:00Z',
    avatar_url: null,
    linkedin_url: null,
  }

  const OFFBOARD_OK = { user: 'offboarded@example.com' }

  const supabaseRpc = vi.fn()
  const supabaseFromHandler = vi.fn()
  const supabaseFunctionsInvoke = vi.fn()
  const mockToast = vi.fn()
  const mockUseAuth = vi.fn(() => ({ user: { id: 'u1', email: 'first.user@example.com' }, session: { user: { id: 'u1' } }, isLoading: false }))
  const mockDebugError = vi.fn()
  const mockDebugWarn = vi.fn()

  return {
    PROFILES_PUBLIC,
    UNSORTED_PROFILES,
    PROFILE_BY_USER,
    CREATED_PROFILE,
    UPDATED_PROFILE,
    OFFBOARD_OK,
    supabaseRpc,
    supabaseFromHandler,
    supabaseFunctionsInvoke,
    mockToast,
    mockUseAuth,
    mockDebugError,
    mockDebugWarn,
  }
})

vi.mock('@/lib/supabaseBrowser', () => {
  function createBuilder(table: string) {
    const state: Record<string, unknown> = { table }
    const builder: Record<string, any> = {
      select(...args: unknown[]) {
        state.op = 'select'
        state.selectArgs = args
        return builder
      },
      eq(key: string, value: unknown) {
        state.eq = { key, value }
        return builder
      },
      maybeSingle() {
        state.single = 'maybe'
        return builder
      },
      single() {
        state.single = 'single'
        return builder
      },
      insert(payload: unknown) {
        state.op = 'insert'
        state.payload = payload
        return builder
      },
      update(payload: unknown) {
        state.op = 'update'
        state.payload = payload
        return builder
      },
      delete() {
        state.op = 'delete'
        return builder
      },
      then(onFulfilled: unknown, onRejected: unknown) {
        // Ensure handler returns a stable promise
        return Promise.resolve(supabaseFromHandler(state)).then(onFulfilled as any, onRejected as any)
      },
      catch(onRejected: unknown) {
        return Promise.resolve(supabaseFromHandler(state)).catch(onRejected as any)
      }
    }
    return builder
  }

  return {
    supabase: {
      rpc: supabaseRpc,
      from: (table: string) => createBuilder(table),
      functions: {
        invoke: supabaseFunctionsInvoke
      }
    }
  }
})

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToast })
  }
})

vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => mockUseAuth()
  }
})

vi.mock('@/lib/debug', () => {
  return {
    debug: {
      error: mockDebugError,
      warn: mockDebugWarn
    }
  }
})

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))

describe('useProfiles suite', () => {
  let client: QueryClient

  function createQueryClient(): QueryClient {
    return new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    client = createQueryClient()
  })

  it('loads profiles successfully and returns provided profiles', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: PROFILES_PUBLIC, error: null })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const { result } = renderHook(() => useProfiles(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(PROFILES_PUBLIC)
    expect(supabaseRpc).toHaveBeenCalledWith('get_profiles_public')
    expect(mockDebugWarn).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('handles auth-required RPC error by returning empty array and warning but no toast', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'Authentication required for this resource' } })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const { result } = renderHook(() => useProfiles(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
    expect(mockDebugWarn).toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('catches thrown errors from RPC and shows a destructive toast and returns empty array', async () => {
    supabaseRpc.mockImplementationOnce(() => { throw new Error('network down') })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const { result } = renderHook(() => useProfiles(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les profils. Vérifiez vos permissions.',
      variant: 'destructive'
    })
    expect(mockDebugError).toHaveBeenCalled()
  })

  it('useActiveProfiles sorts profiles by nom and errors propagate to isError with toast', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: UNSORTED_PROFILES, error: null })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const { result, rerender } = renderHook(() => useActiveProfiles(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map(p => p.nom)).toEqual(['Alpha', 'Zulu'])

    supabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'some rpc error' } })

    await act(async () => {
      await client.invalidateQueries({ queryKey: ['active-profiles'] })
    })

    rerender()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les profils actifs',
      variant: 'destructive'
    })
  })

  it('useCurrentProfile returns user profile when authenticated', async () => {
    supabaseFromHandler.mockResolvedValueOnce({ data: PROFILE_BY_USER, error: null })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const { result } = renderHook(() => useCurrentProfile(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(PROFILE_BY_USER)
    expect(supabaseFromHandler).toHaveBeenCalled()
    const callArg = supabaseFromHandler.mock.calls[0][0]
    expect(callArg.table).toBe('profiles')
    expect(callArg.op).toBe('select')
    expect(callArg.eq).toBeDefined()
    expect((callArg.eq as { key: string; value: string }).key).toBe('user_id')
    expect((callArg.eq as { key: string; value: string }).value).toBe('u1')
  })

  it('useCreateProfile mutation inserts and invalidates queries and toasts on success', async () => {
    supabaseFromHandler.mockResolvedValueOnce({ data: CREATED_PROFILE, error: null })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const spyInvalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useCreateProfile(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        user_id: 'u-created',
        prenom: 'New',
        nom: 'User',
        email: 'new.user@example.com',
        actif: true
      })
    })

    expect(supabaseFromHandler).toHaveBeenCalled()
    expect(spyInvalidate).toHaveBeenCalled()
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['profiles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['active-profiles']))).toBe(true)
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Utilisateur créé avec succès'
    })
  })

  it('useUpdateProfile updates profile, calls RPC for role and invalidates multiple queries', async () => {
    supabaseFromHandler
      .mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null })
      .mockResolvedValueOnce({ data: UPDATED_PROFILE, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const spyInvalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateProfile(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', data: { prenom: 'Updated', role: 'admin' } })
    })

    expect(supabaseFromHandler).toHaveBeenCalled()
    expect(supabaseRpc).toHaveBeenCalledWith('update_user_role', { target_user_id: 'u1', new_role: 'admin' })
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['profiles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['active-profiles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['profiles-with-roles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['active-profiles-with-roles']))).toBe(true)
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Utilisateur mis à jour avec succès'
    })
  })

  it('useDeleteProfile invokes offboard edge function and invalidates queries and toasts on success', async () => {
    supabaseFunctionsInvoke.mockResolvedValueOnce({ data: OFFBOARD_OK, error: null })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const spyInvalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteProfile(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('p-delete')
    })

    expect(supabaseFunctionsInvoke).toHaveBeenCalledWith('offboard-user', { body: { target_profile_id: 'p-delete' } })
    expect(spyInvalidate).toHaveBeenCalled()
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['profiles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['active-profiles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['profiles-with-roles']))).toBe(true)
    expect(spyInvalidate.mock.calls.some(call => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['marque-team-calendars']))).toBe(true)
    expect(mockToast).toHaveBeenCalled()
    const toastArg = mockToast.mock.calls[0][0]
    expect(typeof toastArg.description).toBe('string')
    expect(toastArg.title).toBe('Offboarding terminé')
  })
})