import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  STATS_SUCCESS,
  formatTokensMock,
  formatCostMock,
  formatDurationMock,
  getProcessingTypeLabelMock,
  useAIUsageStatsMock,
  refetchMock,
  navigateMock,
} = vi.hoisted(() => {
  const STATS_SUCCESS = {
    totalCalls: 1234,
    callsToday: 12,
    successRate: 98.7,
    avgProcessingTime: 1534,
    estimatedCost: 4.56,
    totalTokens: 98765,
    dailyStats: [
      { date: '2025-01-01', calls: 10, tokens: 1000 },
      { date: '2025-01-02', calls: 20, tokens: 2000 },
      { date: '2025-01-03', calls: 30, tokens: 3000 },
      { date: '2025-01-04', calls: 40, tokens: 4000 },
      { date: '2025-01-05', calls: 50, tokens: 5000 },
      { date: '2025-01-06', calls: 60, tokens: 6000 },
      { date: '2025-01-07', calls: 70, tokens: 7000 },
    ],
    callsByType: [
      { type: 'extraction', count: 400 },
      { type: 'email_summary', count: 300 },
      { type: 'suggestion_generation', count: 200 },
      { type: 'pulse_chat', count: 100 },
      { type: 'rd_assist', count: 50 },
      { type: 'unknown_type', count: 10 },
    ],
    recentLogs: [
      {
        id: 'l1',
        processed_at: '2025-01-07T10:15:00.000Z',
        processing_duration_ms: 1000,
        success: true,
        error_message: null,
        model_used: 'gpt-5',
        total_tokens: 120,
        processing_type: 'extraction',
      },
      {
        id: 'l2',
        processed_at: '2025-01-07T10:45:00.000Z',
        processing_duration_ms: 2000,
        success: true,
        error_message: null,
        model_used: 'gpt-5',
        total_tokens: 200,
        processing_type: 'email_summary',
      },
      {
        id: 'l3',
        processed_at: '2025-01-07T11:05:00.000Z',
        processing_duration_ms: 9000,
        success: false,
        error_message: 'boom',
        model_used: 'gpt-5-mini',
        total_tokens: 50,
        processing_type: 'suggestion_generation',
      },
      {
        id: 'l4',
        processed_at: '2025-01-07T11:55:00.000Z',
        processing_duration_ms: null,
        success: true,
        error_message: null,
        model_used: 'gpt-5-mini',
        total_tokens: 80,
        processing_type: 'pulse_chat',
      },
    ],
  };

  return {
    STATS_SUCCESS,
    formatTokensMock: vi.fn((n: number) => `${n} tok`),
    formatCostMock: vi.fn((n: number) => `${n.toFixed(2)} eur`),
    formatDurationMock: vi.fn((ms: number) => `${Math.round(ms)} ms`),
    getProcessingTypeLabelMock: vi.fn((t: string) => `LABEL:${t}`),
    useAIUsageStatsMock: vi.fn(),
    refetchMock: vi.fn(),
    navigateMock: vi.fn(),
  };
});

vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  useAIUsageStats: useAIUsageStatsMock,
  formatTokens: formatTokensMock,
  formatCost: formatCostMock,
  formatDuration: formatDurationMock,
  getProcessingTypeLabel: getProcessingTypeLabelMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<unknown>) =>
    args
      .flatMap((a) => {
        if (!a) return [];
        if (typeof a === 'string') return [a];
        if (Array.isArray(a)) return a.filter(Boolean).map(String);
        if (typeof a === 'object') {
          return Object.entries(a as Record<string, unknown>)
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k);
        }
        return [String(a)];
      })
      .join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: Record<string, unknown>) => React.createElement('span', { 'data-icon': '1', ...props });
  return {
    Activity: Icon,
    AlertCircle: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    Zap: Icon,
    AlertTriangle: Icon,
    RefreshCw: Icon,
    Server: Icon,
    DollarSign: Icon,
    BarChart3: Icon,
    Timer: Icon,
    XCircle: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
  };
});

vi.mock('recharts', () => {
  const passthrough = (name: string) =>
    function Comp(props: Record<string, unknown>) {
      return React.createElement('div', { 'data-recharts': name, ...props }, (props as { children?: React.ReactNode }).children);
    };

  return {
    ResponsiveContainer: passthrough('ResponsiveContainer'),
    AreaChart: passthrough('AreaChart'),
    Area: passthrough('Area'),
    XAxis: passthrough('XAxis'),
    YAxis: passthrough('YAxis'),
    Tooltip: passthrough('Tooltip'),
    BarChart: passthrough('BarChart'),
    Bar: passthrough('Bar'),
    Cell: passthrough('Cell'),
  };
});

vi.mock('framer-motion', () => {
  const MotionDiv = (props: Record<string, unknown>) => React.createElement('div', props, (props as { children?: React.ReactNode }).children);
  return {
    motion: { div: MotionDiv },
    AnimatePresence: (props: Record<string, unknown>) => React.createElement(React.Fragment, null, (props as { children?: React.ReactNode }).children),
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-ui="card" {...props} />,
  CardHeader: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-ui="card-header" {...props} />,
  CardTitle: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 data-ui="card-title" {...props} />,
  CardDescription: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p data-ui="card-description" {...props} />,
  CardContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-ui="card-content" {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
    <span data-ui="badge" data-variant={props.variant} {...props} />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button data-ui="button" data-variant={props.variant} data-size={props.size} {...props} />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-ui="scroll-area" {...props} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-ui="skeleton" {...props} />,
}));

vi.mock('@/components/ui/tabs', () => {
  const TabsCtx = React.createContext<{ value: string; onValueChange?: (v: string) => void } | null>(null);
  const Tabs = ({ value, onValueChange, children }: { value: string; onValueChange?: (v: string) => void; children?: React.ReactNode }) => (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div data-ui="tabs" data-value={value}>
        {children}
      </div>
    </TabsCtx.Provider>
  );
  const TabsList = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-ui="tabs-list" {...rest}>
      {children}
    </div>
  );
  const TabsTrigger = ({
    value,
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
    const ctx = React.useContext(TabsCtx);
    const selected = ctx?.value === value;
    return (
      <button
        type="button"
        data-ui="tabs-trigger"
        data-value={value}
        aria-selected={selected}
        onClick={() => ctx?.onValueChange?.(value)}
        {...rest}
      >
        {children}
      </button>
    );
  };
  const TabsContent = ({ value, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { value: string }) => {
    const ctx = React.useContext(TabsCtx);
    if (!ctx || ctx.value !== value) return null;
    return (
      <div data-ui="tabs-content" data-value={value} {...rest}>
        {children}
      </div>
    );
  };
  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn((onFulfilled: (v: unknown) => unknown, _onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled)
    ),
    catch: vi.fn((onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected)),
  };
  const mockFrom = vi.fn(() => builder);
  return { supabase: { from: mockFrom } };
});

import { JarvisAzureMonitoring } from './JarvisAzureMonitoring';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('JarvisAzureMonitoring', () => {
  it('affiche le chargement puis le succès avec des valeurs métier et permet de refetch', async () => {
    useAIUsageStatsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: refetchMock,
      isRefetching: false,
    });

    const { rerender } = renderWithClient(<JarvisAzureMonitoring />);

    expect(screen.getAllByTestId ? screen.queryAllByTestId('jarvis-azure-skeleton-0') : []).toBeDefined();
    expect(screen.getAllByText((_, el) => el?.getAttribute('data-ui') === 'skeleton').length).toBeGreaterThan(0);

    useAIUsageStatsMock.mockReturnValue({
      data: STATS_SUCCESS,
      isLoading: false,
      error: null,
      refetch: refetchMock,
      isRefetching: false,
    });

    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <JarvisAzureMonitoring />
      </QueryClientProvider>
    );

    expect(screen.getByText('Azure GPT-5 Monitoring')).toBeTruthy();
    expect(screen.getByText('Appels (30j)')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
    expect(screen.getByText("12 aujourd'hui")).toBeTruthy();

    expect(screen.getByText('Taux de succès')).toBeTruthy();
    expect(screen.getByText('98.7%')).toBeTruthy();
    expect(screen.getByText('1 erreur(s) récente(s)')).toBeTruthy();

    expect(screen.getByText('Latence moy.')).toBeTruthy();
    expect(formatDurationMock).toHaveBeenCalledWith(1534);
    expect(screen.getByText('1534 ms')).toBeTruthy();
    expect(screen.getByText('P99: 9000 ms')).toBeTruthy();

    expect(screen.getByText('Coût estimé')).toBeTruthy();
    expect(formatCostMock).toHaveBeenCalledWith(4.56);
    expect(screen.getByText('4.56 eur')).toBeTruthy();
    expect(formatTokensMock).toHaveBeenCalledWith(98765);
    expect(screen.getByText('98765 tok tokens')).toBeTruthy();

    expect(screen.getByText('Par type de traitement')).toBeTruthy();
    expect(getProcessingTypeLabelMock).toHaveBeenCalledWith('extraction');
    expect(screen.getByText('LABEL:extraction')).toBeTruthy();

    const refreshBtn = screen.getByRole('button', { name: /Actualiser/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it("affiche l'état d'erreur et permet de réessayer", async () => {
    useAIUsageStatsMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'x' },
      refetch: refetchMock,
      isRefetching: false,
    });

    renderWithClient(<JarvisAzureMonitoring />);

    expect(screen.getByText('Erreur lors du chargement des statistiques')).toBeTruthy();

    const retryBtn = screen.getByRole('button', { name: /Réessayer/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(refetchMock).toHaveBeenCalled();
  });
});