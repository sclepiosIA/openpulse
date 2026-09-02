/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TableBlock } from './TableBlock';

const {
  REPORT_ROWS,
  EMPTY_ROWS,
  AUTH_STATE,
  mockUseReportData,
} = vi.hoisted(() => ({
  REPORT_ROWS: [
    { id: 'r1', name: 'Alice', amount: 1234, city: 'Paris', nullable: null },
    { id: 'r2', name: 'Bob', amount: 56789, city: 'Lyon', nullable: undefined },
  ],
  EMPTY_ROWS: [],
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockUseReportData: vi.fn(),
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

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
}));

vi.mock('./WidgetEmptyState', () => ({
  NoSourceState: () => <div data-testid="no-source-state">Aucune source</div>,
  NoDataState: () => <div data-testid="no-data-state">Aucune donnée</div>,
}));

vi.mock('@/hooks/analytics/useReportData', () => ({
  useReportData: mockUseReportData,
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('TableBlock', () => {
  const baseWidget = {
    id: 'w1',
    title: 'Top clients',
    source: 'orders',
  };

  const baseFilters = {
    dateRange: '30d',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre et l’état sans source quand widget.source est absent', () => {
    mockUseReportData.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<TableBlock widget={{ ...baseWidget, source: '' }} filters={baseFilters} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('card-title')).toHaveTextContent('Top clients');
    expect(screen.getByTestId('no-source-state')).toBeInTheDocument();
    expect(mockUseReportData).toHaveBeenCalledWith({
      source: '',
      filters: baseFilters,
    });
  });

  it('affiche le skeleton pendant le chargement', () => {
    mockUseReportData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<TableBlock widget={baseWidget} filters={baseFilters} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('affiche un tableau avec les colonnes réelles, exclut id et formate les nombres', () => {
    mockUseReportData.mockReturnValue({
      data: { rows: REPORT_ROWS },
      isLoading: false,
      error: null,
    });

    render(<TableBlock widget={baseWidget} filters={baseFilters} />, {
      wrapper: createWrapper(),
    });

    const table = screen.getByTestId('table');
    expect(table).toBeInTheDocument();

    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['name', 'amount', 'city', 'nullable']);
    expect(headers).not.toContain('id');

    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(2);

    const firstRowCells = within(bodyRows[0]).getAllByRole('cell').map((cell) => cell.textContent);
    const secondRowCells = within(bodyRows[1]).getAllByRole('cell').map((cell) => cell.textContent);

    expect(firstRowCells).toEqual(['Alice', '1 234', 'Paris', '—']);
    expect(secondRowCells).toEqual(['Bob', '56 789', 'Lyon', '—']);

    const dashCells = within(table).getAllByText('—');
    expect(dashCells).toHaveLength(2);
  });

  it('affiche l’état no data quand rows est vide', () => {
    mockUseReportData.mockReturnValue({
      data: { rows: EMPTY_ROWS },
      isLoading: false,
      error: null,
    });

    render(<TableBlock widget={baseWidget} filters={baseFilters} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('no-data-state')).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('affiche une erreur avec le message générique dans le title si error nest pas une Error', () => {
    mockUseReportData.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'x' },
    });

    render(<TableBlock widget={baseWidget} filters={baseFilters} />, {
      wrapper: createWrapper(),
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erreur de chargement');
    expect(alert).toHaveAttribute('title', 'Erreur inconnue');
  });

  it('utilise le message de Error pour le title quand error est une instance de Error', () => {
    mockUseReportData.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('rapport indisponible'),
    });

    render(<TableBlock widget={baseWidget} filters={baseFilters} />, {
      wrapper: createWrapper(),
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('title', 'rapport indisponible');
    expect(alert).toHaveTextContent('Erreur de chargement');
  });
});