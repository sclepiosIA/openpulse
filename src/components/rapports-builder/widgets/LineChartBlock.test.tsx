import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LineChartBlock } from './LineChartBlock';

const {
  REPORT_SUCCESS,
  useReportDataMock,
  cardPropsSpy,
  cardHeaderPropsSpy,
  cardTitlePropsSpy,
  cardContentPropsSpy,
  skeletonPropsSpy,
  lineChartPropsSpy,
  xAxisPropsSpy,
  yAxisPropsSpy,
  linePropsSpy,
  responsiveContainerPropsSpy,
  noSourceStateSpy,
  noDataStateSpy,
} = vi.hoisted(() => ({
  REPORT_SUCCESS: {
    rows: [
      { mois: 'Jan', count: 12 },
      { mois: 'Fév', count: 18 },
      { mois: 'Mar', count: 7 },
    ],
  },
  useReportDataMock: vi.fn(),
  cardPropsSpy: vi.fn(),
  cardHeaderPropsSpy: vi.fn(),
  cardTitlePropsSpy: vi.fn(),
  cardContentPropsSpy: vi.fn(),
  skeletonPropsSpy: vi.fn(),
  lineChartPropsSpy: vi.fn(),
  xAxisPropsSpy: vi.fn(),
  yAxisPropsSpy: vi.fn(),
  linePropsSpy: vi.fn(),
  responsiveContainerPropsSpy: vi.fn(),
  noSourceStateSpy: vi.fn(),
  noDataStateSpy: vi.fn(),
}));

vi.mock('@/hooks/analytics/useReportData', () => ({
  useReportData: useReportDataMock,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardPropsSpy(props);
    return <section data-testid="card">{children}</section>;
  },
  CardHeader: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardHeaderPropsSpy(props);
    return <header data-testid="card-header">{children}</header>;
  },
  CardTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardTitlePropsSpy(props);
    return <h3 data-testid="card-title">{children}</h3>;
  },
  CardContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardContentPropsSpy(props);
    return <div data-testid="card-content">{children}</div>;
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => {
    skeletonPropsSpy(props);
    return <div data-testid="skeleton" />;
  },
}));

vi.mock('./WidgetEmptyState', () => ({
  NoSourceState: () => {
    noSourceStateSpy();
    return <div data-testid="no-source-state">Aucune source</div>;
  },
  NoDataState: () => {
    noDataStateSpy();
    return <div data-testid="no-data-state">Aucune donnée</div>;
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    responsiveContainerPropsSpy(props);
    return <div data-testid="responsive-container">{children}</div>;
  },
  LineChart: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    lineChartPropsSpy(props);
    return <div data-testid="line-chart">{children}</div>;
  },
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Line: (props: Record<string, unknown>) => {
    linePropsSpy(props);
    return <div data-testid="line" />;
  },
  Tooltip: () => <div data-testid="tooltip" />,
  XAxis: (props: Record<string, unknown>) => {
    xAxisPropsSpy(props);
    return <div data-testid="x-axis" />;
  },
  YAxis: (props: Record<string, unknown>) => {
    yAxisPropsSpy(props);
    return <div data-testid="y-axis" />;
  },
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

describe('LineChartBlock', () => {
  const baseWidget = {
    id: 'w1',
    title: 'Évolution mensuelle',
    source: 'orders',
    dimension: 'mois',
    measure: 'count',
  };

  const baseFilters = {
    dateRange: '30d',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre et l’état sans source quand widget.source est absent', () => {
    useReportDataMock.mockReturnValue({
      data: REPORT_SUCCESS,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <LineChartBlock widget={{ ...baseWidget, source: '' }} filters={baseFilters} />
      </Wrapper>,
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Évolution mensuelle');
    expect(screen.getByTestId('no-source-state')).toBeInTheDocument();
    expect(noSourceStateSpy).toHaveBeenCalledTimes(1);
    expect(useReportDataMock).toHaveBeenCalledWith({
      source: '',
      filters: baseFilters,
    });
  });

  it('affiche le skeleton pendant le chargement', () => {
    useReportDataMock.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <LineChartBlock widget={baseWidget} filters={baseFilters} />
      </Wrapper>,
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(skeletonPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'h-full w-full' }),
    );
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('affiche une erreur avec le message en title quand le hook échoue', () => {
    useReportDataMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('x'),
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <LineChartBlock widget={baseWidget} filters={baseFilters} />
      </Wrapper>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erreur de chargement');
    expect(alert).toHaveAttribute('title', 'x');
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('affiche l’état no data quand rows est vide', () => {
    useReportDataMock.mockReturnValue({
      data: { rows: [] },
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <LineChartBlock widget={baseWidget} filters={baseFilters} />
      </Wrapper>,
    );

    expect(screen.getByTestId('no-data-state')).toBeInTheDocument();
    expect(noDataStateSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('rend le graphique avec les bonnes clés métier en succès', () => {
    useReportDataMock.mockReturnValue({
      data: REPORT_SUCCESS,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <LineChartBlock widget={baseWidget} filters={baseFilters} />
      </Wrapper>,
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();

    expect(lineChartPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: REPORT_SUCCESS.rows,
        margin: { top: 5, right: 10, left: 0, bottom: 5 },
      }),
    );
    expect(xAxisPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: 'mois',
        tick: { fontSize: 11 },
      }),
    );
    expect(linePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: 'count',
        type: 'monotone',
        strokeWidth: 2,
        dot: { r: 3 },
      }),
    );
    expect(useReportDataMock).toHaveBeenCalledWith({
      source: 'orders',
      filters: baseFilters,
    });
  });

  it('utilise les valeurs par défaut dimension=mois et measure=count quand absentes', () => {
    useReportDataMock.mockReturnValue({
      data: REPORT_SUCCESS,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <LineChartBlock
          widget={{ ...baseWidget, dimension: undefined, measure: undefined }}
          filters={baseFilters}
        />
      </Wrapper>,
    );

    expect(xAxisPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: 'mois',
      }),
    );
    expect(linePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: 'count',
      }),
    );
  });
});