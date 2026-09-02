/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChurnTrendChart } from './ChurnTrendChart';

const {
  CARD_TEXT,
  EMPTY_TEXT,
  CHART_DATA,
  responsiveContainerSpy,
  lineChartSpy,
  xAxisSpy,
  yAxisSpy,
  tooltipSpy,
  legendSpy,
  cartesianGridSpy,
  lineSpy,
  skeletonSpy,
  cardSpy,
  cardHeaderSpy,
  cardTitleSpy,
  cardContentSpy,
} = vi.hoisted(() => ({
  CARD_TEXT: 'Évolution 90 jours',
  EMPTY_TEXT: 'Pas encore d’historique. Lancez « Recalculer » pour générer le premier snapshot.'.replace('’', "'").replace("d'historique", "d'historique"),
  CHART_DATA: [
    { day: '2024-01-05', critical: 2, high: 3, medium: 5, low: 8 },
    { day: '2024-01-10', critical: 1, high: 4, medium: 6, low: 9 },
  ],
  responsiveContainerSpy: vi.fn(),
  lineChartSpy: vi.fn(),
  xAxisSpy: vi.fn(),
  yAxisSpy: vi.fn(),
  tooltipSpy: vi.fn(),
  legendSpy: vi.fn(),
  cartesianGridSpy: vi.fn(),
  lineSpy: vi.fn(),
  skeletonSpy: vi.fn(),
  cardSpy: vi.fn(),
  cardHeaderSpy: vi.fn(),
  cardTitleSpy: vi.fn(),
  cardContentSpy: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => {
    cardSpy();
    return <section data-testid="card">{children}</section>;
  },
  CardHeader: ({ children }: { children: React.ReactNode }) => {
    cardHeaderSpy();
    return <header data-testid="card-header">{children}</header>;
  },
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => {
    cardTitleSpy(className);
    return <h3 data-testid="card-title" className={className}>{children}</h3>;
  },
  CardContent: ({ children }: { children: React.ReactNode }) => {
    cardContentSpy();
    return <div data-testid="card-content">{children}</div>;
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => {
    skeletonSpy(className);
    return <div data-testid="skeleton" className={className}>loading</div>;
  },
}));

vi.mock('lucide-react', () => ({
  TrendingUp: ({ className }: { className?: string }) => <svg data-testid="trending-up" className={className} />,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, width, height }: { children: React.ReactNode; width: string; height: number }) => {
    responsiveContainerSpy({ width, height });
    return <div data-testid="responsive-container">{children}</div>;
  },
  LineChart: ({ children, data, margin }: { children: React.ReactNode; data: unknown; margin: unknown }) => {
    lineChartSpy({ data, margin });
    return <div data-testid="line-chart">{children}</div>;
  },
  XAxis: (props: Record<string, unknown>) => {
    xAxisSpy(props);
    return <div data-testid="x-axis" />;
  },
  YAxis: (props: Record<string, unknown>) => {
    yAxisSpy(props);
    return <div data-testid="y-axis" />;
  },
  Tooltip: (props: Record<string, unknown>) => {
    tooltipSpy(props);
    return <div data-testid="tooltip" />;
  },
  Legend: (props: Record<string, unknown>) => {
    legendSpy(props);
    return <div data-testid="legend" />;
  },
  CartesianGrid: (props: Record<string, unknown>) => {
    cartesianGridSpy(props);
    return <div data-testid="cartesian-grid" />;
  },
  Line: (props: Record<string, unknown>) => {
    lineSpy(props);
    return <div data-testid={`line-${String(props.dataKey)}`} />;
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

describe('ChurnTrendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre et le skeleton pendant le chargement', () => {
    render(<ChurnTrendChart loading />, { wrapper: createWrapper() });

    expect(screen.getByText(CARD_TEXT)).toBeInTheDocument();
    expect(screen.getByTestId('trending-up')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(skeletonSpy).toHaveBeenCalledWith('h-[260px] w-full');
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pas encore d'historique/i)).not.toBeInTheDocument();
  });

  it('affiche le message vide quand il n’y a pas de données', () => {
    render(<ChurnTrendChart data={[]} loading={false} />, { wrapper: createWrapper() });

    expect(screen.getByText(CARD_TEXT)).toBeInTheDocument();
    expect(
      screen.getByText("Pas encore d'historique. Lancez « Recalculer » pour générer le premier snapshot.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('rend le graphique avec les labels formatés et les séries attendues', () => {
    render(<ChurnTrendChart data={CHART_DATA} loading={false} />, { wrapper: createWrapper() });

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();

    expect(responsiveContainerSpy).toHaveBeenCalledWith({ width: '100%', height: 260 });

    expect(lineChartSpy).toHaveBeenCalledTimes(1);
    const lineChartArg = lineChartSpy.mock.calls[0][0] as {
      data: Array<{
        day: string;
        critical: number;
        high: number;
        medium: number;
        low: number;
        label: string;
      }>;
      margin: { top: number; right: number; bottom: number; left: number };
    };

    expect(lineChartArg.margin).toEqual({ top: 5, right: 10, bottom: 0, left: -10 });
    expect(lineChartArg.data).toHaveLength(2);
    expect(lineChartArg.data[0]).toMatchObject({
      day: '2024-01-05',
      critical: 2,
      high: 3,
      medium: 5,
      low: 8,
      label: '05 janv.',
    });
    expect(lineChartArg.data[1]).toMatchObject({
      day: '2024-01-10',
      critical: 1,
      high: 4,
      medium: 6,
      low: 9,
      label: '10 janv.',
    });

    expect(xAxisSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: 'label',
        tick: { fontSize: 11 },
        interval: 'preserveStartEnd',
      })
    );
    expect(yAxisSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tick: { fontSize: 11 },
      })
    );
    expect(cartesianGridSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        strokeDasharray: '3 3',
        className: 'stroke-muted',
      })
    );
    expect(tooltipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contentStyle: expect.objectContaining({
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 8,
          fontSize: 12,
        }),
      })
    );
    expect(legendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        wrapperStyle: { fontSize: 12 },
      })
    );

    expect(lineSpy).toHaveBeenCalledTimes(4);
    const lineCalls = lineSpy.mock.calls.map((call) => call[0] as Record<string, unknown>);

    expect(lineCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'monotone',
          dataKey: 'critical',
          name: 'Critique',
          stroke: 'hsl(0 84% 60%)',
          strokeWidth: 2,
          dot: false,
        }),
        expect.objectContaining({
          type: 'monotone',
          dataKey: 'high',
          name: 'Élevé',
          stroke: 'hsl(25 95% 53%)',
          strokeWidth: 2,
          dot: false,
        }),
        expect.objectContaining({
          type: 'monotone',
          dataKey: 'medium',
          name: 'Modéré',
          stroke: 'hsl(45 93% 47%)',
          strokeWidth: 2,
          dot: false,
        }),
        expect.objectContaining({
          type: 'monotone',
          dataKey: 'low',
          name: 'Faible',
          stroke: 'hsl(142 76% 36%)',
          strokeWidth: 2,
          dot: false,
        }),
      ])
    );

    expect(screen.getByTestId('line-critical')).toBeInTheDocument();
    expect(screen.getByTestId('line-high')).toBeInTheDocument();
    expect(screen.getByTestId('line-medium')).toBeInTheDocument();
    expect(screen.getByTestId('line-low')).toBeInTheDocument();
  });

  it('utilise un tableau vide par défaut si data est absent', () => {
    render(<ChurnTrendChart loading={false} />, { wrapper: createWrapper() });

    expect(
      screen.getByText("Pas encore d'historique. Lancez « Recalculer » pour générer le premier snapshot.")
    ).toBeInTheDocument();
    expect(lineChartSpy).not.toHaveBeenCalled();
    expect(responsiveContainerSpy).not.toHaveBeenCalled();
  });
});