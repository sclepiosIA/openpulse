import { render, screen } from '@testing-library/react';
import React from 'react';

const { mockFormatEuro, mockFormatNumber, mockFormatPercent, mockCn, mockQuoteExportButtons, baseResults, baseParams, resellerResults, secondLevelResults } =
  vi.hoisted(() => {
    const mockFormatEuroFn = vi.fn((value: number) => `${value}€`);
    const mockFormatNumberFn = vi.fn((value: number) => value.toString());
    const mockFormatPercentFn = vi.fn((value: number, digits?: number) => {
      const factor = typeof digits === 'number' ? Math.pow(10, digits) : 100;
      const rounded = Math.round(value * factor) / factor;
      return `${rounded}%`;
    });
    const mockCnFn = vi.fn((...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' ')
    );
    const mockQuoteExportButtonsComponent = vi.fn(
      ({ results, params, etablissementNom }: { results: unknown; params: unknown; etablissementNom?: string }) => (
        <button
          type="button"
          data-testid="quote-export-buttons"
          data-etablissement={etablissementNom ?? ''}
        >
          Exporter
        </button>
      )
    );

    const baseResultsData = {
      configuration: {
        resellerType: null,
        valorisationLevel: 'premier',
      },
      passagesAnnuels: 12000,
      uhcdActuels: 3000,
      uhcdMonoRum: 1500,
      tauxUhcdMonoRumSurTotal: 0.25,
      paliers: [
        {
          palier: 1,
          tauxObjectif: 0.3,
          uhcdObjectif: 1600,
          uhcdSupplementaires: 100,
          fraisAcces: 10000,
          fraisAccesRevendeur: 8000,
          prixSolution: 20000,
          prixSolutionRevendeur: 18000,
          multiplicateur: 1,
          coutTotal: 30000,
          coutTotalRevendeur: 26000,
          roiTotal: 40000,
          roiNet: 10000,
          roiPourcentage: 120,
          roiUhcd: 5000,
          roiAvisSpec: 3000,
          roiCcmu2: 1000,
          roiCcmu3: 500,
          roiMonoUhcdBonus: 500,
        },
        {
          palier: 2,
          tauxObjectif: 0.35,
          uhcdObjectif: 1700,
          uhcdSupplementaires: 200,
          fraisAcces: 11000,
          fraisAccesRevendeur: 9000,
          prixSolution: 22000,
          prixSolutionRevendeur: 19000,
          multiplicateur: 1.2,
          coutTotal: 33000,
          coutTotalRevendeur: 28000,
          roiTotal: 45000,
          roiNet: 12000,
          roiPourcentage: 150,
          roiUhcd: 6000,
          roiAvisSpec: 3500,
          roiCcmu2: 1500,
          roiCcmu3: 700,
          roiMonoUhcdBonus: 700,
        },
        {
          palier: 3,
          tauxObjectif: 0.4,
          uhcdObjectif: 1800,
          uhcdSupplementaires: 300,
          fraisAcces: 12000,
          fraisAccesRevendeur: 10000,
          prixSolution: 24000,
          prixSolutionRevendeur: 20000,
          multiplicateur: 1.5,
          coutTotal: 36000,
          coutTotalRevendeur: 30000,
          roiTotal: 50000,
          roiNet: -5000,
          roiPourcentage: 90,
          roiUhcd: 7000,
          roiAvisSpec: 4000,
          roiCcmu2: 2000,
          roiCcmu3: 800,
          roiMonoUhcdBonus: 800,
        },
        {
          palier: 4,
          tauxObjectif: 0.45,
          uhcdObjectif: 1900,
          uhcdSupplementaires: 400,
          fraisAcces: 13000,
          fraisAccesRevendeur: 11000,
          prixSolution: 26000,
          prixSolutionRevendeur: 22000,
          multiplicateur: 1.8,
          coutTotal: 39000,
          coutTotalRevendeur: 32000,
          roiTotal: 55000,
          roiNet: 16000,
          roiPourcentage: 220,
          roiUhcd: 8000,
          roiAvisSpec: 4500,
          roiCcmu2: 2500,
          roiCcmu3: 900,
          roiMonoUhcdBonus: 1000,
        },
      ],
    };

    const baseParamsData = {
      someParam: 'value',
    } as unknown as import('@/types/simulator').SimulationParams;

    const resellerResultsData = {
      ...baseResultsData,
      configuration: {
        resellerType: { name: 'Partenaire X' },
        valorisationLevel: 'premier',
      },
    };

    const secondLevelResultsData = {
      ...baseResultsData,
      configuration: {
        resellerType: null,
        valorisationLevel: 'second',
      },
    };

    return {
      mockFormatEuro: mockFormatEuroFn,
      mockFormatNumber: mockFormatNumberFn,
      mockFormatPercent: mockFormatPercentFn,
      mockCn: mockCnFn,
      mockQuoteExportButtons: mockQuoteExportButtonsComponent,
      baseResults: baseResultsData as import('@/types/simulator').QuoteResults,
      baseParams: baseParamsData,
      resellerResults: resellerResultsData as import('@/types/simulator').QuoteResults,
      secondLevelResults: secondLevelResultsData as import('@/types/simulator').QuoteResults,
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
    <h2 data-testid="card-title" {...props}>
      {children}
    </h2>
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
  const Badge = ({
    children,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
    <span data-testid={`badge${variant ? `-${variant}` : ''}`} {...props}>
      {children}
    </span>
  );
  return { Badge };
});

vi.mock('@/components/ui/tooltip', () => {
  const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  );
  const Tooltip = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  );
  const TooltipTrigger = ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" data-testid="tooltip-trigger" {...props}>
      {children}
    </button>
  );
  const TooltipContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  );
  return { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
});

vi.mock('@/lib/simulator-config', () => ({
  formatEuro: mockFormatEuro,
  formatNumber: mockFormatNumber,
  formatPercent: mockFormatPercent,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    TrendingUp: Icon,
    Info: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Sparkles: Icon,
    Target: Icon,
    Users: Icon,
    PieChart: Icon,
  };
});

vi.mock('./QuoteExportButtons', () => ({
  QuoteExportButtons: mockQuoteExportButtons,
}));

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

import { QuoteProjectionsTable } from './QuoteProjectionsTable';

describe('QuoteProjectionsTable', () => {
  it('affiche les données de base formatées et les paliers pour une configuration sans revendeur (premier niveau)', () => {
    render(<QuoteProjectionsTable results={baseResults} params={baseParams} etablissementNom="CH Test" />);

    expect(screen.getByTestId('quote-export-buttons')).toBeInTheDocument();
    expect(screen.getByTestId('quote-export-buttons')).toHaveAttribute('data-etablissement', 'CH Test');

    expect(mockFormatNumber).toHaveBeenCalledWith(baseResults.passagesAnnuels);
    expect(mockFormatNumber).toHaveBeenCalledWith(baseResults.uhcdActuels);
    expect(mockFormatNumber).toHaveBeenCalledWith(baseResults.uhcdMonoRum);
    expect(mockFormatPercent).toHaveBeenCalledWith(baseResults.tauxUhcdMonoRumSurTotal);

    expect(screen.getAllByTestId('card').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTestId('table').length).toBe(1);

    baseResults.paliers.forEach((p) => {
      expect(mockFormatPercent).toHaveBeenCalledWith(p.tauxObjectif);
      expect(mockFormatNumber).toHaveBeenCalledWith(p.uhcdObjectif);
      expect(mockFormatNumber).toHaveBeenCalledWith(p.uhcdSupplementaires);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.fraisAcces);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.prixSolution);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.coutTotal);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.roiTotal);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.roiNet);
      expect(mockFormatPercent).toHaveBeenCalledWith(p.roiPourcentage, 0);
    });

    const positiveRoiPalier = baseResults.paliers[0];
    expect(mockFormatEuro).toHaveBeenCalledWith(positiveRoiPalier.roiNet);

    const negativeRoiPalier = baseResults.paliers[2];
    expect(mockFormatEuro).toHaveBeenCalledWith(negativeRoiPalier.roiNet);

    expect(mockCn).toHaveBeenCalled();
    expect(screen.queryByText(/Détail ROI par levier/)).not.toBeInTheDocument();
  });

  it('affiche les coûts avec revendeur lorsque resellerType est défini', () => {
    render(<QuoteProjectionsTable results={resellerResults} params={baseParams} etablissementNom="CH Revendeur" />);

    const labelCosts = screen.getByText(/Coûts \(avec Partenaire X\)/);
    expect(labelCosts).toBeInTheDocument();

    resellerResults.paliers.forEach((p) => {
      expect(mockFormatEuro).toHaveBeenCalledWith(p.fraisAccesRevendeur);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.prixSolutionRevendeur);
      expect(mockFormatEuro).toHaveBeenCalledWith(p.coutTotalRevendeur);
    });
  });

  it('affiche le détail ROI par levier pour un niveau de valorisation second', () => {
    render(<QuoteProjectionsTable results={secondLevelResults} params={baseParams} />);

    expect(screen.getByText(/Détail ROI par levier \(Palier 4 - Performance maximale\)/)).toBeInTheDocument();

    const p4 = secondLevelResults.paliers[3];
    expect(mockFormatEuro).toHaveBeenCalledWith(p4.roiUhcd);
    expect(mockFormatEuro).toHaveBeenCalledWith(p4.roiAvisSpec);
    expect(mockFormatEuro).toHaveBeenCalledWith(p4.roiCcmu2);
    expect(mockFormatEuro).toHaveBeenCalledWith(p4.roiCcmu3);
    expect(mockFormatEuro).toHaveBeenCalledWith(p4.roiMonoUhcdBonus);

    expect(screen.getAllByTestId('card-content').length).toBeGreaterThanOrEqual(3);
  });
});