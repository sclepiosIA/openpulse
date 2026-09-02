import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocks must be defined before vi.mock calls due to hoisting
vi.mock('@/lib/supabaseBrowser', () => ({
  configureAuthSessionPersistence: vi.fn(),
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        // Immediately trigger auth state change with null session
        setTimeout(() => callback('INITIAL_SESSION', null), 0)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}))

vi.mock('@/lib/iframeDetection', () => ({
  isApercuTiers: () => false,
}))

import { AuthProvider, useAuth } from '@/components/AuthProvider'
import { configureAuthSessionPersistence, supabase } from '@/lib/supabaseBrowser'

// Test component that uses useAuth
function AuthConsumer() {
  const { user, session, loading, signIn, signOut } = useAuth()

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user?.email || 'no-user'}</div>
      <div data-testid="session">{session ? 'has-session' : 'no-session'}</div>
      <button onClick={() => signIn('test@test.com', 'password')}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}

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

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return auth context structure', async () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })

    // Check elements exist
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByTestId('user')).toBeInTheDocument()
    expect(screen.getByTestId('session')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('should show no-user when not authenticated', async () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })

    // User should show no-user (since session is null)
    await waitFor(
      () => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      },
      { timeout: 3000 }
    )
  })

  it('should call signInWithPassword when sign in button clicked', async () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })

    const signInButton = screen.getByText('Sign In')
    await act(async () => {
      signInButton.click()
    })

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password',
    })
    expect(configureAuthSessionPersistence).toHaveBeenCalledWith(true)
  })

  it('should call signOut when sign out button clicked', async () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })

    const signOutButton = screen.getByText('Sign Out')
    await act(async () => {
      signOutButton.click()
    })

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('should throw error when useAuth is used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<AuthConsumer />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('should have onAuthStateChange called on mount', () => {
    render(<AuthConsumer />, { wrapper: createWrapper() })

    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled()
  })
})
