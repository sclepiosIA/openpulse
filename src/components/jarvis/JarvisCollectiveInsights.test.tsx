import React from 'react'
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JarvisCollectiveInsights } from './JarvisCollectiveInsights'
import { useJarvisCollectiveLearning } from '@/hooks/jarvis/useJarvisCollectiveLearning'

const {
  STABLE_USER,
  TOP_SUGGESTIONS,
  INSIGHTS,
  EMPTY_INSIGHTS,
  EMPTY_SUGGESTIONS,
  mockRecordAction,
  mockUseJarvisCollectiveLearning,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const thenableResult = Promise.resolve({ data: null, error: null })

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: thenableResult.then.bind(thenableResult),
    catch: thenableResult.catch.bind(thenableResult),
  }

  return {
    STABLE_USER: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    TOP_SUGGESTIONS: [
      {
        id: 's1',
        title: 'Automatiser le suivi client',
        description: 'Les top performers planifient un suivi systématique après chaque échange',
        adoptionRate: 72,
        sourceCount: 18,
        actionable: true,
        type: 'follow_up',
        data: { cadence: 'daily' },
        effectiveness: 88,
      },
      {
        id: 's2',
        title: 'Structurer les priorités',
        description: 'Découper les objectifs en actions hebdomadaires',
        adoptionRate: 54,
        sourceCount: 11,
        actionable: false,
        type: 'planning',
        data: { horizon: 'weekly' },
        effectiveness: 67,
      },
    ],
    INSIGHTS: [
      {
        recommendations: [
          'Réduire le temps de réponse sur les demandes entrantes',
          'Renforcer le suivi des actions à fort impact',
          'Documenter les pratiques les plus efficaces',
          'Ne doit pas être affiché car hors top 3',
        ],
      },
    ],
    EMPTY_INSIGHTS: [],
    EMPTY_SUGGESTIONS: [],
    mockRecordAction: vi.fn(),
    mockUseJarvisCollectiveLearning: vi.fn(),
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(() => chain),
    builder: chain,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: STABLE_USER.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: STABLE_USER.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

vi.mock('@/hooks/jarvis/useJarvisCollectiveLearning', () => ({
  useJarvisCollectiveLearning: mockUseJarvisCollectiveLearning,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: { value?: number } & React.HTMLAttributes<HTMLDivElement>) => (
    <div role="progressbar" aria-valuenow={value} {...props} />
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />
  return {
    Users: Icon,
    TrendingUp: Icon,
    Lightbulb: Icon,
    CheckCircle2: Icon,
    ChevronRight: Icon,
    Sparkles: Icon,
    Trophy: Icon,
    Target: Icon,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_USER,
}))

const createWrapper = () => {
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

describe('JarvisCollectiveInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(builder)
    mockUseJarvisCollectiveLearning.mockReturnValue({
      insights: EMPTY_INSIGHTS,
      topSuggestions: EMPTY_SUGGESTIONS,
      isLoading: false,
      isError: false,
      error: null,
      recordAction: mockRecordAction,
    })
  })

  it('affiche l’état de chargement quand isLoading est true', () => {
    mockUseJarvisCollectiveLearning.mockReturnValue({
      insights: EMPTY_INSIGHTS,
      topSuggestions: EMPTY_SUGGESTIONS,
      isLoading: true,
      isError: false,
      error: null,
      recordAction: mockRecordAction,
    })

    render(<JarvisCollectiveInsights />, { wrapper: createWrapper() })

    expect(screen.getByText('Analyse collective en cours...')).toBeInTheDocument()
    expect(screen.queryByText('Intelligence Collective')).not.toBeInTheDocument()
  })

  it('rend les données métier, limite les recommandations à 3, permet l’expansion et déclenche recordAction', async () => {
    mockUseJarvisCollectiveLearning.mockReturnValue({
      insights: INSIGHTS,
      topSuggestions: TOP_SUGGESTIONS,
      isLoading: false,
      isError: false,
      error: null,
      recordAction: mockRecordAction,
    })

    render(<JarvisCollectiveInsights />, { wrapper: createWrapper() })

    expect(screen.getByText('Intelligence Collective')).toBeInTheDocument()
    expect(screen.getByText('Pratiques des Top Performers')).toBeInTheDocument()
    expect(screen.getByText('Recommandations')).toBeInTheDocument()

    expect(screen.getByText('Automatiser le suivi client')).toBeInTheDocument()
    expect(
      screen.getByText('Les top performers planifient un suivi systématique après chaque échange'),
    ).toBeInTheDocument()
    expect(screen.getByText('88% efficace')).toBeInTheDocument()
    expect(screen.getByText('67% efficace')).toBeInTheDocument()

    expect(screen.getByText('Réduire le temps de réponse sur les demandes entrantes')).toBeInTheDocument()
    expect(screen.getByText('Renforcer le suivi des actions à fort impact')).toBeInTheDocument()
    expect(screen.getByText('Documenter les pratiques les plus efficaces')).toBeInTheDocument()
    expect(screen.queryByText('Ne doit pas être affiché car hors top 3')).not.toBeInTheDocument()

    expect(screen.queryByText("Taux d'adoption")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Automatiser le suivi client'))

    expect(screen.getByText("Taux d'adoption")).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('18 utilisateurs')).toBeInTheDocument()

    const actionButton = screen.getByRole('button', { name: /appliquer cette pratique/i })

    await act(async () => {
      fireEvent.click(actionButton)
    })

    expect(mockRecordAction).toHaveBeenCalledTimes(1)
    expect(mockRecordAction).toHaveBeenCalledWith('follow_up', { cadence: 'daily' }, true)
  })

  it('affiche l’état vide quand aucune suggestion collective n’est disponible', () => {
    mockUseJarvisCollectiveLearning.mockReturnValue({
      insights: EMPTY_INSIGHTS,
      topSuggestions: EMPTY_SUGGESTIONS,
      isLoading: false,
      isError: false,
      error: null,
      recordAction: mockRecordAction,
    })

    render(<JarvisCollectiveInsights />, { wrapper: createWrapper() })

    expect(screen.getByText('Pas encore assez de données collectives')).toBeInTheDocument()
    expect(
      screen.getByText("Continuez à utiliser Jarvis pour enrichir l'apprentissage"),
    ).toBeInTheDocument()
  })

  it('le hook mocké expose bien un état d’erreur consommable', async () => {
    mockUseJarvisCollectiveLearning.mockReturnValue({
      insights: EMPTY_INSIGHTS,
      topSuggestions: EMPTY_SUGGESTIONS,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
      recordAction: mockRecordAction,
    })

    const { result } = renderHook(() => useJarvisCollectiveLearning(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual({ message: 'x' })
    expect(result.current.topSuggestions).toEqual(EMPTY_SUGGESTIONS)
    expect(result.current.insights).toEqual(EMPTY_INSIGHTS)
  })
})