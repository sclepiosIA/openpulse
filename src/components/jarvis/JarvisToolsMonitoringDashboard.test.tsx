import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisToolsMonitoringDashboard } from './JarvisToolsMonitoringDashboard';
import { useJarvisToolsMonitoring } from '@/hooks/jarvis/useJarvisToolsMonitoring';

const mocks = vi.hoisted(() => {
  const mockRefetch = vi.fn();

  const monitoringData = {
    totals: {
      totalCalls: 1234,
      totalSuccess: 1141,
      totalErrors: 93,
      overallSuccessRate: 92.5,
      avgLatency: 245,
      p50Latency: 180,
      p90Latency: 610,
      p95Latency: 820,
      p99Latency: 1250,
      estimatedCost: 4.5,
      totalTokens: 48500,
    },
    tools: [
      {
        toolName: 'search_web',
        category: 'search',
        callCount: 900,
        successCount: 837,
        errorCount: 63,
        successRate: 93,
        errorRate: 7,
        avgLatencyMs: 260,
        p50LatencyMs: 190,
        p90LatencyMs: 720,
        p95LatencyMs: 890,
        p99LatencyMs: 1300,
        estimatedCost: 2.1,
        totalTokens: 28000,
        inputTokens: 18000,
        outputTokens: 10000,
        lastCalledAt: '2024-05-10T10:15:00.000Z',
        trend: {
          callCountChange: 15.2,
          callsChange: 15.2,
          latencyChange: -6.5,
          successRateChange: 1.1,
          successChange: 1.1,
          errorChange: -3.4,
          costChange: 8.2,
        },
        recentErrors: [
          {
            message: 'quota',
            errorMessage: 'quota',
            count: 4,
            lastSeenAt: '2024-05-10T10:12:00.000Z',
            timestamp: '2024-05-10T10:12:00.000Z',
          },
        ],
      },
      {
        toolName: 'memory_lookup',
        category: 'memory',
        callCount: 250,
        successCount: 242,
        errorCount: 8,
        successRate: 96.8,
        errorRate: 3.2,
        avgLatencyMs: 110,
        p50LatencyMs: 90,
        p90LatencyMs: 240,
        p95LatencyMs: 310,
        p99LatencyMs: 480,
        estimatedCost: 1.2,
        totalTokens: 14000,
        inputTokens: 9000,
        outputTokens: 5000,
        lastCalledAt: '2024-05-10T10:18:00.000Z',
        trend: {
          callCountChange: 4.5,
          callsChange: 4.5,
          latencyChange: -12.4,
          successRateChange: 0.8,
          successChange: 0.8,
          errorChange: -1.2,
          costChange: 2.1,
        },
        recentErrors: [],
      },
      {
        toolName: 'calendar_create',
        category: 'calendar',
        callCount: 84,
        successCount: 62,
        errorCount: 22,
        successRate: 73.8,
        errorRate: 26.2,
        avgLatencyMs: 420,
        p50LatencyMs: 350,
        p90LatencyMs: 980,
        p95LatencyMs: 1100,
        p99LatencyMs: 1600,
        estimatedCost: 1.2,
        totalTokens: 6500,
        inputTokens: 4000,
        outputTokens: 2500,
        lastCalledAt: '2024-05-10T09:55:00.000Z',
        trend: {
          callCountChange: -2.3,
          callsChange: -2.3,
          latencyChange: 18.9,
          successRateChange: -7.4,
          successChange: -7.4,
          errorChange: 9.6,
          costChange: -1.5,
        },
        recentErrors: [
          {
            message: 'timeout',
            errorMessage: 'timeout',
            count: 7,
            lastSeenAt: '2024-05-10T09:50:00.000Z',
            timestamp: '2024-05-10T09:50:00.000Z',
          },
        ],
      },
    ],
    dailyMetrics: [
      {
        date: '2024-05-08',
        toolName: 'search_web',
        calls: 300,
        avgLatency: 240,
        successRate: 94,
        tokens: 9000,
        errors: 18,
        cost: 0.7,
      },
      {
        date: '2024-05-08',
        toolName: 'memory_lookup',
        calls: 100,
        avgLatency: 100,
        successRate: 98,
        tokens: 4000,
        errors: 2,
        cost: 0.4,
      },
      {
        date: '2024-05-09',
        toolName: 'search_web',
        calls: 600,
        avgLatency: 270,
        successRate: 92.5,
        tokens: 19000,
        errors: 45,
        cost: 1.4,
      },
      {
        date: '2024-05-09',
        toolName: 'calendar_create',
        calls: 84,
        avgLatency: 420,
        successRate: 73.8,
        tokens: 6500,
        errors: 22,
        cost: 1.2,
      },
    ],
    hourlyMetrics: [
      { hour: '09:00', calls: 84, errors: 22, avgLatency: 420, successRate: 73.8, tokens: 6500 },
      { hour: '10:00', calls: 350, errors: 18, avgLatency: 230, successRate: 94.8, tokens: 13000 },
    ],
    latencyDistribution: [
      { bucket: '<100ms', count: 180, percentage: 14.6 },
      { bucket: '100-250ms', count: 520, percentage: 42.1 },
      { bucket: '250-500ms', count: 310, percentage: 25.1 },
      { bucket: '500ms-1s', count: 160, percentage: 13 },
      { bucket: '>1s', count: 64, percentage: 5.2 },
    ],
    costByTool: [
      { toolName: 'search_web', category: 'search', cost: 2.1, estimatedCost: 2.1, tokens: 28000, totalTokens: 28000, calls: 900, callCount: 900, percentage: 46.7 },
      { toolName: 'memory_lookup', category: 'memory', cost: 1.2, estimatedCost: 1.2, tokens: 14000, totalTokens: 14000, calls: 250, callCount: 250, percentage: 26.7 },
      { toolName: 'calendar_create', category: 'calendar', cost: 1.2, estimatedCost: 1.2, tokens: 6500, totalTokens: 6500, calls: 84, callCount: 84, percentage: 26.7 },
    ],
    errorBreakdown: [
      { error: 'quota', message: 'quota', errorMessage: 'quota', count: 4, percentage: 4.3 },
      { error: 'timeout', message: 'timeout', errorMessage: 'timeout', count: 7, percentage: 7.5 },
    ],
    errorsByTool: [
      { toolName: 'search_web', count: 63, errorCount: 63, totalCalls: 900, callCount: 900, errorRate: 7, percentage: 67.7 },
      { toolName: 'calendar_create', count: 22, errorCount: 22, totalCalls: 84, callCount: 84, errorRate: 26.2, percentage: 23.7 },
      { toolName: 'memory_lookup', count: 8, errorCount: 8, totalCalls: 250, callCount: 250, errorRate: 3.2, percentage: 8.6 },
    ],
    topErrorTools: [
      {
        toolName: 'search_web',
        category: 'search',
        count: 63,
        errorCount: 63,
        totalCalls: 900,
        callCount: 900,
        errorRate: 7,
        percentage: 67.7,
        recentErrors: [
          {
            message: 'quota',
            errorMessage: 'quota',
            count: 4,
            lastSeenAt: '2024-05-10T10:12:00.000Z',
            timestamp: '2024-05-10T10:12:00.000Z',
          },
        ],
        commonErrors: [
          { message: 'quota', errorMessage: 'quota', count: 4, percentage: 4.3 },
        ],
      },
      {
        toolName: 'calendar_create',
        category: 'calendar',
        count: 22,
        errorCount: 22,
        totalCalls: 84,
        callCount: 84,
        errorRate: 26.2,
        percentage: 23.7,
        recentErrors: [
          {
            message: 'timeout',
            errorMessage: 'timeout',
            count: 7,
            lastSeenAt: '2024-05-10T09:50:00.000Z',
            timestamp: '2024-05-10T09:50:00.000Z',
          },
        ],
        commonErrors: [
          { message: 'timeout', errorMessage: 'timeout', count: 7, percentage: 7.5 },
        ],
      },
    ],
    recentErrors: [
      {
        toolName: 'calendar_create',
        message: 'timeout',
        errorMessage: 'timeout',
        timestamp: '2024-05-10T09:50:00.000Z',
        lastSeenAt: '2024-05-10T09:50:00.000Z',
        count: 7,
      },
      {
        toolName: 'search_web',
        message: 'quota',
        errorMessage: 'quota',
        timestamp: '2024-05-10T10:12:00.000Z',
        lastSeenAt: '2024-05-10T10:12:00.000Z',
        count: 4,
      },
    ],
  };

  const loadingReturn = {
    data: undefined,
    error: null,
    isLoading: true,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
  };

  const successReturn = {
    data: monitoringData,
    error: null,
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
  };

  const errorReturn = {
    data: null,
    error: { message: 'x' },
    isLoading: false,
    isError: true,
    isRefetching: false,
    refetch: mockRefetch,
  };

  const state = {
    mode: 'success' as 'loading' | 'success' | 'error',
  };

  const mockUseJarvisToolsMonitoring = vi.fn((period: number) => {
    void period;
    if (state.mode === 'loading') return loadingReturn;
    if (state.mode === 'error') return errorReturn;
    return successReturn;
  });

  return {
    monitoringData,
    mockRefetch,
    mockUseJarvisToolsMonitoring,
    state,
  };
});

vi.mock('framer-motion', async () => {
  const React = await import('react');

  type MotionProps = {
    children?: ReactNode;
    className?: string;
  };

  const motion = new Proxy(
    {},
    {
      get: (_target, property: string | symbol) => {
        const tag = typeof property === 'string' ? property : 'div';
        return ({ children, className }: MotionProps) =>
          React.createElement(tag, { className }, children);
      },
    },
  );

  return { motion };
});

vi.mock('lucide-react', async () => {
  const React = await import('react');

  const createIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) =>
      React.createElement('svg', {
        className,
        'data-testid': `icon-${name}`,
        'aria-hidden': 'true',
      });
    return Icon;
  };

  return {
    Activity: createIcon('activity'),
    Timer: createIcon('timer'),
    CheckCircle2: createIcon('check-circle-2'),
    XCircle: createIcon('x-circle'),
    DollarSign: createIcon('dollar-sign'),
    TrendingUp: createIcon('trending-up'),
    Zap: createIcon('zap'),
    AlertTriangle: createIcon('alert-triangle'),
    BarChart3: createIcon('bar-chart-3'),
    Cpu: createIcon('cpu'),
    Filter: createIcon('filter'),
    RefreshCw: createIcon('refresh-cw'),
  };
});

vi.mock('recharts', async () => {
  const React = await import('react');

  type ChartProps = {
    children?: ReactNode;
    data?: readonly unknown[];
    dataKey?: string;
  };

  const Container = ({ children }: ChartProps) =>
    React.createElement('div', { 'data-testid': 'responsive-container' }, children);

  const Chart = ({ children, data }: ChartProps) =>
    React.createElement(
      'div',
      { 'data-testid': 'chart', 'data-count': String(data?.length ?? 0) },
      children,
    );

  const Primitive = ({ children, dataKey }: ChartProps) =>
    React.createElement('div', { 'data-testid': dataKey ? `chart-${dataKey}` : 'chart-part' }, children);

  const Empty = () => null;

  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    Area: Primitive,
    BarChart: Chart,
    Bar: Primitive,
    XAxis: Empty,
    YAxis: Empty,
    CartesianGrid: Empty,
    Tooltip: Empty,
    Cell: Empty,
    PieChart: Chart,
    Pie: Primitive,
    Legend: Empty,
  };
});

vi.mock('@/components/ui/card', async () => {
  const React = await import('react');

  type Props = {
    children?: ReactNode;
    className?: string;
  };

  const make = (testId: string, tag: 'div' | 'h3' | 'p' = 'div') => {
    const Component = ({ children, className }: Props) =>
      React.createElement(tag, { className, 'data-testid': testId }, children);
    return Component;
  };

  return {
    Card: make('card'),
    CardHeader: make('card-header'),
    CardTitle: make('card-title', 'h3'),
    CardDescription: make('card-description', 'p'),
    CardContent: make('card-content'),
    CardFooter: make('card-footer'),
  };
});

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react');

  const Badge = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className, 'data-testid': 'badge' }, children);

  return { Badge, badgeVariants: vi.fn(() => '') };
});

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');

  type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  };

  const Button = ({ children, variant, size, asChild, ...props }: Props) => {
    void variant;
    void size;
    void asChild;
    return React.createElement('button', props, children);
  };

  return { Button, buttonVariants: vi.fn(() => '') };
});

vi.mock('@/components/ui/progress', async () => {
  const React = await import('react');

  const Progress = ({ value, className }: { value?: number; className?: string }) =>
    React.createElement('div', {
      className,
      role: 'progressbar',
      'aria-valuenow': value ?? 0,
      'data-testid': 'progress',
    });

  return { Progress };
});

vi.mock('@/components/ui/scroll-area', async () => {
  const React = await import('react');

  const ScrollArea = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className, 'data-testid': 'scroll-area' }, children);

  const ScrollBar = ({ className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className, 'data-testid': 'scroll-bar' });

  return { ScrollArea, ScrollBar };
});

vi.mock('@/components/ui/tabs', async () => {
  const React = await import('react');

  type TabsProps = {
    children?: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
  };

  type TriggerProps = {
    children?: ReactNode;
    value?: string;
    className?: string;
  };

  const Tabs = ({ children, value, className }: TabsProps) =>
    React.createElement('div', { className, 'data-testid': 'tabs', 'data-value': value }, children);

  const TabsList = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className, 'data-testid': 'tabs-list' }, children);

  const TabsTrigger = ({ children, value, className }: TriggerProps) =>
    React.createElement('button', { className, type: 'button', 'data-testid': `tab-${value ?? 'unknown'}` }, children);

  const TabsContent = ({ children, value, className }: TriggerProps) =>
    React.createElement('div', { className, 'data-testid': `tab-content-${value ?? 'unknown'}` }, children);

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');

  type SelectProps = {
    children?: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  };

  type SelectItemProps = {
    children?: ReactNode;
    value: string;
  };

  const Select = ({ children, value }: SelectProps) =>
    React.createElement('div', { 'data-testid': 'select', 'data-value': value }, children);

  const SelectTrigger = ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', { className, 'data-testid': 'select-trigger' }, children);

  const SelectContent = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', { 'data-testid': 'select-content' }, children);

  const SelectItem = ({ children, value }: SelectItemProps) =>
    React.createElement('div', { 'data-testid': `select-item-${value}` }, children);

  const SelectValue = () => React.createElement('span', { 'data-testid': 'select-value' });

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

vi.mock('@/components/ui/table', async () => {
  const React = await import('react');

  type Props = {
    children?: ReactNode;
    className?: string;
  };

  const Table = ({ children, className }: Props) =>
    React.createElement('table', { className, 'data-testid': 'table' }, children);

  const TableBody = ({ children, className }: Props) =>
    React.createElement('tbody', { className, 'data-testid': 'table-body' }, children);

  const TableHead = ({ children, className }: Props) =>
    React.createElement('th', { className }, children);

  const TableHeader = ({ children, className }: Props) =>
    React.createElement('thead', { className }, children);

  const TableRow = ({ children, className }: Props) =>
    React.createElement('tr', { className }, children);

  return { Table, TableBody, TableHead, TableHeader, TableRow };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: readonly unknown[]) => classes.filter((value) => typeof value === 'string' && value.length > 0).join(' '),
}));

vi.mock('@/hooks/jarvis/useJarvisToolsMonitoring', () => ({
  useJarvisToolsMonitoring: mocks.mockUseJarvisToolsMonitoring,
  formatLatency: (value: number) => `${value} ms`,
  formatCost: (value: number) => `${value.toFixed(2)} €`,
  getHealthStatus: (successRate: number, avgLatency: number) => {
    if (successRate >= 98 && avgLatency < 200) return 'excellent';
    if (successRate >= 90 && avgLatency < 500) return 'good';
    if (successRate >= 75) return 'degraded';
    return 'critical';
  },
}));

vi.mock('./JarvisToolsMonitoringParts', async () => {
  const React = await import('react');

  type KpiProps = {
    title: string;
    value: string;
    subtitle: string;
    icon?: ReactNode;
    colorClass?: string;
  };

  type Tool = {
    toolName: string;
    callCount: number;
    successRate: number;
    avgLatencyMs: number;
    p90LatencyMs: number;
    estimatedCost: number;
  };

  type ToolRowProps = {
    tool: Tool;
    isExpanded: boolean;
    onToggle: () => void;
  };

  const KPICard = ({ title, value, subtitle, icon, colorClass }: KpiProps) => {
    void icon;
    void colorClass;
    return React.createElement(
      'section',
      { 'data-testid': `kpi-${title}` },
      React.createElement('span', null, title),
      React.createElement('strong', null, value),
      React.createElement('small', null, subtitle),
    );
  };

  const ToolDetailRow = ({ tool, isExpanded, onToggle }: ToolRowProps) =>
    React.createElement(
      'tr',
      { 'data-testid': `tool-row-${tool.toolName}`, 'data-expanded': String(isExpanded) },
      React.createElement('td', null, tool.toolName),
      React.createElement('td', null, String(tool.callCount)),
      React.createElement('td', null, `${tool.successRate}%`),
      React.createElement('td', null, `${tool.avgLatencyMs} ms`),
      React.createElement('td', null, `${tool.p90LatencyMs} ms`),
      React.createElement('td', null, `${tool.estimatedCost.toFixed(2)} €`),
      React.createElement(
        'td',
        null,
        React.createElement('button', { type: 'button', onClick: onToggle }, 'ouvrir'),
      ),
    );

  return {
    KPICard,
    ToolDetailRow,
    HEALTH_COLORS: {
      excellent: { border: 'border-emerald', bg: 'bg-emerald', text: 'text-emerald' },
      good: { border: 'border-sky', bg: 'bg-sky', text: 'text-sky' },
      degraded: { border: 'border-amber', bg: 'bg-amber', text: 'text-amber' },
      critical: { border: 'border-red', bg: 'bg-red', text: 'text-red' },
    },
    CHART_COLORS: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'],
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
}

function renderDashboard() {
  return render(<JarvisToolsMonitoringDashboard />, { wrapper: createWrapper() });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.state.mode = 'success';
});

describe('JarvisToolsMonitoringDashboard', () => {
  it('affiche un état de chargement avec quatre cartes skeleton et appelle le hook sur 30 jours', () => {
    mocks.state.mode = 'loading';

    const { container } = renderDashboard();

    expect(vi.mocked(useJarvisToolsMonitoring)).toHaveBeenCalledWith(30);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(container.querySelectorAll('.h-24')).toHaveLength(4);
    expect(screen.queryByText('Monitoring Outils Jarvis')).toBeNull();
  });

  it('affiche les métriques métier, le statut de santé et les outils triés par nombre d’appels', () => {
    renderDashboard();

    expect(screen.getByText('Monitoring Outils Jarvis')).toBeInTheDocument();
    expect(screen.getByText('Performance temps réel des 3 outils actifs')).toBeInTheDocument();

    expect(screen.getByTestId('kpi-Appels totaux')).toHaveTextContent('1,234');
    expect(screen.getByTestId('kpi-Appels totaux')).toHaveTextContent('3 outils');
    expect(screen.getByTestId('kpi-Taux de succès')).toHaveTextContent('92.5%');
    expect(screen.getByTestId('kpi-Taux de succès')).toHaveTextContent('1,141 succès');
    expect(screen.getByTestId('kpi-Latence moyenne')).toHaveTextContent('245 ms');
    expect(screen.getByTestId('kpi-Latence moyenne')).toHaveTextContent('P90: 610 ms');
    expect(screen.getByTestId('kpi-Coût estimé')).toHaveTextContent('4.50 €');
    expect(screen.getByTestId('kpi-Coût estimé')).toHaveTextContent('49K tokens');

    expect(screen.getByText('État global du système')).toBeInTheDocument();
    expect(screen.getByText('Performance globale satisfaisante')).toBeInTheDocument();
    expect(screen.getByText('Bon')).toBeInTheDocument();

    const rows = screen.getAllByTestId(/^tool-row-/);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('search_web');
    expect(rows[0]).toHaveTextContent('900');
    expect(rows[1]).toHaveTextContent('memory_lookup');
    expect(rows[1]).toHaveTextContent('250');
    expect(rows[2]).toHaveTextContent('calendar_create');
    expect(rows[2]).toHaveTextContent('84');
  });

  it('déclenche le refetch depuis le bouton de rafraîchissement', async () => {
    renderDashboard();

    const refreshIcon = screen.getByTestId('icon-refresh-cw');
    const button = refreshIcon.closest('button');

    if (button === null) {
      throw new Error('refresh button not found');
    }

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mocks.mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('ne rend pas le dashboard quand le hook retourne une erreur sans données', () => {
    mocks.state.mode = 'error';

    const { container } = renderDashboard();

    expect(vi.mocked(useJarvisToolsMonitoring)).toHaveBeenCalledWith(30);
    expect(vi.mocked(useJarvisToolsMonitoring).mock.results[0]?.value).toMatchObject({
      data: null,
      error: { message: 'x' },
      isError: true,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('ouvre une ligne outil via le callback de détail sans perdre les données affichées', async () => {
    renderDashboard();

    const row = screen.getByTestId('tool-row-search_web');
    const toggle = row.querySelector('button');

    if (toggle === null) {
      throw new Error('tool toggle not found');
    }

    expect(row).toHaveAttribute('data-expanded', 'false');

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(screen.getByTestId('tool-row-search_web')).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByTestId('tool-row-search_web')).toHaveTextContent('900');
    expect(screen.getByTestId('tool-row-search_web')).toHaveTextContent('2.10 €');
  });
});