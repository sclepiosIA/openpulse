/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisAnalyticsDashboard } from './JarvisAnalyticsDashboard';

const {
  INSIGHTS_SUCCESS,
  INSIGHTS_EMPTY,
  AUTH_STATE,
  hookState,
  mockUseJarvisLearning,
  mockFrom,
  mockNavigate,
  SUPABASE_RESULT,
} = vi.hoisted(() => {
  const INSIGHTS_SUCCESS = {
    patterns: [
      { action_type: 'send_email', trigger_type: 'manual', total_count: 10, approval_rate: 0.8, avg_confidence_approved: 0.9 },
      { action_type: 'create_task', trigger_type: 'auto', total_count: 5, approval_rate: 0.6, avg_confidence_approved: 0.7 },
      { action_type: 'summarize', trigger_type: 'manual', total_count: 3, approval_rate: 1, avg_confidence_approved: 0.95 },
    ],
    peak_usage_hours: [14, 15, 9],
    optimal_threshold: 0.92,
    most_useful_sources: [
      { article_id: 'a1', title: 'Guide support', usage_count: 12 },
      { article_id: 'a2', title: 'Playbook onboarding', usage_count: 7 },
    ],
    suggestions: ['Automatiser les réponses fréquentes', 'Augmenter le seuil pour les emails'],
  };

  const INSIGHTS_EMPTY = {
    patterns: [],
    peak_usage_hours: [],
    optimal_threshold: 0.85,
    most_useful_sources: [],
    suggestions: [],
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 'tester@example.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const hookState: {
    current: {
      insights: typeof INSIGHTS_SUCCESS | typeof INSIGHTS_EMPTY | null;
      isLoading: boolean;
      isError: boolean;
      error: { message: string } | null;
    };
  } = {
    current: {
      insights: INSIGHTS_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    },
  };

  const SUPABASE_RESULT = { data: [], error: null };
  const mockUseJarvisLearning = vi.fn(() => hookState.current);
  const mockNavigate = vi.fn();
  const mockFrom = vi.fn();

  return {
    INSIGHTS_SUCCESS,
    INSIGHTS_EMPTY,
    AUTH_STATE,
    hookState,
    mockUseJarvisLearning,
    mockFrom,
    mockNavigate,
    SUPABASE_RESULT,
  };
});

function createSupabaseBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    like: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    containedBy: vi.fn(() => builder),
    overlaps: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => SUPABASE_RESULT),
    maybeSingle: vi.fn(async () => SUPABASE_RESULT),
    then: (onFulfilled: (value: typeof SUPABASE_RESULT) => unknown) => Promise.resolve(SUPABASE_RESULT).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(SUPABASE_RESULT).catch(onRejected),
  };

  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createSupabaseBuilder()),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/hooks/jarvis/useJarvisLearning', () => ({
  useJarvisLearning: mockUseJarvisLearning,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    BarChart3: Icon,
    TrendingUp: Icon,
    Clock: Icon,
    CheckCircle2: Icon,
    Brain: Icon,
    Zap: Icon,
    Target: Icon,
    BookOpen: Icon,
    Server: Icon,
    Wrench: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: { value: number } & React.HTMLAttributes<HTMLDivElement>) => (
    <div role="progressbar" aria-valuenow={value} {...props} />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => {
  function injectProps(node: React.ReactNode, activeValue: string, onValueChange: (value: string) => void): React.ReactNode {
    return React.Children.map(node, (child) => {
      if (!React.isValidElement(child)) return child;
      const element = child as React.ReactElement<{ children?: React.ReactNode }>;
      return React.cloneElement(element, {
        activeValue,
        onValueChange,
        children: injectProps(element.props.children, activeValue, onValueChange),
      });
    });
  }

  function Tabs({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) {
    return <div>{injectProps(children, value, onValueChange)}</div>;
  }

  function TabsList({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div {...props}>{children}</div>;
  }

  function TabsTrigger({
    value,
    children,
    onValueChange,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string;
    onValueChange?: (value: string) => void;
  }) {
    return (
      <button type="button" onClick={() => onValueChange?.(value)} {...props}>
        {children}
      </button>
    );
  }

  function TabsContent({
    value,
    activeValue,
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    value: string;
    activeValue?: string;
  }) {
    if (value !== activeValue) return null;
    return <div {...props}>{children}</div>;
  }

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock('./JarvisAzureMonitoring', () => ({
  JarvisAzureMonitoring: () => <div>Azure Monitoring Mock</div>,
}));

vi.mock('./JarvisToolsMonitoringDashboard', () => ({
  JarvisToolsMonitoringDashboard: () => <div>Tools Monitoring Mock</div>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

describe('JarvisAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.current = {
      insights: INSIGHTS_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it('expose le hook mocké avec le wrapper QueryClientProvider', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => mockUseJarvisLearning(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.insights).toBe(INSIGHTS_SUCCESS);
    expect(result.current.insights?.optimal_threshold).toBe(0.92);
    expect(mockUseJarvisLearning).toHaveBeenCalled();
  });

  it('affiche un état de chargement puis les statistiques métier calculées', async () => {
    hookState.current = {
      insights: INSIGHTS_SUCCESS,
      isLoading: true,
      isError: false,
      error: null,
    };

    const { rerender } = render(<JarvisAnalyticsDashboard />);

    expect(document.querySelectorAll('.animate-pulse').length).toBe(1);
    expect(screen.queryByText('Analytics Jarvis')).not.toBeInTheDocument();

    hookState.current = {
      insights: INSIGHTS_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    };

    rerender(<JarvisAnalyticsDashboard />);

    expect(await screen.findByText('Analytics Jarvis')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("28m")).toBeInTheDocument();
    expect(screen.getByText('Recommandé')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '92');
    expect(screen.getByText("Les actions au-dessus de ce seuil ont 78% de chances d'être approuvées")).toBeInTheDocument();

    expect(screen.getByText('Envoi email')).toBeInTheDocument();
    expect(screen.getByText('Création tâche')).toBeInTheDocument();
    expect(screen.getByText('Résumé')).toBeInTheDocument();
    expect(screen.getByText('10 actions')).toBeInTheDocument();
    expect(screen.getByText('5 actions')).toBeInTheDocument();
    expect(screen.getByText('3 actions')).toBeInTheDocument();

    expect(screen.getByText('Guide support')).toBeInTheDocument();
    expect(screen.getByText('Playbook onboarding')).toBeInTheDocument();
    expect(screen.getByText('12×')).toBeInTheDocument();
    expect(screen.getByText('7×')).toBeInTheDocument();

    expect(screen.getByText('Automatiser les réponses fréquentes')).toBeInTheDocument();
    expect(screen.getByText('Augmenter le seuil pour les emails')).toBeInTheDocument();

    expect(screen.getByText('14h - 15h')).toBeInTheDocument();
    expect(screen.getByText('15h - 16h')).toBeInTheDocument();
    expect(screen.getByText('9h - 10h')).toBeInTheDocument();
  });

  it('bascule vers les onglets outils et azure', () => {
    render(<JarvisAnalyticsDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    expect(screen.getByText('Tools Monitoring Mock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Azure GPT-5/i }));
    expect(screen.getByText('Azure Monitoring Mock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Apprentissage/i }));
    expect(screen.getByText('Analytics Jarvis')).toBeInTheDocument();
  });

  it('affiche les valeurs par défaut quand il n’y a aucune donnée', () => {
    hookState.current = {
      insights: INSIGHTS_EMPTY,
      isLoading: false,
      isError: false,
      error: null,
    };

    render(<JarvisAnalyticsDashboard />);

    expect(screen.getByText('Actions traitées')).toBeInTheDocument();
    expect(screen.getByText("Taux d'approbation")).toBeInTheDocument();
    expect(screen.getByText('Confiance moyenne')).toBeInTheDocument();
    expect(screen.getByText('Temps économisé')).toBeInTheDocument();
    expect(screen.getByText('0m')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
    expect(screen.getByText("Les actions au-dessus de ce seuil ont 0% de chances d'être approuvées")).toBeInTheDocument();
    expect(screen.queryByText('Performance par type')).not.toBeInTheDocument();
    expect(screen.queryByText('Sources KB les plus utiles')).not.toBeInTheDocument();
    expect(screen.queryByText("Suggestions d'optimisation")).not.toBeInTheDocument();
    expect(screen.queryByText("Heures d'utilisation")).not.toBeInTheDocument();
  });

  it('remonte un état d’erreur via le hook mocké', async () => {
    hookState.current = {
      insights: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    };

    const wrapper = createWrapper();
    const { result } = renderHook(() => mockUseJarvisLearning(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.insights).toBeNull();
  });
});