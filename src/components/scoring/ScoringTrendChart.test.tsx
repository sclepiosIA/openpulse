import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScoringTrendChart } from './ScoringTrendChart';

const {
  CARD_PROPS,
  CARD_HEADER_PROPS,
  CARD_CONTENT_PROPS,
  CARD_TITLE_PROPS,
  SKELETON_PROPS,
  RESPONSIVE_CONTAINER_PROPS,
  LINE_CHART_PROPS,
  X_AXIS_PROPS,
  Y_AXIS_PROPS,
  TOOLTIP_PROPS,
  LEGEND_PROPS,
  CARTESIAN_GRID_PROPS,
  LINE_PROPS,
  TRENDING_UP_PROPS,
  mockCard,
  mockCardHeader,
  mockCardContent,
  mockCardTitle,
  mockSkeleton,
  mockResponsiveContainer,
  mockLineChart,
  mockLine,
  mockXAxis,
  mockYAxis,
  mockTooltip,
  mockLegend,
  mockCartesianGrid,
  mockTrendingUp,
  mockFrom,
  AUTH_STATE,
  TREND_DATA,
} = vi.hoisted(() => {
  const cardProps: Array<Record<string, unknown>> = [];
  const cardHeaderProps: Array<Record<string, unknown>> = [];
  const cardContentProps: Array<Record<string, unknown>> = [];
  const cardTitleProps: Array<Record<string, unknown>> = [];
  const skeletonProps: Array<Record<string, unknown>> = [];
  const responsiveContainerProps: Array<Record<string, unknown>> = [];
  const lineChartProps: Array<Record<string, unknown>> = [];
  const xAxisProps: Array<Record<string, unknown>> = [];
  const yAxisProps: Array<Record<string, unknown>> = [];
  const tooltipProps: Array<Record<string, unknown>> = [];
  const legendProps: Array<Record<string, unknown>> = [];
  const cartesianGridProps: Array<Record<string, unknown>> = [];
  const lineProps: Array<Record<string, unknown>> = [];
  const trendingUpProps: Array<Record<string, unknown>> = [];

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
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };

  return {
    CARD_PROPS: cardProps,
    CARD_HEADER_PROPS: cardHeaderProps,
    CARD_CONTENT_PROPS: cardContentProps,
    CARD_TITLE_PROPS: cardTitleProps,
    SKELETON_PROPS: skeletonProps,
    RESPONSIVE_CONTAINER_PROPS: responsiveContainerProps,
    LINE_CHART_PROPS: lineChartProps,
    X_AXIS_PROPS: xAxisProps,
    Y_AXIS_PROPS: yAxisProps,
    TOOLTIP_PROPS: tooltipProps,
    LEGEND_PROPS: legendProps,
    CARTESIAN_GRID_PROPS: cartesianGridProps,
    LINE_PROPS: lineProps,
    TRENDING_UP_PROPS: trendingUpProps,
    mockCard: vi.fn((props: React.PropsWithChildren<Record<string, unknown>>) => {
      cardProps.push(props);
      return <div data-testid="card">{props.children}</div>;
    }),
    mockCardHeader: vi.fn((props: React.PropsWithChildren<Record<string, unknown>>) => {
      cardHeaderProps.push(props);
      return <div data-testid="card-header">{props.children}</div>;
    }),
    mockCardContent: vi.fn((props: React.PropsWithChildren<Record<string, unknown>>) => {
      cardContentProps.push(props);
      return <div data-testid="card-content">{props.children}</div>;
    }),
    mockCardTitle: vi.fn((props: React.PropsWithChildren<Record<string, unknown>>) => {
      cardTitleProps.push(props);
      return (
        <div data-testid="card-title" className={typeof props.className === 'string' ? props.className : undefined}>
          {props.children}
        </div>
      );
    }),
    mockSkeleton: vi.fn((props: Record<string, unknown>) => {
      skeletonProps.push(props);
      return <div data-testid="skeleton" className={typeof props.className === 'string' ? props.className : undefined} />;
    }),
    mockResponsiveContainer: vi.fn((props: React.PropsWithChildren<Record<string, unknown>>) => {
      responsiveContainerProps.push(props);
      return <div data-testid="responsive-container">{props.children}</div>;
    }),
    mockLineChart: vi.fn((props: React.PropsWithChildren<Record<string, unknown>>) => {
      lineChartProps.push(props);
      return <div data-testid="line-chart">{props.children}</div>;
    }),
    mockLine: vi.fn((props: Record<string, unknown>) => {
      lineProps.push(props);
      return <div data-testid={`line-${String(props.dataKey)}`} />;
    }),
    mockXAxis: vi.fn((props: Record<string, unknown>) => {
      xAxisProps.push(props);
      return <div data-testid="x-axis" />;
    }),
    mockYAxis: vi.fn((props: Record<string, unknown>) => {
      yAxisProps.push(props);
      return <div data-testid="y-axis" />;
    }),
    mockTooltip: vi.fn((props: Record<string, unknown>) => {
      tooltipProps.push(props);
      return <div data-testid="tooltip" />;
    }),
    mockLegend: vi.fn((props: Record<string, unknown>) => {
      legendProps.push(props);
      return <div data-testid="legend" />;
    }),
    mockCartesianGrid: vi.fn((props: Record<string, unknown>) => {
      cartesianGridProps.push(props);
      return <div data-testid="cartesian-grid" />;
    }),
    mockTrendingUp: vi.fn((props: Record<string, unknown>) => {
      trendingUpProps.push(props);
      return <svg data-testid="trending-up" className={typeof props.className === 'string' ? props.className : undefined} />;
    }),
    mockFrom: vi.fn(() => builder),
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    TREND_DATA: [
      { day: '2024-01-05', hot: 3, warm: 5, working: 7, cold: 11 },
      { day: '2024-03-14', hot: 4, warm: 6, working: 8, cold: 12 },
    ],
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: mockCard,
  CardHeader: mockCardHeader,
  CardContent: mockCardContent,
  CardTitle: mockCardTitle,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: mockSkeleton,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: mockResponsiveContainer,
  LineChart: mockLineChart,
  Line: mockLine,
  XAxis: mockXAxis,
  YAxis: mockYAxis,
  Tooltip: mockTooltip,
  Legend: mockLegend,
  CartesianGrid: mockCartesianGrid,
}));

vi.mock('lucide-react', () => ({
  TrendingUp: mockTrendingUp,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: React.PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ScoringTrendChart', () => {
  beforeEach(() => {
    CARD_PROPS.length = 0;
    CARD_HEADER_PROPS.length = 0;
    CARD_CONTENT_PROPS.length = 0;
    CARD_TITLE_PROPS.length = 0;
    SKELETON_PROPS.length = 0;
    RESPONSIVE_CONTAINER_PROPS.length = 0;
    LINE_CHART_PROPS.length = 0;
    X_AXIS_PROPS.length = 0;
    Y_AXIS_PROPS.length = 0;
    TOOLTIP_PROPS.length = 0;
    LEGEND_PROPS.length = 0;
    CARTESIAN_GRID_PROPS.length = 0;
    LINE_PROPS.length = 0;
    TRENDING_UP_PROPS.length = 0;
    vi.clearAllMocks();
  });

  it('affiche le chargement avec le titre et le skeleton', () => {
    const Wrapper = createWrapper();

    render(<ScoringTrendChart loading data={TREND_DATA} />, { wrapper: Wrapper });

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    expect(screen.getByTestId('card-content')).toBeInTheDocument();
    expect(screen.getByText('Évolution 90 jours')).toBeInTheDocument();
    expect(screen.getByTestId('trending-up')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/Pas encore d'historique/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();

    expect(SKELETON_PROPS[0]).toMatchObject({ className: 'h-[280px] w-full' });
    expect(CARD_TITLE_PROPS[0]).toMatchObject({ className: 'flex items-center gap-2 text-base' });
    expect(TRENDING_UP_PROPS[0]).toMatchObject({ className: 'h-4 w-4 text-primary' });
  });

  it('affiche le message vide quand aucune donnée n’est fournie', () => {
    const Wrapper = createWrapper();

    render(<ScoringTrendChart data={[]} loading={false} />, { wrapper: Wrapper });

    expect(
      screen.getByText("Pas encore d'historique. Lancez « Recalculer » pour générer un premier snapshot."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('rend le graphique avec les labels formatés et les séries métier attendues', () => {
    const Wrapper = createWrapper();

    render(<ScoringTrendChart data={TREND_DATA} loading={false} />, { wrapper: Wrapper });

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
    expect(screen.getByTestId('line-hot')).toBeInTheDocument();
    expect(screen.getByTestId('line-warm')).toBeInTheDocument();
    expect(screen.getByTestId('line-working')).toBeInTheDocument();
    expect(screen.getByTestId('line-cold')).toBeInTheDocument();

    expect(RESPONSIVE_CONTAINER_PROPS[0]).toMatchObject({ width: '100%', height: 280 });
    expect(LINE_CHART_PROPS[0]).toMatchObject({
      margin: { top: 5, right: 10, bottom: 0, left: -10 },
    });

    const chartProps = LINE_CHART_PROPS[0];
    const chartData = chartProps.data;
    expect(Array.isArray(chartData)).toBe(true);
    expect(chartData).toEqual([
      { day: '2024-01-05', hot: 3, warm: 5, working: 7, cold: 11, label: '05 janv.' },
      { day: '2024-03-14', hot: 4, warm: 6, working: 8, cold: 12, label: '14 mars' },
    ]);

    expect(X_AXIS_PROPS[0]).toMatchObject({
      dataKey: 'label',
      tick: { fontSize: 11 },
      interval: 'preserveStartEnd',
    });
    expect(Y_AXIS_PROPS[0]).toMatchObject({
      tick: { fontSize: 11 },
    });
    expect(TOOLTIP_PROPS[0]).toMatchObject({
      contentStyle: {
        background: 'hsl(var(--popover))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 8,
        fontSize: 12,
      },
    });
    expect(LEGEND_PROPS[0]).toMatchObject({
      wrapperStyle: { fontSize: 12 },
    });
    expect(CARTESIAN_GRID_PROPS[0]).toMatchObject({
      strokeDasharray: '3 3',
      className: 'stroke-muted',
    });

    expect(LINE_PROPS).toHaveLength(4);
    expect(LINE_PROPS[0]).toMatchObject({
      type: 'monotone',
      dataKey: 'hot',
      name: 'Chauds',
      stroke: 'hsl(142 76% 36%)',
      strokeWidth: 2,
      dot: false,
    });
    expect(LINE_PROPS[1]).toMatchObject({
      type: 'monotone',
      dataKey: 'warm',
      name: 'Tièdes',
      stroke: 'hsl(38 92% 50%)',
      strokeWidth: 2,
      dot: false,
    });
    expect(LINE_PROPS[2]).toMatchObject({
      type: 'monotone',
      dataKey: 'working',
      name: 'À travailler',
      stroke: 'hsl(25 95% 53%)',
      strokeWidth: 2,
      dot: false,
    });
    expect(LINE_PROPS[3]).toMatchObject({
      type: 'monotone',
      dataKey: 'cold',
      name: 'Froids',
      stroke: 'hsl(0 84% 60%)',
      strokeWidth: 2,
      dot: false,
    });
  });

  it('traite undefined comme une absence de données', () => {
    const Wrapper = createWrapper();

    render(<ScoringTrendChart loading={false} />, { wrapper: Wrapper });

    expect(
      screen.getByText("Pas encore d'historique. Lancez « Recalculer » pour générer un premier snapshot."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });
});