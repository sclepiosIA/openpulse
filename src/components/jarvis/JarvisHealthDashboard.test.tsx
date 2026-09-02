import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import JarvisHealthDashboard from './JarvisHealthDashboard'

const {
  AUTH_STATE,
  CIRCUIT_STATE_LOADING,
  CIRCUIT_STATE_SUCCESS,
  CIRCUIT_STATE_ERROR,
  METRICS_LOADING,
  METRICS_SUCCESS,
  METRICS_ERROR,
  mockUseAuth,
  mockUseJarvisCircuitState,
  mockUseJarvisMetricsHistory,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  } as const

  const CIRCUIT_STATE_LOADING = {
    status: 'UNKNOWN' as const,
    lastChecked: null,
    isChecking: true,
    circuits: [],
    recommendations: [],
    responseTimeMs: 0,
    degradationMode: 'normal',
    forceCheck: vi.fn(),
  }

  const CIRCUIT_STATE_SUCCESS = {
    status: 'DEGRADED' as const,
    lastChecked: new Date('2024-01-02T10:20:30.000Z'),
    isChecking: false,
    circuits: [
      {
        name: 'search_api',
        status: 'OPEN',
        latencyMs: 420,
        lastError: 'timeout upstream',
      },
      {
        name: 'memory_store',
        status: 'CLOSED',
        latencyMs: 38,
        lastError: '',
      },
    ],
    recommendations: ['Réduire le trafic sur search_api', 'Vérifier les timeouts amont'],
    responseTimeMs: 187,
    degradationMode: 'fallback',
    forceCheck: vi.fn(),
  }

  const CIRCUIT_STATE_ERROR = {
    status: 'OFFLINE' as const,
    lastChecked: new Date('2024-01-02T11:00:00.000Z'),
    isChecking: false,
    circuits: [
      {
        name: 'gateway',
        status: 'OPEN',
        latencyMs: 999,
        lastError: 'x',
      },
    ],
    recommendations: ['x'],
    responseTimeMs: 999,
    degradationMode: 'emergency',
    forceCheck: vi.fn(),
    isError: true,
    error: { message: 'x' },
  }

  const METRICS_LOADING = {
    toolStats: [],
    hourlyUsage: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, avgLatency: 0 })),
    p50: 0,
    p95: 0,
    p99: 0,
    overallSuccessRate: 0,
    totalInteractions: 0,
    isLoading: true,
    refresh: vi.fn(),
  }

  const METRICS_SUCCESS = {
    toolStats: [
      {
        name: 'web_search',
        successRate: 95,
        totalCalls: 120,
        avgLatencyMs: 145,
        p95LatencyMs: 310,
      },
      {
        name: 'file_reader',
        successRate: 72,
        totalCalls: 50,
        avgLatencyMs: 89,
        p95LatencyMs: 160,
      },
    ],
    hourlyUsage: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hour === 9 ? 12 : hour === 15 ? 6 : hour === 20 ? 2 : 0,
      avgLatency: hour === 9 ? 180 : hour === 15 ? 220 : hour === 20 ? 90 : 0,
    })),
    p50: 123.4,
    p95: 987.6,
    p99: 2345.2,
    overallSuccessRate: 91.3,
    totalInteractions: 172,
    isLoading: false,
    refresh: vi.fn(),
  }

  const METRICS_ERROR = {
    toolStats: [],
    hourlyUsage: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, avgLatency: 0 })),
    p50: 0,
    p95: 0,
    p99: 0,
    overallSuccessRate: 0,
    totalInteractions: 0,
    isLoading: false,
    refresh: vi.fn(),
    isError: true,
    error: { message: 'x' },
  }

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  } as {
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
    upsert: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    catch: ReturnType<typeof vi.fn>
  }

  const mockFrom = vi.fn()
  const mockUseAuth = vi.fn()
  const mockUseJarvisCircuitState = vi.fn()
  const mockUseJarvisMetricsHistory = vi.fn()
  const mockNavigate = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()

  return {
    AUTH_STATE,
    CIRCUIT_STATE_LOADING,
    CIRCUIT_STATE_SUCCESS,
    CIRCUIT_STATE_ERROR,
    METRICS_LOADING,
    METRICS_SUCCESS,
    METRICS_ERROR,
    mockUseAuth,
    mockUseJarvisCircuitState,
    mockUseJarvisMetricsHistory,
    mockNavigate,
    mockToastSuccess,
    mockToastError,
    mockFrom,
    builder,
  }
})

builder.select.mockImplementation(() => builder)
builder.eq.mockImplementation(() => builder)
builder.gte.mockImplementation(() => builder)
builder.lte.mockImplementation(() => builder)
builder.in.mockImplementation(() => builder)
builder.order.mockImplementation(() => builder)
builder.limit.mockImplementation(() => builder)
builder.insert.mockImplementation(() => builder)
builder.update.mockImplementation(() => builder)
builder.delete.mockImplementation(() => builder)
builder.upsert.mockImplementation(() => builder)
builder.single.mockResolvedValue({ data: null, error: null })
builder.maybeSingle.mockResolvedValue({ data: null, error: null })
builder.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) =>
  Promise.resolve({ data: null, error: null }).then(onFulfilled),
)
builder.catch.mockImplementation(
  (onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected),
)
mockFrom.mockImplementation(() => builder)

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: AUTH_STATE.user }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: AUTH_STATE.session }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/hooks/jarvis/useJarvisCircuitState', () => ({
  useJarvisCircuitState: mockUseJarvisCircuitState,
}))

vi.mock('@/hooks/jarvis/useJarvisMetricsHistory', () => ({
  useJarvisMetricsHistory: mockUseJarvisMetricsHistory,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-variant={variant ?? ''} className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className} />
  ),
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => <button data-value={value}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    RefreshCw: Icon,
    AlertTriangle: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Clock: Icon,
    Zap: Icon,
    Activity: Icon,
    TrendingUp: Icon,
    BarChart3: Icon,
    Wrench: Icon,
  }
})

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

describe('JarvisHealthDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(AUTH_STATE)
  })

  it('expose un état de chargement via renderHook dans un wrapper QueryClientProvider', () => {
    mockUseJarvisCircuitState.mockReturnValue(CIRCUIT_STATE_LOADING)
    mockUseJarvisMetricsHistory.mockReturnValue(METRICS_LOADING)

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => ({
        circuit: mockUseJarvisCircuitState(),
        metrics: mockUseJarvisMetricsHistory(),
      }),
      { wrapper },
    )

    expect(result.current.circuit.isChecking).toBe(true)
    expect(result.current.circuit.status).toBe('UNKNOWN')
    expect(result.current.metrics.isLoading).toBe(true)
    expect(result.current.metrics.totalInteractions).toBe(0)
  })

  it('affiche les valeurs métier réelles et déclenche le rafraîchissement', () => {
    mockUseJarvisCircuitState.mockReturnValue(CIRCUIT_STATE_SUCCESS)
    mockUseJarvisMetricsHistory.mockReturnValue(METRICS_SUCCESS)

    render(<JarvisHealthDashboard />)

    expect(screen.getByText('État du Système')).toBeInTheDocument()
    expect(screen.getByText('Dégradé')).toBeInTheDocument()
    expect(screen.getByText('fallback')).toBeInTheDocument()
    expect(screen.getByText(/187ms/)).toBeInTheDocument()

    expect(screen.getByText('123ms')).toBeInTheDocument()
    expect(screen.getByText('988ms')).toBeInTheDocument()
    expect(screen.getByText('2345ms')).toBeInTheDocument()
    expect(screen.getByText('91.3%')).toBeInTheDocument()
    expect(screen.getByText('172')).toBeInTheDocument()

    expect(screen.getByText('web search')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('120 appels')).toBeInTheDocument()
    expect(screen.getByText('Moy: 145ms')).toBeInTheDocument()
    expect(screen.getByText('P95: 310ms')).toBeInTheDocument()

    expect(screen.getByText('file reader')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('50 appels')).toBeInTheDocument()

    expect(screen.getByText('search_api')).toBeInTheDocument()
    expect(screen.getByText('OPEN')).toBeInTheDocument()
    expect(screen.getByText('timeout upstream')).toBeInTheDocument()
    expect(screen.getByText('memory_store')).toBeInTheDocument()
    expect(screen.getByText('CLOSED')).toBeInTheDocument()

    expect(screen.getByText('Recommandations')).toBeInTheDocument()
    expect(screen.getByText('Réduire le trafic sur search_api')).toBeInTheDocument()
    expect(screen.getByText('Vérifier les timeouts amont')).toBeInTheDocument()

    const heatCell = screen.getByTitle('9h: 12 interactions, 180ms moy.')
    expect(heatCell).toBeInTheDocument()
    expect(within(heatCell).getByText('12')).toBeInTheDocument()

    const refreshButton = screen.getByRole('button', { name: /rafraîchir/i })
    fireEvent.click(refreshButton)

    expect(CIRCUIT_STATE_SUCCESS.forceCheck).toHaveBeenCalledTimes(1)
    expect(METRICS_SUCCESS.refresh).toHaveBeenCalledTimes(1)
  })

  it('désactive le bouton pendant le chargement', () => {
    mockUseJarvisCircuitState.mockReturnValue(CIRCUIT_STATE_LOADING)
    mockUseJarvisMetricsHistory.mockReturnValue(METRICS_LOADING)

    render(<JarvisHealthDashboard />)

    expect(screen.getByRole('button', { name: /rafraîchir/i })).toBeDisabled()
  })

  it('propage un état d erreur des hooks mockés', () => {
    mockUseJarvisCircuitState.mockReturnValue(CIRCUIT_STATE_ERROR)
    mockUseJarvisMetricsHistory.mockReturnValue(METRICS_ERROR)

    const wrapper = createWrapper()

    const { result } = renderHook(
      () => ({
        circuit: mockUseJarvisCircuitState(),
        metrics: mockUseJarvisMetricsHistory(),
      }),
      { wrapper },
    )

    expect(result.current.circuit.isError).toBe(true)
    expect(result.current.circuit.error).toEqual({ message: 'x' })
    expect(result.current.metrics.isError).toBe(true)
    expect(result.current.metrics.error).toEqual({ message: 'x' })
  })
})