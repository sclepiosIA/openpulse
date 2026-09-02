import { render, screen } from '@testing-library/react';
import { ForecastByQuarter } from './ForecastByQuarter';

vi.mock('@/components/ui/card', () => {
  const { ReactNode } = require('react');
  const Card = ({ children }: { children: ReactNode }) => <div data-testid="card">{children}</div>;
  const CardHeader = ({ children }: { children: ReactNode }) => <div data-testid="card-header">{children}</div>;
  const CardTitle = ({ children }: { children: ReactNode }) => <div data-testid="card-title">{children}</div>;
  const CardContent = ({ children }: { children: ReactNode }) => <div data-testid="card-content">{children}</div>;
  return { Card, CardHeader, CardTitle, CardContent };
});

const { mockResponsiveContainer, mockComposedChart, mockBar, mockLine, mockXAxis, mockYAxis, mockTooltip, mockLegend, mockCartesianGrid, EMPTY_DATA, SINGLE_QUARTER_DATA, MULTI_QUARTER_WITH_TARGETS } =
  vi.hoisted(() => {
    const React = require('react');
    const mockResponsiveContainer = ({ children, width, height }: { children: React.ReactNode; width: string | number; height: number }) => (
      <div data-testid="responsive-container" data-width={width} data-height={height}>
        {children}
      </div>
    );

    const mockComposedChart = ({ children, data }: { children: React.ReactNode; data: unknown }) => (
      <div data-testid="composed-chart" data-has-data={Array.isArray(data) && data.length > 0}>
        {children}
      </div>
    );

    const mockBar = ({ dataKey, name }: { dataKey: string; name: string }) => (
      <div data-testid={`bar-${dataKey}`} data-name={name} />
    );

    const mockLine = ({ dataKey, name }: { dataKey: string; name: string }) => (
      <div data-testid={`line-${dataKey}`} data-name={name} />
    );

    const mockXAxis = ({ dataKey }: { dataKey: string }) => (
      <div data-testid="x-axis" data-key={dataKey} />
    );

    const mockYAxis = ({ tickFormatter }: { tickFormatter?: (v: number) => string }) => (
      <div data-testid="y-axis" data-sample={tickFormatter ? tickFormatter(1000) : ''} />
    );

    const mockTooltip = ({ formatter }: { formatter?: (v: number) => string }) => (
      <div data-testid="tooltip" data-sample={formatter ? formatter(1234) : ''} />
    );

    const mockLegend = () => <div data-testid="legend" />;

    const mockCartesianGrid = ({ strokeDasharray }: { strokeDasharray?: string }) => (
      <div data-testid="cartesian-grid" data-dash={strokeDasharray} />
    );

    const EMPTY_DATA: { quarter: string; raw: number; weighted: number; won: number; target: number }[] = [];

    const SINGLE_QUARTER_DATA = [
      { quarter: 'T1 2025', raw: 10000, weighted: 6000, won: 3000, target: 0 },
    ];

    const MULTI_QUARTER_WITH_TARGETS = [
      { quarter: 'T1 2025', raw: 10000, weighted: 6000, won: 3000, target: 8000 },
      { quarter: 'T2 2025', raw: 14000, weighted: 9000, won: 4000, target: 9000 },
    ];

    return {
      mockResponsiveContainer,
      mockComposedChart,
      mockBar,
      mockLine,
      mockXAxis,
      mockYAxis,
      mockTooltip,
      mockLegend,
      mockCartesianGrid,
      EMPTY_DATA,
      SINGLE_QUARTER_DATA,
      MULTI_QUARTER_WITH_TARGETS,
    };
  });

vi.mock('recharts', () => ({
  ResponsiveContainer: mockResponsiveContainer,
  ComposedChart: mockComposedChart,
  Bar: mockBar,
  Line: mockLine,
  XAxis: mockXAxis,
  YAxis: mockYAxis,
  Tooltip: mockTooltip,
  Legend: mockLegend,
  CartesianGrid: mockCartesianGrid,
}));

describe('ForecastByQuarter', () => {
  it('affiche un message quand aucune donnée n’est fournie', () => {
    render(<ForecastByQuarter data={EMPTY_DATA} />);

    expect(screen.getByText('Aucune donnée sur la période.')).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('composed-chart')).not.toBeInTheDocument();
  });

  it("affiche le titre et les barres sans ligne d'objectif quand target=0", () => {
    render(<ForecastByQuarter data={SINGLE_QUARTER_DATA} />);

    expect(screen.getByText('Forecast par trimestre')).toBeInTheDocument();

    const container = screen.getByTestId('responsive-container');
    expect(container).toHaveAttribute('data-width', '100%');
    expect(container).toHaveAttribute('data-height', '320');

    const chart = screen.getByTestId('composed-chart');
    expect(chart).toHaveAttribute('data-has-data', 'true');

    expect(screen.getByTestId('bar-raw')).toHaveAttribute('data-name', 'Pipeline brut');
    expect(screen.getByTestId('bar-weighted')).toHaveAttribute('data-name', 'Pipeline pondéré');
    expect(screen.getByTestId('bar-won')).toHaveAttribute('data-name', 'Gagné');
    expect(screen.queryByTestId('line-target')).not.toBeInTheDocument();
  });

  it("affiche la ligne d'objectif quand au moins un target > 0", () => {
    render(<ForecastByQuarter data={MULTI_QUARTER_WITH_TARGETS} />);

    const lineTarget = screen.getByTestId('line-target');
    expect(lineTarget).toHaveAttribute('data-name', 'Objectif');
  });

  it('utilise un formatage lisible sur les axes et le tooltip', () => {
    render(<ForecastByQuarter data={SINGLE_QUARTER_DATA} />);

    const yAxis = screen.getByTestId('y-axis');
    expect(yAxis.getAttribute('data-sample')).toBe('1k');

    const tooltip = screen.getByTestId('tooltip');
    // 1234 formatté en EUR, fr-FR, sans décimale → "1 234 €" (avec espace insécable)
    expect(tooltip.getAttribute('data-sample')).toContain('€');
  });
});