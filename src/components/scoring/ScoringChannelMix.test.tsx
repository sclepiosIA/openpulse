// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScoringChannelMix } from './ScoringChannelMix';

const {
  cardProps,
  cardHeaderProps,
  cardContentProps,
  cardTitleProps,
  skeletonProps,
  responsiveContainerProps,
  barChartProps,
  xAxisProps,
  yAxisProps,
  tooltipProps,
  barProps,
  cartesianGridProps,
  gitBranchProps,
} = vi.hoisted(() => ({
  cardProps: vi.fn(),
  cardHeaderProps: vi.fn(),
  cardContentProps: vi.fn(),
  cardTitleProps: vi.fn(),
  skeletonProps: vi.fn(),
  responsiveContainerProps: vi.fn(),
  barChartProps: vi.fn(),
  xAxisProps: vi.fn(),
  yAxisProps: vi.fn(),
  tooltipProps: vi.fn(),
  barProps: vi.fn(),
  cartesianGridProps: vi.fn(),
  gitBranchProps: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => {
    cardProps({ children });
    return <div data-testid="card">{children}</div>;
  },
  CardHeader: ({ children }: { children: React.ReactNode }) => {
    cardHeaderProps({ children });
    return <div data-testid="card-header">{children}</div>;
  },
  CardContent: ({ children }: { children: React.ReactNode }) => {
    cardContentProps({ children });
    return <div data-testid="card-content">{children}</div>;
  },
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => {
    cardTitleProps({ children, className });
    return (
      <h2 data-testid="card-title" className={className}>
        {children}
      </h2>
    );
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => {
    skeletonProps({ className });
    return (
      <div data-testid="skeleton" className={className}>
        loading
      </div>
    );
  },
}));

vi.mock('lucide-react', () => ({
  GitBranch: ({ className }: { className?: string }) => {
    gitBranchProps({ className });
    return <svg data-testid="git-branch" className={className} />;
  },
}));

vi.mock('@/types/scoring', () => ({
  ATTRIBUTION_CHANNEL_LABELS: {
    google_ads: 'Google Ads',
    email: 'Email',
    organic_search: 'Recherche organique',
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, width, height }: { children: React.ReactNode; width: string; height: number }) => {
    responsiveContainerProps({ width, height });
    return <div data-testid="responsive-container">{children}</div>;
  },
  BarChart: ({
    children,
    data,
    layout,
    margin,
  }: {
    children: React.ReactNode;
    data: Array<{ label: string; weight: number; touchpoints: number }>;
    layout: string;
    margin: { top: number; right: number; bottom: number; left: number };
  }) => {
    barChartProps({ data, layout, margin });
    return (
      <div data-testid="bar-chart" data-layout={layout} data-points={JSON.stringify(data)}>
        {children}
      </div>
    );
  },
  Bar: (props: {
    dataKey: string;
    name: string;
    fill: string;
    radius: number[];
  }) => {
    barProps(props);
    return <div data-testid="bar" data-key={props.dataKey} data-name={props.name} />;
  },
  XAxis: (props: { type: string; tick: { fontSize: number } }) => {
    xAxisProps(props);
    return <div data-testid="x-axis" data-type={props.type} />;
  },
  YAxis: (props: { type: string; dataKey: string; tick: { fontSize: number }; width: number }) => {
    yAxisProps(props);
    return <div data-testid="y-axis" data-type={props.type} data-key={props.dataKey} data-width={String(props.width)} />;
  },
  Tooltip: (props: { contentStyle: Record<string, string | number> }) => {
    tooltipProps(props);
    return <div data-testid="tooltip" />;
  },
  CartesianGrid: (props: { strokeDasharray: string; className: string }) => {
    cartesianGridProps(props);
    return <div data-testid="cartesian-grid" />;
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ScoringChannelMix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le skeleton pendant le chargement', () => {
    const Wrapper = createWrapper();

    render(<ScoringChannelMix loading data={[]} />, { wrapper: Wrapper });

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByText("Aucun touchpoint enregistré.")).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(skeletonProps).toHaveBeenCalledWith({ className: 'h-[280px] w-full' });
    expect(screen.getByText("Mix d'attribution (90j)")).toBeInTheDocument();
  });

  it('affiche un état vide quand aucune donnée n’est fournie', () => {
    const Wrapper = createWrapper();

    render(<ScoringChannelMix data={[]} loading={false} />, { wrapper: Wrapper });

    expect(screen.getByText("Aucun touchpoint enregistré.")).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('affiche un état vide quand data est absente', () => {
    const Wrapper = createWrapper();

    render(<ScoringChannelMix />, { wrapper: Wrapper });

    expect(screen.getByText("Aucun touchpoint enregistré.")).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('transforme les données métier et configure le graphique correctement', () => {
    const Wrapper = createWrapper();

    const data = [
      { channel: 'google_ads', touchpoints: 12, total_weight: 45.5 },
      { channel: 'email', touchpoints: 4, total_weight: 10 },
      { channel: 'unknown_channel', touchpoints: 2, total_weight: 0 },
    ];

    render(<ScoringChannelMix data={data} loading={false} />, { wrapper: Wrapper });

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.queryByText("Aucun touchpoint enregistré.")).not.toBeInTheDocument();

    expect(barChartProps).toHaveBeenCalledTimes(1);
    expect(barChartProps).toHaveBeenCalledWith({
      data: [
        { label: 'Google Ads', weight: 45.5, touchpoints: 12 },
        { label: 'Email', weight: 10, touchpoints: 4 },
        { label: 'unknown_channel', weight: 0, touchpoints: 2 },
      ],
      layout: 'vertical',
      margin: { top: 5, right: 10, bottom: 5, left: 60 },
    });

    expect(responsiveContainerProps).toHaveBeenCalledWith({ width: '100%', height: 280 });
    expect(xAxisProps).toHaveBeenCalledWith({ type: 'number', tick: { fontSize: 11 } });
    expect(yAxisProps).toHaveBeenCalledWith({
      type: 'category',
      dataKey: 'label',
      tick: { fontSize: 11 },
      width: 90,
    });
    expect(barProps).toHaveBeenCalledWith({
      dataKey: 'weight',
      name: 'Poids',
      fill: 'hsl(var(--primary))',
      radius: [0, 4, 4, 0],
    });
    expect(cartesianGridProps).toHaveBeenCalledWith({
      strokeDasharray: '3 3',
      className: 'stroke-muted',
    });
    expect(tooltipProps).toHaveBeenCalledWith({
      contentStyle: {
        background: 'hsl(var(--popover))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 8,
        fontSize: 12,
      },
    });
  });

  it('convertit une valeur total_weight invalide en 0', () => {
    const Wrapper = createWrapper();

    const data = [{ channel: 'organic_search', touchpoints: 7, total_weight: Number.NaN }];

    render(<ScoringChannelMix data={data} />, { wrapper: Wrapper });

    expect(barChartProps).toHaveBeenCalledWith({
      data: [{ label: 'Recherche organique', weight: 0, touchpoints: 7 }],
      layout: 'vertical',
      margin: { top: 5, right: 10, bottom: 5, left: 60 },
    });
  });

  it('convertit une chaîne numérique en nombre pour total_weight', () => {
    const Wrapper = createWrapper();

    const data = [{ channel: 'email', touchpoints: 3, total_weight: '12.75' as unknown as number }];

    render(<ScoringChannelMix data={data} />, { wrapper: Wrapper });

    expect(barChartProps).toHaveBeenCalledWith({
      data: [{ label: 'Email', weight: 12.75, touchpoints: 3 }],
      layout: 'vertical',
      margin: { top: 5, right: 10, bottom: 5, left: 60 },
    });
  });

  it('rend le titre et l’icône avec les classes attendues', () => {
    const Wrapper = createWrapper();

    render(<ScoringChannelMix data={[]} />, { wrapper: Wrapper });

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    expect(screen.getByTestId('card-content')).toBeInTheDocument();
    expect(screen.getByTestId('card-title')).toHaveTextContent("Mix d'attribution (90j)");

    expect(cardTitleProps).toHaveBeenCalledWith({
      children: expect.anything(),
      className: 'flex items-center gap-2 text-base',
    });

    expect(gitBranchProps).toHaveBeenCalledWith({
      className: 'h-4 w-4 text-primary',
    });
  });
});