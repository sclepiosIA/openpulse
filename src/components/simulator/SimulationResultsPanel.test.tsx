import React from 'react';
import { render, screen } from '@testing-library/react';
import { SimulationResultsPanel } from './SimulationResultsPanel';

const { mockFormatEuro, mockFormatNumber, mockCn, sampleResults } = vi.hoisted(() => {
  return {
    mockFormatEuro: vi.fn((value: number) => `€${value}`),
    mockFormatNumber: vi.fn((value: number) => `${value}`),
    mockCn: vi.fn((...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' ')
    ),
    sampleResults: {
      uhcdBaseline: 100,
      uhcdTarget: 150,
      uhcdDiff: 50,
      totalGainBaseline: 2000,
      totalGainTarget: 3000,
      totalGainDiff: 1000,
      gainParDossier: 20,
      leviers: [
        {
          levier: 'Levier A',
          volumeBaseline: 10,
          gainBaseline: 100,
          volumeTarget: 15,
          gainTarget: 200,
          gainDiff: 100,
        },
        {
          levier: 'Levier B',
          volumeBaseline: 20,
          gainBaseline: 200,
          volumeTarget: 25,
          gainTarget: 250,
          gainDiff: 50,
        },
      ],
    },
  };
});

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  );
  const CardContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  );
  const CardHeader = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  );
  const CardTitle = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-title" {...props}>
      {children}
    </div>
  );
  return { Card, CardContent, CardHeader, CardTitle };
});

vi.mock('@/components/ui/table', () => {
  const Table = ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <table data-testid="table" {...props}>
      {children}
    </table>
  );
  const TableBody = ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody data-testid="table-body" {...props}>
      {children}
    </tbody>
  );
  const TableCell = ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td data-testid="table-cell" {...props}>
      {children}
    </td>
  );
  const TableHead = ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th data-testid="table-head" {...props}>
      {children}
    </th>
  );
  const TableHeader = ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead data-testid="table-header" {...props}>
      {children}
    </thead>
  );
  const TableRow = ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr data-testid="table-row" {...props}>
      {children}
    </tr>
  );
  return { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
});

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  );
  return { Badge };
});

vi.mock('@/lib/simulator-config', () => ({
  formatEuro: (value: number) => mockFormatEuro(value),
  formatNumber: (value: number) => mockFormatNumber(value),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => mockCn(...classes),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    TrendingUp: Icon,
    ArrowUp: Icon,
    Calculator: Icon,
    Target: Icon,
    Zap: Icon,
    PiggyBank: Icon,
    ChevronUp: Icon,
  };
});

describe('SimulationResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders main KPIs with formatted values and percentage badge when gainPercentage > 0', () => {
    render(<SimulationResultsPanel results={sampleResults} />);

    expect(mockFormatNumber).toHaveBeenCalledWith(sampleResults.uhcdBaseline);
    expect(mockFormatNumber).toHaveBeenCalledWith(sampleResults.uhcdTarget);
    expect(mockFormatNumber).toHaveBeenCalledWith(sampleResults.uhcdDiff);

    expect(mockFormatEuro).toHaveBeenCalledWith(sampleResults.totalGainDiff);

    const gainTotalTexts = screen.getAllByText('Gain Total Estimé');
    expect(gainTotalTexts.length).toBeGreaterThan(0);

    const percentBadges = screen.getAllByTestId('badge').filter(badge =>
      badge.textContent && badge.textContent.includes('%')
    );
    expect(percentBadges.length).toBeGreaterThan(0);
  });

  it('does not render percentage badge when totalGainBaseline is 0', () => {
    const zeroBaselineResults = {
      ...sampleResults,
      totalGainBaseline: 0,
      totalGainDiff: 0,
    };

    render(<SimulationResultsPanel results={zeroBaselineResults} />);

    const badges = screen.getAllByTestId('badge');
    const percentBadges = badges.filter(badge =>
      badge.textContent && badge.textContent.includes('%')
    );
    expect(percentBadges.length).toBe(0);
  });

  it('renders table rows for each levier and total row with correct formatted totals', () => {
    render(<SimulationResultsPanel results={sampleResults} />);

    const rows = screen.getAllByTestId('table-row');
    expect(rows.length).toBe(sampleResults.leviers.length + 2);

    expect(mockFormatEuro).toHaveBeenCalledWith(sampleResults.totalGainBaseline);
    expect(mockFormatEuro).toHaveBeenCalledWith(sampleResults.totalGainTarget);
    expect(mockFormatEuro).toHaveBeenCalledWith(sampleResults.totalGainDiff);

    expect(screen.getByText('TOTAL')).toBeInTheDocument();
  });

  it('applies positive diff styling and icon when gainDiff > 0', () => {
    render(<SimulationResultsPanel results={sampleResults} />);

    const diffBadges = screen.getAllByTestId('badge').filter(badge =>
      badge.textContent && badge.textContent.includes(`€${sampleResults.leviers[0].gainDiff}`)
    );
    expect(diffBadges.length).toBeGreaterThan(0);

    const icons = screen.getAllByTestId('icon');
    expect(icons.length).toBeGreaterThan(0);
  });
});