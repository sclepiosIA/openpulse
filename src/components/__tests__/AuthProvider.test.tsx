import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../AuthProvider'
import { supabase } from '@/integrations/supabase/client'

// Mock supabase
const mockOnAuthStateChange = vi.fn()
const mockGetSession = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockConfigureAuthSessionPersistence = vi.fn()
const mockSignOut = vi.fn()
const mockSignUp = vi.fn()
const mockRefreshSession = vi.fn()
const mockCheckTwoFactorRequired = vi.fn()
const mockCheckLegacyTwoFactorMigrationRequired = vi.fn()
const mockSetSession = vi.fn()
const mockListFactors = vi.fn()
const mockChallengeAndVerify = vi.fn()
const mockGetAuthenticatorAssuranceLevel = vi.fn()

vi.mock('@/lib/supabaseBrowser', () => ({
  configureAuthSessionPersistence: (...args: any[]) => mockConfigureAuthSessionPersistence(...args),
  supabase: {
    auth: {
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
      getSession: () => mockGetSession(),
      signInWithPassword: (opts: any) => mockSignInWithPassword(opts),
      signOut: (opts?: any) => mockSignOut(opts),
      signUp: (opts: any) => mockSignUp(opts),
      refreshSession: () => mockRefreshSession(),
      setSession: (session: any) => mockSetSession(session),
      mfa: {
        listFactors: () => mockListFactors(),
        challengeAndVerify: (input: any) => mockChallengeAndVerify(input),
        getAuthenticatorAssuranceLevel: () => mockGetAuthenticatorAssuranceLevel(),
      },
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/iframeDetection', () => ({
  isApercuTiers: () => false,
}))

vi.mock('@/hooks/auth/use2FA', () => ({
  checkTwoFactorRequired: (...args: any[]) => mockCheckTwoFactorRequired(...args),
  checkLegacyTwoFactorMigrationRequired: (...args: any[]) =>
    mockCheckLegacyTwoFactorMigrationRequired(...args),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

function AuthConsumer() {
  const { user, loading, twoFactorStatus, signIn, signOut } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? 'null'}</span>
      <span data-testid="two-factor-status">{twoFactorStatus}</span>
      <button onClick={() => signIn('test@test.com', 'pass')}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      sessionStorage.clear()
    } catch {}

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockCheckTwoFactorRequired.mockResolvedValue(false)
    mockCheckLegacyTwoFactorMigrationRequired.mockResolvedValue(false)
    mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    mockChallengeAndVerify.mockResolvedValue({ data: {}, error: null })
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    })
  })

  it('starts loading then resolves to not loading', async () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })
    // Initially loading (no cache)
    expect(screen.getByTestId('loading').textContent).toBe('true')

    await waitFor(
      () => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      },
      { timeout: 3000 }
    )
  })

  it('sets user from getSession', async () => {
    const mockUser = { id: '1', email: 'admin@test.com' }
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'tok' } },
      error: null,
    })

    render(<AuthConsumer />, { wrapper: createWrapper() })

    await waitFor(
      () => {
        expect(screen.getByTestId('user').textContent).toBe('admin@test.com')
      },
      { timeout: 3000 }
    )
  })

  it('does not publish an authenticated user before the 2FA requirement is decided', async () => {
    let resolveRequirement: ((required: boolean) => void) | undefined
    mockCheckTwoFactorRequired.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveRequirement = resolve
      })
    )
    const mockUser = { id: '1', email: 'admin@test.com' }
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'tok' } },
      error: null,
    })

    render(<AuthConsumer />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockCheckTwoFactorRequired).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('null')
    expect(screen.getByTestId('two-factor-status').textContent).toBe('checking')

    await act(async () => {
      resolveRequirement?.(true)
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('two-factor-status').textContent).toBe('required')
    })
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  it('ignore l’événement interne de setSession pendant le challenge MFA puis publie seulement AAL2', async () => {
    let authCallback: ((event: string, session: any) => void) | undefined
    const pendingSession = {
      user: { id: '1', email: 'admin@test.com' },
      access_token: 'aal1-token',
      refresh_token: 'refresh-token',
    }
    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    mockGetSession.mockResolvedValue({ data: { session: pendingSession }, error: null })
    mockCheckTwoFactorRequired.mockResolvedValue(true)
    mockGetAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({
        data: { currentLevel: 'aal1', nextLevel: 'aal2' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { currentLevel: 'aal2', nextLevel: 'aal2' },
        error: null,
      })
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })
    mockSetSession.mockImplementation(async () => {
      authCallback?.('TOKEN_REFRESHED', pendingSession)
      return { data: { session: pendingSession }, error: null }
    })

    function MfaConsumer() {
      const { user, twoFactorStatus, verify2FA } = useAuth()
      return (
        <div>
          <span data-testid="mfa-user">{user?.email ?? 'null'}</span>
          <span data-testid="mfa-status">{twoFactorStatus}</span>
          <button onClick={() => void verify2FA('123456')}>Verify MFA</button>
        </div>
      )
    }

    render(<MfaConsumer />, { wrapper: createWrapper() })
    await waitFor(() => expect(screen.getByTestId('mfa-status')).toHaveTextContent('required'))
    expect(screen.getByTestId('mfa-user')).toHaveTextContent('null')

    fireEvent.click(screen.getByText('Verify MFA'))

    await waitFor(() => expect(screen.getByTestId('mfa-status')).toHaveTextContent('verified'))
    expect(screen.getByTestId('mfa-user')).toHaveTextContent('admin@test.com')
    expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('calls signInWithPassword on signIn', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })

    render(<AuthConsumer />, { wrapper: createWrapper() })

    await waitFor(
      () => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      },
      { timeout: 3000 }
    )

    await userEvent.click(screen.getByText('Sign In'))

    expect(mockConfigureAuthSessionPersistence).toHaveBeenCalledWith(true)
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pass',
    })
  })

  it('configures session-only storage before password authentication', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })

    function SessionOnlyConsumer() {
      const { signIn } = useAuth()
      return <button onClick={() => signIn('session@test.com', 'pass', false)}>Session only</button>
    }

    render(<SessionOnlyConsumer />, { wrapper: createWrapper() })
    await userEvent.click(screen.getByText('Session only'))

    expect(mockConfigureAuthSessionPersistence).toHaveBeenCalledWith(false)
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'session@test.com',
      password: 'pass',
    })
    expect(mockConfigureAuthSessionPersistence.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignInWithPassword.mock.invocationCallOrder[0]
    )
  })

  it('returns an explicit error when signIn does not resolve quickly', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}))
    let signInResult: Awaited<ReturnType<ReturnType<typeof useAuth>['signIn']>> | undefined

    function TimeoutConsumer() {
      const { signIn } = useAuth()
      return (
        <button
          onClick={() => {
            void signIn('slow@test.com', 'pass').then((result) => {
              signInResult = result
            })
          }}
        >
          Slow Sign In
        </button>
      )
    }

    render(<TimeoutConsumer />, { wrapper: createWrapper() })
    fireEvent.click(screen.getByText('Slow Sign In'))

    act(() => {
      vi.advanceTimersByTime(26000)
    })

    await waitFor(() => {
      expect(signInResult?.error?.message).toMatch(/trop de temps|expir/i)
    })

    vi.useRealTimers()
  })

  it('calls supabase signOut on signOut', async () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })

    await waitFor(
      () => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      },
      { timeout: 3000 }
    )

    await userEvent.click(screen.getByText('Sign Out'))
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('updates user when auth state changes', async () => {
    let authCallback: any
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(<AuthConsumer />, { wrapper: createWrapper() })

    await waitFor(
      () => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      },
      { timeout: 3000 }
    )

    // Simulate sign in event
    act(() => {
      authCallback('SIGNED_IN', {
        user: { id: '2', email: 'new@test.com' },
        access_token: 'new-token',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('new@test.com')
    })
  })

  it('throws when useAuth is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })

  it('handles security timeout when no session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    // getSession never resolves
    mockGetSession.mockReturnValue(new Promise(() => {}))

    render(<AuthConsumer />, { wrapper: createWrapper() })
    expect(screen.getByTestId('loading').textContent).toBe('true')

    // Advance past security timeout (5s for non-iframe)
    act(() => {
      vi.advanceTimersByTime(6000)
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    vi.useRealTimers()
  })
})
