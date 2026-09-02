// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BarChartBlock } from './BarChartBlock';

const {
  AUTH_STATE,
  REPORT_LOADING,
  REPORT_SUCCESS,
  REPORT_ERROR,
  REPORT_EMPTY,
  mockUseReportData,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  REPORT_LOADING: {
    data: undefined,
    isLoading: true,
    error: null,
  },
  REPORT_SUCCESS: {
    data: {
      rows: [
        { name: 'Alpha', count: 12 },
        { name: 'Beta', count: 7 },
      ],
    },
    isLoading: false,
    error: null,
  },
  REPORT_ERROR: {
    data: null,
    isLoading: false,
    error: { message: 'x' },
  },
  REPORT_EMPTY: {
    data: { rows: [] },
    isLoading: false,
    error: null,
  },
  mockUseReportData: vi.fn(),
}));

vi.mock('@/hooks/analytics/useReportData', () => ({
  useReportData: mockUseReportData,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('./WidgetEmptyState', () => ({
  NoSourceState: () => <div data-testid="no-source">No source</div>,
  NoDataState: () => <div data-testid="no-data">No data</div>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({
    children,
    data,
    margin,
  }: {
    children: React.ReactNode;
    data: Array<Record<string, unknown>>;
    margin: Record<string, number>;
  }) => (
    <div
      data-testid="bar-chart"
      data-chart={JSON.stringify({ data, margin })}
    >
      {children}
    </div>
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="x-axis">{dataKey}</div>,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid="bar">{dataKey}</div>,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
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

describe('BarChartBlock', () => {
  const widgetBase = {
    id: 'w1',
    title: 'Ventes par produit',
    type: 'bar',
    source: 'orders',
    dimension: 'name',
    measure: 'count',
  };

  const filters = {
    dateRange: { from: '2024-01-01', to: '2024-01-31' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche l’état sans source si widget.source est absent', () => {
    mockUseReportData.mockReturnValue(REPORT_SUCCESS);

    render(
      <BarChartBlock
        widget={{ ...widgetBase, source: '' }}
        filters={filters}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('no-source')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('affiche le skeleton pendant le chargement', () => {
    mockUseReportData.mockReturnValue(REPORT_LOADING);

    render(<BarChartBlock widget={widgetBase} filters={filters} />, {
      wrapper: createWrapper(),
    });

    expect(mockUseReportData).toHaveBeenCalledWith({
      source: 'orders',
      filters,
    });
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('affiche le graphique avec les bonnes valeurs métier en succès', () => {
    mockUseReportData.mockReturnValue(REPORT_SUCCESS);

    render(<BarChartBlock widget={widgetBase} filters={filters} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('card-title')).toHaveTextContent('Ventes par produit');
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toHaveTextContent('name');
    expect(screen.getByTestId('bar')).toHaveTextContent('count');

    const chart = screen.getByTestId('bar-chart');
    const parsed = JSON.parse(chart.getAttribute('data-chart') ?? '{}') as {
      data: Array<{ name: string; count: number }>;
      margin: { top: number; right: number; left: number; bottom: number };
    };

    expect(parsed.data).toEqual([
      { name: 'Alpha', count: 12 },
      { name: 'Beta', count: 7 },
    ]);
    expect(parsed.margin).toEqual({ top: 5, right: 10, left: 0, bottom: 5 });
    expect(screen.queryByTestId('no-data')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('utilise les valeurs par défaut pour dimension et mesure si absentes', () => {
    mockUseReportData.mockReturnValue(REPORT_SUCCESS);

    render(
      <BarChartBlock
        widget={{ ...widgetBase, dimension: undefined, measure: undefined }}
        filters={filters}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('x-axis')).toHaveTextContent('name');
    expect(screen.getByTestId('bar')).toHaveTextContent('count');
  });

  it('affiche l’état vide quand aucune ligne n’est disponible', () => {
    mockUseReportData.mockReturnValue(REPORT_EMPTY);

    render(<BarChartBlock widget={widgetBase} filters={filters} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('no-data')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('affiche une erreur de chargement avec le message dans le title', () => {
    mockUseReportData.mockReturnValue(REPORT_ERROR);

    render(<BarChartBlock widget={widgetBase} filters={filters} />, {
      wrapper: createWrapper(),
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erreur de chargement');
    expect(alert).toHaveAttribute('title', 'Erreur inconnue');
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('affiche le message d’erreur réel quand error est une instance de Error', () => {
    mockUseReportData.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('rapport indisponible'),
    });

    render(<BarChartBlock widget={widgetBase} filters={filters} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('alert')).toHaveAttribute('title', 'rapport indisponible');
  });
});