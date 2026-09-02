/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { use2FA } from './use2FA'

const {
  AUTH_USER,
  AUTH_SESSION,
  NO_SESSION,
  ENABLED_PROFILE,
  DISABLED_PROFILE,
  QUERY_ERROR,
  mockUseAuth,
  mockDebugError,
  mockDebugWarn,
  mockGetSession,
  mockListFactors,
  mockInvoke,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_USER = { id: 'u1', email: 't@t.co' }
  const AUTH_SESSION = {
    access_token: 'tok',
    user: { id: 'u1' },
  }
  const NO_SESSION = null
  const ENABLED_PROFILE = { two_factor_enabled: true }
  const DISABLED_PROFILE = { two_factor_enabled: false }
  const QUERY_ERROR = { message: 'x' }

  const mockUseAuth = vi.fn(() => ({
    user: AUTH_USER,
    session: { user: AUTH_USER },
    isLoading: false,
  }))

  const mockDebugError = vi.fn()
  const mockDebugWarn = vi.fn()
  const mockGetSession = vi.fn()
  const mockListFactors = vi.fn()
  const mockInvoke = vi.fn()
  const mockFrom = vi.fn()

  const state = {
    maybeSingleResult: { data: null as { two_factor_enabled?: boolean } | null, error: null as { message: string } | null },
    singleResult: { data: null as unknown, error: null as { message: string } | null },
  }

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
    single: vi.fn(() => Promise.resolve(state.singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(state.maybeSingleResult)),
    then: vi.fn((onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.maybeSingleResult).then(onFulfilled, onRejected)
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.maybeSingleResult).catch(onRejected)
    ),
    __setMaybeSingleResult: (value: { data: { two_factor_enabled?: boolean } | null; error: { message: string } | null }) => {
      state.maybeSingleResult = value
    },
    __reset: () => {
      state.maybeSingleResult = { data: null, error: null }
      state.singleResult = { data: null, error: null }
      builder.select.mockClear()
      builder.eq.mockClear()
      builder.gte.mockClear()
      builder.lte.mockClear()
      builder.in.mockClear()
      builder.order.mockClear()
      builder.limit.mockClear()
      builder.insert.mockClear()
      builder.update.mockClear()
      builder.delete.mockClear()
      builder.single.mockClear()
      builder.maybeSingle.mockClear()
      builder.then.mockClear()
      builder.catch.mockClear()
    },
  }

  return {
    AUTH_USER,
    AUTH_SESSION,
    NO_SESSION,
    ENABLED_PROFILE,
    DISABLED_PROFILE,
    QUERY_ERROR,
    mockUseAuth,
    mockDebugError,
    mockDebugWarn,
    mockGetSession,
    mockListFactors,
    mockInvoke,
    mockFrom,
    builder,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    warn: mockDebugWarn,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      mfa: { listFactors: mockListFactors },
    },
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
  },
}))

function createWrapper() {
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

describe('use2FA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builder.__reset()
    mockFrom.mockReturnValue(builder)
    mockUseAuth.mockReturnValue({
      user: AUTH_USER,
      session: { user: AUTH_USER },
      isLoading: false,
    })
    mockGetSession.mockResolvedValue({
      data: { session: AUTH_SESSION },
    })
    mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    mockInvoke.mockResolvedValue({
      data: { valid: true },
      error: null,
    })
  })

  it('gère validate2FAToken avec chargement puis succès', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    expect(result.current.isLoading).toBe(false)

    let promise: Promise<boolean> | undefined
    act(() => {
      promise = result.current.validate2FAToken('123456')
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    let value = false
    await act(async () => {
      value = await Promise.resolve(promise)
    })

    expect(value).toBe(true)
    expect(mockGetSession).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('generate-2fa-secret', {
      body: {
        action: 'validate',
        token: '123456',
      },
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('retourne false si aucune session pour validate2FAToken', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: NO_SESSION },
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = true
    await act(async () => {
      value = await result.current.validate2FAToken('654321')
    })

    expect(value).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('retourne false sur erreur de fonction dans validate2FAToken', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: QUERY_ERROR,
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = true
    await act(async () => {
      value = await result.current.validate2FAToken('000000')
    })

    expect(value).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('generate-2fa-secret', {
      body: {
        action: 'validate',
        token: '000000',
      },
      headers: {
        Authorization: 'Bearer tok',
      },
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('retourne false et loggue si validate2FAToken lève une exception', async () => {
    const err = new Error('x')
    mockGetSession.mockRejectedValue(err)

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = true
    await act(async () => {
      value = await result.current.validate2FAToken('111111')
    })

    expect(value).toBe(false)
    expect(mockDebugError).toHaveBeenCalledWith('Erreur validation 2FA:', err)
    expect(result.current.isLoading).toBe(false)
  })

  it('check2FAEnabled retourne true uniquement pour un facteur TOTP vérifié', async () => {
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = false
    await act(async () => {
      value = await result.current.check2FAEnabled()
    })

    expect(value).toBe(true)
    expect(mockListFactors).toHaveBeenCalledTimes(1)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('ignore un ancien booléen profil lorsqu’aucun facteur vérifié n’existe', async () => {
    builder.__setMaybeSingleResult({ data: ENABLED_PROFILE, error: null })
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: 'pending-1', status: 'unverified' }] },
      error: null,
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = true
    await act(async () => {
      value = await result.current.check2FAEnabled()
    })

    expect(value).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('retourne false et loggue si la lecture des facteurs échoue', async () => {
    const err = new Error('mfa unavailable')
    mockListFactors.mockRejectedValue(err)

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = true
    await act(async () => {
      value = await result.current.check2FAEnabled()
    })

    expect(value).toBe(false)
    expect(mockDebugError).toHaveBeenCalledWith('Erreur vérification 2FA:', err)
  })

  it('retourne false si aucun userId disponible', async () => {
    mockGetSession.mockResolvedValue({ data: { session: NO_SESSION } })
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false })

    const wrapper = createWrapper()
    const { result } = renderHook(() => use2FA(), { wrapper })

    let value = true
    await act(async () => {
      value = await result.current.check2FAEnabled()
    })

    expect(value).toBe(false)
    expect(mockListFactors).not.toHaveBeenCalled()
  })
})