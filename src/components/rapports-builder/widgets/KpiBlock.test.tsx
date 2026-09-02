// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KpiBlock } from './KpiBlock';

const {
  REPORT_SUCCESS,
  REPORT_EMPTY,
  REPORT_ERROR,
  stableUseReportData,
  cardPropsSpy,
  cardHeaderPropsSpy,
  cardTitlePropsSpy,
  cardContentPropsSpy,
  skeletonPropsSpy,
  noSourceSpy,
  cnSpy,
} = vi.hoisted(() => ({
  REPORT_SUCCESS: {
    rows: [
      { revenue: 1200, count: 2, rate: 12.5 },
      { revenue: 800, count: 3, rate: 7.5 },
    ],
  },
  REPORT_EMPTY: {
    rows: [],
  },
  REPORT_ERROR: new Error('x'),
  stableUseReportData: vi.fn(),
  cardPropsSpy: vi.fn(),
  cardHeaderPropsSpy: vi.fn(),
  cardTitlePropsSpy: vi.fn(),
  cardContentPropsSpy: vi.fn(),
  skeletonPropsSpy: vi.fn(),
  noSourceSpy: vi.fn(),
  cnSpy: vi.fn(),
}));

vi.mock('@/hooks/analytics/useReportData', () => ({
  useReportData: stableUseReportData,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardPropsSpy(props);
    return (
      <div data-testid="card" {...props}>
        {children}
      </div>
    );
  },
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardHeaderPropsSpy(props);
    return (
      <div data-testid="card-header" {...props}>
        {children}
      </div>
    );
  },
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    cardTitlePropsSpy(props);
    return (
      <h3 data-testid="card-title" {...props}>
        {children}
      </h3>
    );
  },
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardContentPropsSpy(props);
    return (
      <div data-testid="card-content" {...props}>
        {children}
      </div>
    );
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => {
    skeletonPropsSpy(props);
    return <div data-testid="skeleton" {...props} />;
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | false | null>) => {
    cnSpy(...args);
    return args.filter(Boolean).join(' ');
  },
}));

vi.mock('./WidgetEmptyState', () => ({
  NoSourceState: () => {
    noSourceSpy();
    return <div data-testid="no-source">Aucune source</div>;
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

describe('KpiBlock', () => {
  const baseFilters = {
    dateRange: { from: '2024-01-01', to: '2024-01-31' },
  } as unknown as import('@/types/report').DashboardFilters;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le skeleton pendant le chargement', () => {
    stableUseReportData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(
      <KpiBlock
        widget={
          {
            title: 'Chiffre d’affaires',
            source: 'sales',
            measure: 'revenue',
            format: 'currency',
            color: 'text-emerald-500',
          } as unknown as import('@/types/report').WidgetConfig
        }
        filters={baseFilters}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Chiffre d’affaires');
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(skeletonPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'h-10 w-24' })
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-source')).not.toBeInTheDocument();
  });

  it('affiche la valeur métier agrégée formatée en devise', () => {
    stableUseReportData.mockReturnValue({
      data: REPORT_SUCCESS,
      isLoading: false,
      error: null,
    });

    render(
      <KpiBlock
        widget={
          {
            title: 'Revenus',
            source: 'sales',
            measure: 'revenue',
            format: 'currency',
            color: 'text-emerald-500',
          } as unknown as import('@/types/report').WidgetConfig
        }
        filters={baseFilters}
      />,
      { wrapper: createWrapper() }
    );

    expect(stableUseReportData).toHaveBeenCalledWith({
      source: 'sales',
      filters: baseFilters,
    });

    expect(
      screen.getByText((content) => content.replace(/\s/g, '') === '2000€')
    ).toBeInTheDocument();
    expect(cnSpy).toHaveBeenCalledWith('text-3xl font-bold', 'text-emerald-500');
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('affiche 0 quand les rows sont vides', () => {
    stableUseReportData.mockReturnValue({
      data: REPORT_EMPTY,
      isLoading: false,
      error: null,
    });

    render(
      <KpiBlock
        widget={
          {
            title: 'Commandes',
            source: 'orders',
            measure: 'count',
          } as unknown as import('@/types/report').WidgetConfig
        }
        filters={baseFilters}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('affiche une erreur avec le message en title quand le hook échoue', () => {
    stableUseReportData.mockReturnValue({
      data: null,
      isLoading: false,
      error: REPORT_ERROR,
    });

    render(
      <KpiBlock
        widget={
          {
            title: 'Taux',
            source: 'conversion',
            measure: 'rate',
            format: 'percent',
          } as unknown as import('@/types/report').WidgetConfig
        }
        filters={baseFilters}
      />,
      { wrapper: createWrapper() }
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erreur de chargement');
    expect(alert).toHaveAttribute('title', 'x');
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('affiche NoSourceState si aucune source n’est configurée', () => {
    stableUseReportData.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(
      <KpiBlock
        widget={
          {
            title: 'Bloc incomplet',
            source: '',
            measure: 'count',
          } as unknown as import('@/types/report').WidgetConfig
        }
        filters={baseFilters}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('no-source')).toBeInTheDocument();
    expect(noSourceSpy).toHaveBeenCalledTimes(1);
  });

  it('formate les pourcentages à partir de la somme de la mesure', () => {
    stableUseReportData.mockReturnValue({
      data: REPORT_SUCCESS,
      isLoading: false,
      error: null,
    });

    render(
      <KpiBlock
        widget={
          {
            title: 'Taux cumulé',
            source: 'conversion',
            measure: 'rate',
            format: 'percent',
          } as unknown as import('@/types/report').WidgetConfig
        }
        filters={baseFilters}
      />,
      { wrapper: createWrapper() }
    );

    expect(
      screen.getByText((content) => content.replace(/\s/g, '') === '20%')
    ).toBeInTheDocument();
  });
});