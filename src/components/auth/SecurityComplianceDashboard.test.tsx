// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor, fireEvent, within, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SecurityComplianceDashboard } from './SecurityComplianceDashboard'

const {
  USER,
  REPORT_ROWS,
  EMPTY_ROWS,
  mockToast,
  mockRpc,
  mockFrom,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' }

  const REPORT_ROWS = [
    {
      check_name: 'Admin 2FA Compliance',
      status: 'CRITICAL',
      details: '2 administrateurs sans 2FA',
      recommendation: 'Activer la double authentification pour tous les administrateurs',
    },
    {
      check_name: 'Journalisation des actions',
      status: 'WARNING',
      details: 'Certaines actions ne sont pas journalisées',
      recommendation: "Étendre l'audit à toutes les opérations sensibles",
    },
    {
      check_name: 'Protection des données',
      status: 'OK',
      details: 'Les contrôles d’accès sont actifs',
      recommendation: 'Maintenir la configuration actuelle',
    },
  ] as const

  const EMPTY_ROWS: Array<{
    check_name: string
    status: string
    details: string
    recommendation: string
  }> = []

  return {
    USER,
    REPORT_ROWS,
    EMPTY_ROWS,
    mockToast: vi.fn(),
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }),
}))

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: true }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
    <span data-variant={variant} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  Shield: (props: React.SVGProps<SVGSVGElement>) => <svg data-icon="shield" {...props} />,
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-icon="alert-triangle" {...props} />,
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-icon="check-circle" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-icon="users" {...props} />,
}))

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
      rpc: mockRpc,
    },
  }
})

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

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return Wrapper
}

function renderDashboard() {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SecurityComplianceDashboard />
    </QueryClientProvider>
  )
}

describe('SecurityComplianceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le chargement puis le tableau avec les compteurs, badges et détails métier', async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      expect(fnName).toBe('get_security_compliance_report')
      return { data: REPORT_ROWS, error: null }
    })

    const wrapper = createWrapper()
    renderHook(() => ({ ready: true }), { wrapper })

    renderDashboard()

    expect(screen.getByText('Chargement du rapport de conformité...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tableau de Bord Sécurité')).toBeInTheDocument()
    })

    expect(mockRpc).toHaveBeenCalledWith('get_security_compliance_report')

    expect(screen.getByText('Problèmes Critiques')).toBeInTheDocument()
    expect(screen.getByText('Avertissements')).toBeInTheDocument()
    expect(screen.getByText('Conformes')).toBeInTheDocument()

    const criticalBlock = screen.getByText('Problèmes Critiques').parentElement
    const warningBlock = screen.getByText('Avertissements').parentElement
    const okBlock = screen.getByText('Conformes').parentElement

    expect(criticalBlock).not.toBeNull()
    expect(warningBlock).not.toBeNull()
    expect(okBlock).not.toBeNull()

    expect(within(criticalBlock as HTMLElement).getByText('1')).toBeInTheDocument()
    expect(within(warningBlock as HTMLElement).getByText('1')).toBeInTheDocument()
    expect(within(okBlock as HTMLElement).getByText('1')).toBeInTheDocument()

    expect(screen.getByText('Admin 2FA Compliance')).toBeInTheDocument()
    expect(screen.getByText('Journalisation des actions')).toBeInTheDocument()
    expect(screen.getByText('Protection des données')).toBeInTheDocument()

    expect(screen.getByText('2 administrateurs sans 2FA')).toBeInTheDocument()
    expect(screen.getByText('Activer la double authentification pour tous les administrateurs')).toBeInTheDocument()
    expect(screen.getByText('Certaines actions ne sont pas journalisées')).toBeInTheDocument()
    expect(screen.getByText("Étendre l'audit à toutes les opérations sensibles")).toBeInTheDocument()
    expect(screen.getByText('Les contrôles d’accès sont actifs')).toBeInTheDocument()
    expect(screen.getByText('Maintenir la configuration actuelle')).toBeInTheDocument()

    const criticalBadge = screen.getByText('CRITICAL')
    const warningBadge = screen.getByText('WARNING')
    const okBadge = screen.getByText('OK')

    expect(criticalBadge).toHaveAttribute('data-variant', 'destructive')
    expect(warningBadge).toHaveAttribute('data-variant', 'secondary')
    expect(okBadge).toHaveAttribute('data-variant', 'default')

    expect(screen.getByText(/Action immédiate requise/)).toBeInTheDocument()
    expect(screen.getByText(/Certaines fonctions administratives sont restreintes jusqu'à la résolution/)).toBeInTheDocument()

    const actionRequiredHeadings = screen.getAllByText('Action requise')
    expect(actionRequiredHeadings).toHaveLength(1)
    expect(screen.getByText(/Les administrateurs sans 2FA doivent activer l'authentification à deux facteurs/)).toBeInTheDocument()

    expect(screen.getByText('Actions de Sécurité Recommandées')).toBeInTheDocument()
    expect(screen.getByText('Authentification à deux facteurs (2FA)')).toBeInTheDocument()
    expect(screen.getByText('Audit des opérations critiques')).toBeInTheDocument()
    expect(screen.getByText('Protection des données clients')).toBeInTheDocument()
  })

  it('actualise le rapport au clic sur le bouton Actualiser', async () => {
    mockRpc.mockResolvedValue({ data: EMPTY_ROWS, error: null })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Tableau de Bord Sécurité')).toBeInTheDocument()
    })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_security_compliance_report')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
    })

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(2)
    })

    expect(mockRpc).toHaveBeenNthCalledWith(2, 'get_security_compliance_report')
  })

  it('gère une erreur de chargement en affichant un toast destructif', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'x' },
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Tableau de Bord Sécurité')).toBeInTheDocument()
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger le rapport de conformité',
      variant: 'destructive',
    })

    const criticalBlock = screen.getByText('Problèmes Critiques').parentElement
    const warningBlock = screen.getByText('Avertissements').parentElement
    const okBlock = screen.getByText('Conformes').parentElement

    expect(criticalBlock).not.toBeNull()
    expect(warningBlock).not.toBeNull()
    expect(okBlock).not.toBeNull()

    expect(within(criticalBlock as HTMLElement).getByText('0')).toBeInTheDocument()
    expect(within(warningBlock as HTMLElement).getByText('0')).toBeInTheDocument()
    expect(within(okBlock as HTMLElement).getByText('0')).toBeInTheDocument()

    expect(screen.queryByText('Admin 2FA Compliance')).not.toBeInTheDocument()
    expect(screen.queryByText(/Action immédiate requise/)).not.toBeInTheDocument()
  })
})