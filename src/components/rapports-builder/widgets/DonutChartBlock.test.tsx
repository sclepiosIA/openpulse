/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { DonutChartBlock } from './DonutChartBlock';

const {
  REPORT_LOADING,
  REPORT_SUCCESS,
  REPORT_ERROR,
  REPORT_EMPTY,
  useReportDataMock,
  cardPropsSpy,
  cardHeaderPropsSpy,
  cardContentPropsSpy,
  cardTitlePropsSpy,
  skeletonPropsSpy,
  responsiveContainerPropsSpy,
  piePropsSpy,
  tooltipPropsSpy,
  legendPropsSpy,
  cellPropsSpy,
  noSourceSpy,
  noDataSpy,
} = vi.hoisted(() => {
  const REPORT_LOADING = { data: undefined, isLoading: true, error: null };
  const REPORT_SUCCESS = {
    data: {
      rows: [
        { name: 'Alpha', count: 12 },
        { name: 'Beta', count: 7 },
        { name: 'Gamma', count: 3 },
      ],
    },
    isLoading: false,
    error: null,
  };
  const REPORT_ERROR = {
    data: null,
    isLoading: false,
    error: { message: 'x' },
  };
  const REPORT_EMPTY = {
    data: { rows: [] },
    isLoading: false,
    error: null,
  };

  return {
    REPORT_LOADING,
    REPORT_SUCCESS,
    REPORT_ERROR,
    REPORT_EMPTY,
    useReportDataMock: vi.fn(() => REPORT_SUCCESS),
    cardPropsSpy: vi.fn(),
    cardHeaderPropsSpy: vi.fn(),
    cardContentPropsSpy: vi.fn(),
    cardTitlePropsSpy: vi.fn(),
    skeletonPropsSpy: vi.fn(),
    responsiveContainerPropsSpy: vi.fn(),
    piePropsSpy: vi.fn(),
    tooltipPropsSpy: vi.fn(),
    legendPropsSpy: vi.fn(),
    cellPropsSpy: vi.fn(),
    noSourceSpy: vi.fn(),
    noDataSpy: vi.fn(),
  };
});

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
  CardContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardContentPropsSpy(props);
    return <div data-testid="card-content">{children}</div>;
  },
  CardTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardTitlePropsSpy(props);
    return <h3 data-testid="card-title">{children}</h3>;
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
    noSourceSpy();
    return <div data-testid="no-source">no-source</div>;
  },
  NoDataState: () => {
    noDataSpy();
    return <div data-testid="no-data">no-data</div>;
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    responsiveContainerPropsSpy(props);
    return <div data-testid="responsive-container">{children}</div>;
  },
  PieChart: ({ children }: React.PropsWithChildren) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    piePropsSpy(props);
    return <div data-testid="pie">{children}</div>;
  },
  Tooltip: (props: Record<string, unknown>) => {
    tooltipPropsSpy(props);
    return <div data-testid="tooltip" />;
  },
  Legend: (props: Record<string, unknown>) => {
    legendPropsSpy(props);
    return <div data-testid="legend" />;
  },
  Cell: (props: Record<string, unknown>) => {
    cellPropsSpy(props);
    return <div data-testid="cell" data-fill={String(props.fill)} />;
  },
}));

describe('DonutChartBlock', () => {
  const baseWidget = {
    title: 'Répartition',
    source: 'orders',
    dimension: 'name',
    measure: 'count',
  };

  const baseFilters = {
    dateRange: { from: '2024-01-01', to: '2024-01-31' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useReportDataMock.mockReturnValue(REPORT_SUCCESS);
  });

  it('affiche le titre et un skeleton pendant le chargement', () => {
    useReportDataMock.mockReturnValue(REPORT_LOADING);

    render(<DonutChartBlock widget={baseWidget} filters={baseFilters} />);

    expect(screen.getByTestId('card-title')).toHaveTextContent('Répartition');
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(useReportDataMock).toHaveBeenCalledWith({
      source: 'orders',
      filters: baseFilters,
    });
    expect(skeletonPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'h-full w-full' }),
    );
  });

  it('affiche le graphique donut avec les bonnes props métier en cas de succès', () => {
    render(<DonutChartBlock widget={baseWidget} filters={baseFilters} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();

    expect(piePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: REPORT_SUCCESS.data.rows,
        dataKey: 'count',
        nameKey: 'name',
        innerRadius: '50%',
        outerRadius: '80%',
        paddingAngle: 2,
      }),
    );

    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAttribute('data-fill', 'hsl(var(--primary))');
    expect(cells[1]).toHaveAttribute('data-fill', 'hsl(var(--accent))');
    expect(cells[2]).toHaveAttribute('data-fill', 'hsl(197 64% 60%)');

    expect(cellPropsSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        fill: 'hsl(var(--primary))',
      }),
    );
    expect(cellPropsSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fill: 'hsl(var(--accent))',
      }),
    );
    expect(cellPropsSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        fill: 'hsl(197 64% 60%)',
      }),
    );

    expect(tooltipPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contentStyle: {
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 6,
        },
      }),
    );

    expect(legendPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        wrapperStyle: { fontSize: 11 },
      }),
    );

    expect(responsiveContainerPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        width: '100%',
        height: '100%',
      }),
    );
  });

  it('utilise les valeurs par défaut dimension=name et measure=count quand elles sont absentes', () => {
    const widgetWithoutMappings = {
      title: 'Répartition défaut',
      source: 'orders',
    };

    render(<DonutChartBlock widget={widgetWithoutMappings} filters={baseFilters} />);

    expect(piePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataKey: 'count',
        nameKey: 'name',
      }),
    );

    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(3);
  });

  it('affiche un état erreur avec le message dans title quand la récupération échoue', () => {
    useReportDataMock.mockReturnValue(REPORT_ERROR);

    render(<DonutChartBlock widget={baseWidget} filters={baseFilters} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erreur de chargement');
    expect(alert).toHaveAttribute('title', 'Erreur inconnue');
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('affiche NoDataState quand aucune ligne n’est disponible', () => {
    useReportDataMock.mockReturnValue(REPORT_EMPTY);

    render(<DonutChartBlock widget={baseWidget} filters={baseFilters} />);

    expect(screen.getByTestId('no-data')).toBeInTheDocument();
    expect(noDataSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('affiche NoSourceState quand widget.source est absent sans dépendre des données', () => {
    render(
      <DonutChartBlock
        widget={{ title: 'Sans source' }}
        filters={baseFilters}
      />,
    );

    expect(screen.getByTestId('no-source')).toBeInTheDocument();
    expect(noSourceSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('applique les classes structurelles principales sur les composants de carte', () => {
    render(<DonutChartBlock widget={baseWidget} filters={baseFilters} />);

    expect(cardPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'h-full flex flex-col' }),
    );
    expect(cardHeaderPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'pb-2' }),
    );
    expect(cardContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'flex-1 min-h-0 pb-4' }),
    );
    expect(cardTitlePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'text-sm font-medium truncate' }),
    );

    const header = screen.getByTestId('card-header');
    expect(within(header).getByText('Répartition')).toBeInTheDocument();
  });
});