/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminGuard } from './AdminGuard'

const {
  AUTH_STATE,
  TOAST_FN,
  DEBUG_ERROR,
  RPC_RESULTS,
  PROFILE_RESULT,
  mockRpc,
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    twoFactorStatus: 'verified',
    complete2FAEnrollment: vi.fn(async () => true),
  }

  const TOAST_FN = vi.fn()
  const DEBUG_ERROR = vi.fn()

  const RPC_RESULTS = {
    is_admin: { data: true, error: null as { message: string } | null },
    is_admin_strict: { data: true, error: null as { message: string } | null },
  }

  const PROFILE_RESULT = {
    data: { two_factor_enabled: true },
    error: null as { message: string } | null,
  }

  const mockRpc = vi.fn((fnName: string) => Promise.resolve(RPC_RESULTS[fnName as keyof typeof RPC_RESULTS]))
  const mockMaybeSingle = vi.fn(() => Promise.resolve(PROFILE_RESULT))
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))

  return {
    AUTH_STATE,
    TOAST_FN,
    DEBUG_ERROR,
    RPC_RESULTS,
    PROFILE_RESULT,
    mockRpc,
    mockFrom,
    mockSelect,
    mockEq,
    mockMaybeSingle,
  }
})

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  AlertDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => <button className={className} onClick={onClick}>{children}</button>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}))

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  Shield: () => <svg data-testid="icon-shield" />,
  Lock: () => <svg data-testid="icon-lock" />,
  CheckCircle2: () => <svg data-testid="icon-check-circle" />,
}))

vi.mock('@/components/auth/TwoFactorSetup', () => ({
  TwoFactorSetup: ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => (
    <div>
      <div>TwoFactorSetupMock</div>
      <button onClick={onComplete}>complete-2fa</button>
      <button onClick={onCancel}>cancel-2fa</button>
    </div>
  ),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderGuard(props?: Partial<React.ComponentProps<typeof AdminGuard>>) {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <AdminGuard {...props}>
        <div>zone admin</div>
      </AdminGuard>
    </Wrapper>
  )
}

describe('AdminGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'user@test.local' }
    AUTH_STATE.twoFactorStatus = 'verified'
    AUTH_STATE.complete2FAEnrollment.mockResolvedValue(true)
    RPC_RESULTS.is_admin = { data: true, error: null }
    RPC_RESULTS.is_admin_strict = { data: true, error: null }
    PROFILE_RESULT.data = { two_factor_enabled: true }
    PROFILE_RESULT.error = null
  })

  it('affiche un état de chargement puis autorise l’accès pour un admin strict avec 2FA', async () => {
    renderGuard({ operationName: 'le panneau admin' })

    expect(document.querySelector('.animate-spin')).toBeTruthy()

    await screen.findByText('zone admin')

    expect(screen.getByText('zone admin')).toBeInTheDocument()
    expect(mockRpc).toHaveBeenCalledWith('is_admin')
    expect(mockRpc).not.toHaveBeenCalledWith('is_admin_strict')
  })

  it('refuse l’accès si l’utilisateur n’est pas administrateur', async () => {
    RPC_RESULTS.is_admin = { data: false, error: null }
    RPC_RESULTS.is_admin_strict = { data: false, error: null }
    PROFILE_RESULT.data = { two_factor_enabled: false }

    renderGuard({ operationName: 'la suppression' })

    await screen.findByText('Accès refusé')

    expect(screen.getByText(/Vous n'avez pas les permissions d'administrateur nécessaires pour accéder à la suppression\./)).toBeInTheDocument()
    expect(screen.queryByText('zone admin')).not.toBeInTheDocument()
  })

  it('demande la configuration 2FA pour un admin sans 2FA puis revalide après complétion', async () => {
    RPC_RESULTS.is_admin = { data: true, error: null }
    RPC_RESULTS.is_admin_strict = { data: false, error: null }
    PROFILE_RESULT.data = { two_factor_enabled: false }
    AUTH_STATE.twoFactorStatus = 'not-required'

    renderGuard({ operationName: 'la gestion sensible', requireStrictAdmin: true })

    await screen.findByText('Configuration de sécurité requise')

    expect(screen.getByText(/Vous devez activer le 2FA avant d'accéder à la gestion sensible\./)).toBeInTheDocument()
    expect(screen.getByText('2FA Non Configuré')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Configurer le 2FA maintenant/i }))

    expect(await screen.findByText('TwoFactorSetupMock')).toBeInTheDocument()

    RPC_RESULTS.is_admin = { data: true, error: null }
    RPC_RESULTS.is_admin_strict = { data: true, error: null }
    PROFILE_RESULT.data = { two_factor_enabled: true }

    fireEvent.click(screen.getByRole('button', { name: 'complete-2fa' }))

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: '2FA activé avec succès',
        description: "Vous pouvez maintenant accéder aux fonctions d'administration",
      })
    })

    await screen.findByText('zone admin')
    expect(mockRpc).toHaveBeenCalledWith('is_admin')
    expect(AUTH_STATE.complete2FAEnrollment).toHaveBeenCalledTimes(1)
  })

  it('autorise l’accès si requireStrictAdmin est false même sans statut strict', async () => {
    RPC_RESULTS.is_admin = { data: true, error: null }
    RPC_RESULTS.is_admin_strict = { data: false, error: null }
    PROFILE_RESULT.data = { two_factor_enabled: false }
    AUTH_STATE.twoFactorStatus = 'not-required'

    renderGuard({ requireStrictAdmin: false })

    await screen.findByText('zone admin')

    expect(screen.getByText('zone admin')).toBeInTheDocument()
    expect(screen.queryByText('Configuration de sécurité requise')).not.toBeInTheDocument()
  })

  it('gère une erreur de vérification et affiche le toast de sécurité', async () => {
    RPC_RESULTS.is_admin = { data: true, error: { message: 'x' } }
    RPC_RESULTS.is_admin_strict = { data: true, error: null }
    PROFILE_RESULT.data = { two_factor_enabled: true }
    PROFILE_RESULT.error = null

    renderGuard({ operationName: 'cet espace' })

    await screen.findByText('Accès refusé')

    expect(DEBUG_ERROR).toHaveBeenCalled()
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur de sécurité',
      description: "Impossible de vérifier vos permissions d'administrateur",
      variant: 'destructive',
    })
    expect(screen.getByText(/Vous n'avez pas les permissions d'administrateur nécessaires pour accéder à cet espace\./)).toBeInTheDocument()
  })
})