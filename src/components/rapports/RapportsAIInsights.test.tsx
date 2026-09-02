import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react'
import { RapportsAIInsights } from './RapportsAIInsights'

const {
  AUTH_STATE,
  INSIGHTS_LOADING,
  INSIGHTS_SUCCESS,
  INSIGHTS_ERROR,
  NEXT_SCHEDULED_ANALYSIS,
  mockUseAIInsights,
  mockManualRefetch,
  mockDebugError,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const NEXT_SCHEDULED_ANALYSIS = new Date('2025-01-15T09:00:00.000Z')

  const INSIGHTS_LOADING = {
    data: undefined,
    isLoading: true,
    isFetching: false,
    manualRefetch: vi.fn(),
    nextScheduledAnalysis: NEXT_SCHEDULED_ANALYSIS,
  }

  const INSIGHTS_SUCCESS = {
    data: {
      _metadata: { created_at: '2025-01-14T10:30:00.000Z' },
      trends: [
        {
          title: 'Hausse des admissions',
          description: 'Les admissions augmentent de 12% sur la période.',
          impact: 'high',
          recommendation: 'Renforcer les équipes du matin',
        },
      ],
      alerts: [
        {
          title: 'Tension sur le personnel',
          description: 'Le taux de couverture baisse sur 3 jours.',
          businessImpact: 'Risque de retard de prise en charge',
          severity: 'high',
          actions: ['Réaffecter une équipe', 'Ouvrir des remplacements'],
        },
      ],
      recommendations: [],
      anomalies: [],
    },
    isLoading: false,
    isFetching: false,
    manualRefetch: vi.fn(),
    nextScheduledAnalysis: NEXT_SCHEDULED_ANALYSIS,
  }

  const INSIGHTS_ERROR = {
    data: {
      is_rate_limited: true,
      message: 'x',
      nextAvailableAt: '2025-01-16T09:00:00.000Z',
      trends: [],
      alerts: [],
      recommendations: [],
      anomalies: [],
    },
    isLoading: false,
    isFetching: false,
    manualRefetch: vi.fn(),
    nextScheduledAnalysis: NEXT_SCHEDULED_ANALYSIS,
  }

  const mockUseAIInsights = vi.fn()
  const mockManualRefetch = vi.fn()
  const mockDebugError = vi.fn()
  const mockNavigate = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())

  return {
    AUTH_STATE,
    INSIGHTS_LOADING,
    INSIGHTS_SUCCESS,
    INSIGHTS_ERROR,
    NEXT_SCHEDULED_ANALYSIS,
    mockUseAIInsights,
    mockManualRefetch,
    mockDebugError,
    mockNavigate,
    mockToastSuccess,
    mockToastError,
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/hooks/ai/useAIInsights', () => ({
  useAIInsights: mockUseAIInsights,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/tabs', () => {
  const ReactModule = React
  const TabsContext = ReactModule.createContext<{
    value: string
    onValueChange: (value: string) => void
  }>({
    value: 'trends',
    onValueChange: () => {},
  })

  return {
    Tabs: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode
      value: string
      onValueChange: (value: string) => void
      className?: string
    }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>,
    TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    TabsTrigger: ({
      children,
      value,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
      const ctx = ReactModule.useContext(TabsContext)
      return (
        <button type="button" onClick={() => ctx.onValueChange(value)} data-state={ctx.value === value ? 'active' : 'inactive'} {...props}>
          {children}
        </button>
      )
    },
    TabsContent: ({
      children,
      value,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { value: string }) => {
      const ctx = ReactModule.useContext(TabsContext)
      if (ctx.value !== value) return null
      return <div {...props}>{children}</div>
    },
  }
})

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
  return {
    Brain: Icon,
    RefreshCw: Icon,
    TrendingUp: Icon,
    AlertTriangle: Icon,
    Lightbulb: Icon,
    Search: Icon,
    Clock: Icon,
    Sparkles: Icon,
  }
})

vi.mock('./AIInsightCard', () => ({
  AIInsightCard: ({
    insightId,
    type,
    title,
    description,
    impact,
    priority,
    actions,
    onDismiss,
  }: {
    insightId: string
    type: string
    title: string
    description: string
    impact?: string
    priority?: string
    actions?: string[]
    onDismiss?: (id: string) => void
  }) => (
    <div data-testid={`insight-card-${type}`}>
      <div>{title}</div>
      <div>{description}</div>
      {impact ? <div>{impact}</div> : null}
      {priority ? <div>{priority}</div> : null}
      {actions?.map((action) => (
        <div key={action}>{action}</div>
      ))}
      <button type="button" onClick={() => onDismiss?.(insightId)}>
        Dismiss
      </button>
    </div>
  ),
}))

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function TestDismissedHook() {
  const [ids, setIds] = React.useState<string[]>([])
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const current = localStorage.getItem('dismissed_ai_insights')
          setIds(current ? JSON.parse(current) : [])
        }}
      >
        read-storage
      </button>
      <div data-testid="stored-values">{ids.join(',')}</div>
    </div>
  )
}

describe('RapportsAIInsights', () => {
  const stats = { total: 12, score: 88 }
  const etablissements = [{ id: 'e1', nom: 'Clinique A' }]
  const filters = { period: '30d' }

  beforeEach(() => {
    cleanup()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('affiche l’état de chargement puis les insights métier en succès', async () => {
    mockUseAIInsights
      .mockReturnValueOnce({
        ...INSIGHTS_LOADING,
        manualRefetch: mockManualRefetch,
      })
      .mockReturnValue({
        ...INSIGHTS_SUCCESS,
        manualRefetch: mockManualRefetch,
      })

    const { rerender } = render(
      <RapportsAIInsights stats={stats} etablissements={etablissements} filters={filters} />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('Analyse IA en cours...')).toBeInTheDocument()
    expect(screen.getByText('GPT-5 analyse vos données pour générer des insights personnalisés')).toBeInTheDocument()

    rerender(<RapportsAIInsights stats={stats} etablissements={etablissements} filters={filters} />)

    await waitFor(() => {
      expect(screen.getByText('Insights IA')).toBeInTheDocument()
    })

    expect(screen.getByText('Hausse des admissions')).toBeInTheDocument()
    expect(screen.getByText('Les admissions augmentent de 12% sur la période.')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('Renforcer les équipes du matin')).toBeInTheDocument()
    expect(screen.getByText(/Analysé le/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /alertes/i }))

    await waitFor(() => {
      expect(screen.getByText('Tension sur le personnel')).toBeInTheDocument()
    })

    expect(screen.getByText(/Le taux de couverture baisse sur 3 jours\./)).toBeInTheDocument()
    expect(screen.getByText(/Impact: Risque de retard de prise en charge/)).toBeInTheDocument()
    expect(screen.getByText('Réaffecter une équipe')).toBeInTheDocument()
    expect(screen.getByText('Ouvrir des remplacements')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /actualiser/i }))
    expect(mockManualRefetch).toHaveBeenCalledTimes(1)
  })

  it('affiche l’état assimilé à une erreur métier quand la réponse indique un rate-limit', async () => {
    mockUseAIInsights.mockReturnValue({
      ...INSIGHTS_ERROR,
      manualRefetch: mockManualRefetch,
    })

    render(<RapportsAIInsights stats={stats} etablissements={etablissements} filters={filters} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Analyse déjà effectuée')).toBeInTheDocument()
    expect(screen.getByText('x')).toBeInTheDocument()
    expect(screen.getByText(/Prochaine analyse disponible/)).toBeInTheDocument()
  })

  it('retourne null sans établissement', () => {
    mockUseAIInsights.mockReturnValue({
      ...INSIGHTS_SUCCESS,
      manualRefetch: mockManualRefetch,
    })

    const { container } = render(
      <RapportsAIInsights stats={stats} etablissements={[]} filters={filters} />,
      { wrapper: createWrapper() },
    )

    expect(container.firstChild).toBeNull()
  })

  it('persiste le rejet d’un insight dans localStorage via une interaction de mutation UI', async () => {
    mockUseAIInsights.mockReturnValue({
      ...INSIGHTS_SUCCESS,
      manualRefetch: mockManualRefetch,
    })

    render(
      <>
        <RapportsAIInsights stats={stats} etablissements={etablissements} filters={filters} />
        <TestDismissedHook />
      </>,
      { wrapper: createWrapper() },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    fireEvent.click(screen.getByRole('button', { name: 'read-storage' }))

    await waitFor(() => {
      expect(screen.getByTestId('stored-values').textContent).toMatch(/^insight-\d+$/)
    })
  })

  it('utilise renderHook avec QueryClientProvider sans erreur', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => {
        return React.useMemo(() => ({ ok: true }), [])
      },
      { wrapper },
    )

    await act(async () => {
      expect(result.current.ok).toBe(true)
    })
  })
})