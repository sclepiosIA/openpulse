import React from 'react';
import { render, screen, within } from '@testing-library/react';
import type { ForecastPhaseGroup } from '@/hooks/crm/useSalesForecast';

const {
  MockResponsiveContainer,
  MockPieChart,
  MockPie,
  MockCell,
  MockTooltip,
  MockLegend,
  MockCard,
  MockCardHeader,
  MockCardTitle,
  MockCardContent,
  normalizeText,
} = vi.hoisted(() => {
  type GenericProps = React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode } & Record<string, unknown>;
  const MockResponsiveContainer = ({ children, ...props }: GenericProps) => (
    <div data-testid="responsive" {...props}>
      {children}
    </div>
  );
  const MockPieChart = ({ children, ...props }: GenericProps) => (
    <div data-testid="piechart" {...props}>
      {children}
    </div>
  );
  const MockPie = ({ children, ...props }: GenericProps) => (
    <div data-testid="pie" {...props}>
      {children}
    </div>
  );
  const MockCell = (props: Record<string, unknown>) => <div data-testid="cell" {...props} />;
  const MockTooltip = (_props: Record<string, unknown>) => null;
  const MockLegend = (_props: Record<string, unknown>) => null;
  const MockCard = ({ children, ...props }: GenericProps) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  );
  const MockCardHeader = ({ children, ...props }: GenericProps) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  );
  const MockCardTitle = ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => <h2 {...props}>{children}</h2>;
  const MockCardContent = ({ children, ...props }: GenericProps) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  );
  const normalizeText = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    MockResponsiveContainer,
    MockPieChart,
    MockPie,
    MockCell,
    MockTooltip,
    MockLegend,
    MockCard,
    MockCardHeader,
    MockCardTitle,
    MockCardContent,
    normalizeText,
  };
});

vi.mock('recharts', () => ({
  ResponsiveContainer: MockResponsiveContainer,
  PieChart: MockPieChart,
  Pie: MockPie,
  Cell: MockCell,
  Tooltip: MockTooltip,
  Legend: MockLegend,
}));

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
  CardHeader: MockCardHeader,
  CardTitle: MockCardTitle,
  CardContent: MockCardContent,
}));

import { ForecastPhaseDonut } from './ForecastPhaseDonut';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0);

describe('ForecastPhaseDonut', () => {
  it('affiche un message quand aucune donnée pondérée', () => {
    const data: ForecastPhaseGroup[] = [
      { phase_group: 'commercial', weighted: 0, count: 2 },
      { phase_group: 'deploiement', count: 1 },
    ];

    render(<ForecastPhaseDonut data={data} />);

    expect(screen.getByText('Répartition pondérée par phase métier')).toBeInTheDocument();
    expect(screen.getByText('Aucune donnée pondérée.')).toBeInTheDocument();
  });

  it('affiche correctement les montants, pourcentages et couleurs pour les phases connues', () => {
    const data: ForecastPhaseGroup[] = [
      { phase_group: 'commercial', weighted: 1000, count: 2 },
      { phase_group: 'deploiement', weighted: 0, count: 1 },
      { phase_group: 'production', weighted: 3000, count: 1 },
    ];

    render(<ForecastPhaseDonut data={data} />);

    expect(screen.getByText('Répartition pondérée par phase métier')).toBeInTheDocument();

    // Commercial
    const commercialLabel = screen.getByText('Commercial');
    const commercialLeft = commercialLabel.parentElement as HTMLElement;
    const commercialRow = commercialLeft.parentElement as HTMLElement;

    const commercialAmountEl = within(commercialRow).getByText((text, el) => {
      return el instanceof HTMLElement &&
        el.classList.contains('font-semibold') &&
        normalizeText(text) === normalizeText(fmt(1000));
    });
    expect(commercialAmountEl).toBeInTheDocument();

    const commercialPctEl = within(commercialRow).getByText((text, el) => {
      return el instanceof HTMLElement &&
        el.classList.contains('text-xs') &&
        normalizeText(text) === '25% · 2';
    });
    expect(commercialPctEl).toBeInTheDocument();

    const commercialDot = commercialLeft.querySelector('span[style]') as HTMLSpanElement | null;
    if (!commercialDot) throw new Error('Dot non trouvé pour Commercial');
    expect(commercialDot).toHaveStyle({ background: 'hsl(var(--chart-1))' });

    // Production
    const productionLabel = screen.getByText('Production');
    const productionLeft = productionLabel.parentElement as HTMLElement;
    const productionRow = productionLeft.parentElement as HTMLElement;

    const productionAmountEl = within(productionRow).getByText((text, el) => {
      return el instanceof HTMLElement &&
        el.classList.contains('font-semibold') &&
        normalizeText(text) === normalizeText(fmt(3000));
    });
    expect(productionAmountEl).toBeInTheDocument();

    const productionPctEl = within(productionRow).getByText((text, el) => {
      return el instanceof HTMLElement &&
        el.classList.contains('text-xs') &&
        normalizeText(text) === '75% · 1';
    });
    expect(productionPctEl).toBeInTheDocument();

    const productionDot = productionLeft.querySelector('span[style]') as HTMLSpanElement | null;
    if (!productionDot) throw new Error('Dot non trouvé pour Production');
    expect(productionDot).toHaveStyle({ background: 'hsl(var(--success))' });

    // Déploiement (pondéré à 0) ne doit pas apparaître dans la liste
    expect(screen.queryByText('Déploiement')).not.toBeInTheDocument();
  });

  it('utilise les valeurs par défaut pour une phase inconnue', () => {
    const data: ForecastPhaseGroup[] = [{ phase_group: 'autre', weighted: 500, count: 3 }];

    render(<ForecastPhaseDonut data={data} />);

    const unknownLabel = screen.getByText('autre');
    const left = unknownLabel.parentElement as HTMLElement;
    const row = left.parentElement as HTMLElement;

    const amountEl = within(row).getByText((text, el) => {
      return el instanceof HTMLElement &&
        el.classList.contains('font-semibold') &&
        normalizeText(text) === normalizeText(fmt(500));
    });
    expect(amountEl).toBeInTheDocument();

    const pctEl = within(row).getByText((text, el) => {
      return el instanceof HTMLElement &&
        el.classList.contains('text-xs') &&
        normalizeText(text) === '100% · 3';
    });
    expect(pctEl).toBeInTheDocument();

    const dot = left.querySelector('span[style]') as HTMLSpanElement | null;
    if (!dot) throw new Error('Dot non trouvé pour phase inconnue');
    expect(dot).toHaveStyle({ background: 'hsl(var(--muted))' });
  });
})