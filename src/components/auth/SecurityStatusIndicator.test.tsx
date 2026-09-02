// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { SecurityStatusIndicator } from './SecurityStatusIndicator'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useUserRole } from '@/hooks/shared/useUserRole'

const {
  AUTH_STATE,
  ROLE_STATE,
  RPC_SUCCESS_CRITICAL,
  RPC_SUCCESS_WARNING,
  RPC_SUCCESS_SAFE,
  RPC_ERROR,
  mockRpc,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  } as {
    user: { id: string; email: string } | null
    session: { user: { id: string } } | null
    isLoading: boolean
  },
  ROLE_STATE: {
    isAdmin: true,
  } as {
    isAdmin: boolean
  },
  RPC_SUCCESS_CRITICAL: {
    data: [
      {
        check_name: 'Passwords',
        status: 'CRITICAL',
        details: 'Weak passwords found',
        recommendation: 'Enforce stronger passwords',
      },
      {
        check_name: 'Backups',
        status: 'WARNING',
        details: 'Old backup',
        recommendation: 'Refresh backup',
      },
      {
        check_name: 'MFA',
        status: 'CRITICAL',
        details: 'MFA disabled',
        recommendation: 'Enable MFA',
      },
    ],
    error: null,
  },
  RPC_SUCCESS_WARNING: {
    data: [
      {
        check_name: 'Backups',
        status: 'WARNING',
        details: 'Old backup',
        recommendation: 'Refresh backup',
      },
      {
        check_name: 'Logs',
        status: 'WARNING',
        details: 'Log retention low',
        recommendation: 'Increase retention',
      },
    ],
    error: null,
  },
  RPC_SUCCESS_SAFE: {
    data: [
      {
        check_name: 'MFA',
        status: 'OK',
        details: 'Enabled',
        recommendation: 'Keep enabled',
      },
    ],
    error: null,
  },
  RPC_ERROR: {
    data: null,
    error: { message: 'x' },
  },
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const result = { data: null, error: null }
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (
        onFulfilled?: ((value: typeof result) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(result).catch(onRejected ?? undefined),
      finally: (onFinally?: (() => void) | null) => Promise.resolve(result).finally(onFinally ?? undefined),
    }
    return builder
  }

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
      rpc: mockRpc,
    },
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}))

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: vi.fn(() => ROLE_STATE),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
}))

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="check-icon" {...props} />,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('SecurityStatusIndicator', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'user@test.local' }
    AUTH_STATE.session = { user: { id: 'u1' } }
    AUTH_STATE.isLoading = false
    ROLE_STATE.isAdmin = true
  })

  it('affiche rien pendant le chargement puis affiche le badge critique avec le bon libellé', async () => {
    let resolveRpc: ((value: typeof RPC_SUCCESS_CRITICAL) => void) | undefined

    mockRpc.mockImplementation(
      () =>
        new Promise<typeof RPC_SUCCESS_CRITICAL>((resolve) => {
          resolveRpc = resolve
        }),
    )

    const { container } = render(<SecurityStatusIndicator />, { wrapper: createWrapper() })

    expect(container).toBeEmptyDOMElement()
    expect(mockRpc).toHaveBeenCalledWith('get_security_compliance_report')

    resolveRpc?.(RPC_SUCCESS_CRITICAL)

    await waitFor(() => {
      expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'destructive')
    })

    expect(screen.getByText('2 Critiques')).toBeInTheDocument()
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
  })

  it('affiche un badge warning avec le nombre exact dalertes', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS_WARNING)

    render(<SecurityStatusIndicator />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('2 Alertes')).toBeInTheDocument()
    })

    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'secondary')
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
  })

  it('affiche sécurisé quand aucun warning ni critical', async () => {
    mockRpc.mockResolvedValue(RPC_SUCCESS_SAFE)

    render(<SecurityStatusIndicator />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Sécurisé')).toBeInTheDocument()
    })

    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
  })

  it('ne lance pas la requête et ne rend rien si utilisateur non admin', () => {
    ROLE_STATE.isAdmin = false

    const { container } = render(<SecurityStatusIndicator />, { wrapper: createWrapper() })

    expect(container).toBeEmptyDOMElement()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('ne lance pas la requête et ne rend rien si utilisateur absent', () => {
    AUTH_STATE.user = null

    const { container } = render(<SecurityStatusIndicator />, { wrapper: createWrapper() })

    expect(container).toBeEmptyDOMElement()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('passe en erreur react-query si la rpc échoue', async () => {
    mockRpc.mockResolvedValue(RPC_ERROR)

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => {
        const { user } = useAuth()
        const { isAdmin } = useUserRole()

        return useQuery({
          queryKey: ['security-compliance-report', user?.id],
          enabled: !!user && isAdmin,
          staleTime: 15 * 60 * 1000,
          gcTime: 30 * 60 * 1000,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          queryFn: async () => {
            const response = await supabase.rpc('get_security_compliance_report')
            if (response.error) throw response.error
            return response.data || []
          },
        })
      },
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toMatchObject({ message: 'x' })
    expect(result.current.data).toBeUndefined()
    expect(mockRpc).toHaveBeenCalledWith('get_security_compliance_report')
  })
})