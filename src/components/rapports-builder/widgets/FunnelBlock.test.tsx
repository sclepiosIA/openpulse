// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { FunnelBlock } from './FunnelBlock';

const {
  REPORT_SUCCESS,
  REPORT_EMPTY,
  REPORT_ERROR,
  AUTH_STATE,
  useReportDataMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  REPORT_SUCCESS: {
    rows: [
      { etape: 'Visiteurs', count: 120 },
      { etape: 'Prospects', count: 60 },
      { etape: 'Clients', count: 15 },
    ],
  },
  REPORT_EMPTY: { rows: [] as Array<{ etape?: string; count?: number }> },
  REPORT_ERROR: new Error('x'),
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  useReportDataMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/analytics/useReportData', () => ({
  useReportData: useReportDataMock,
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
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
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
  NoSourceState: () => <div data-testid="no-source">Aucune source</div>,
  NoDataState: () => <div data-testid="no-data">Aucune donnée</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

describe('FunnelBlock', () => {
  const widgetBase = {
    id: 'w1',
    type: 'funnel',
    title: 'Tunnel de conversion',
    source: 'crm_leads',
    dimension: 'etape',
    measure: 'count',
  };

  const filtersBase = {
    period: '30d',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un état sans source quand widget.source est absent', () => {
    useReportDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(
      <FunnelBlock
        widget={{ ...widgetBase, source: '' }}
        filters={filtersBase}
      />
    );

    expect(screen.getByTestId('no-source')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-data')).not.toBeInTheDocument();
    expect(useReportDataMock).toHaveBeenCalledWith({
      source: '',
      filters: filtersBase,
    });
  });

  it('affiche le skeleton pendant le chargement', () => {
    useReportDataMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<FunnelBlock widget={widgetBase} filters={filtersBase} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.getByText('Tunnel de conversion')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-data')).not.toBeInTheDocument();
    expect(useReportDataMock).toHaveBeenCalledWith({
      source: 'crm_leads',
      filters: filtersBase,
    });
  });

  it('affiche les lignes du funnel avec les bonnes valeurs métier et largeurs relatives', () => {
    useReportDataMock.mockReturnValue({
      data: REPORT_SUCCESS,
      isLoading: false,
      error: null,
    });

    const { container } = render(<FunnelBlock widget={widgetBase} filters={filtersBase} />);

    expect(screen.getByText('Visiteurs')).toBeInTheDocument();
    expect(screen.getByText('Prospects')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    const bars = Array.from(
      container.querySelectorAll('.absolute.inset-y-0.left-0.bg-primary.rounded')
    ) as HTMLDivElement[];

    expect(bars).toHaveLength(3);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
    expect(bars[2].style.width).toBe('12.5%');
  });

  it('affiche NoDataState quand il n’y a aucune ligne', () => {
    useReportDataMock.mockReturnValue({
      data: REPORT_EMPTY,
      isLoading: false,
      error: null,
    });

    render(<FunnelBlock widget={widgetBase} filters={filtersBase} />);

    expect(screen.getByTestId('no-data')).toBeInTheDocument();
    expect(screen.queryByText('Visiteurs')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('affiche une erreur avec le message dans le title quand le hook échoue', () => {
    useReportDataMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: REPORT_ERROR,
    });

    render(<FunnelBlock widget={widgetBase} filters={filtersBase} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Erreur de chargement');
    expect(alert).toHaveAttribute('title', 'x');
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-data')).not.toBeInTheDocument();
  });

  it('utilise dimension et measure personnalisées', () => {
    useReportDataMock.mockReturnValue({
      data: {
        rows: [
          { stage_name: 'Étape A', total: 40 },
          { stage_name: 'Étape B', total: 10 },
        ],
      },
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <FunnelBlock
        widget={{
          ...widgetBase,
          dimension: 'stage_name',
          measure: 'total',
        }}
        filters={filtersBase}
      />
    );

    expect(screen.getByText('Étape A')).toBeInTheDocument();
    expect(screen.getByText('Étape B')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    const bars = Array.from(
      container.querySelectorAll('.absolute.inset-y-0.left-0.bg-primary.rounded')
    ) as HTMLDivElement[];

    expect(bars).toHaveLength(2);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('25%');
  });
});