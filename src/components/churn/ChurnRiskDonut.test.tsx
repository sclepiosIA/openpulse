// @vitest-environment jsdom

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ChurnRiskDonut } from './ChurnRiskDonut';

const { cardMocks, rechartsState, iconState } = vi.hoisted(() => {
  return {
    cardMocks: {
      Card: ({ children }: { children: React.ReactNode }) => <section data-testid="card">{children}</section>,
      CardHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="card-header">{children}</header>,
      CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <h2 data-testid="card-title" className={className}>
          {children}
        </h2>
      ),
      CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
      Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
    },
    rechartsState: {
      pieProps: [] as Array<Record<string, unknown>>,
      cellFills: [] as string[],
      responsiveProps: [] as Array<Record<string, unknown>>,
      tooltipProps: [] as Array<Record<string, unknown>>,
      legendProps: [] as Array<Record<string, unknown>>,
    },
    iconState: {
      rendered: 0,
    },
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: cardMocks.Card,
  CardHeader: cardMocks.CardHeader,
  CardTitle: cardMocks.CardTitle,
  CardContent: cardMocks.CardContent,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: cardMocks.Skeleton,
}));

vi.mock('lucide-react', () => ({
  PieChart: ({ className }: { className?: string }) => {
    iconState.rendered += 1;
    return <svg data-testid="pie-icon" className={className} />;
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({
    children,
    width,
    height,
  }: {
    children: React.ReactNode;
    width: string | number;
    height: string | number;
  }) => {
    rechartsState.responsiveProps.push({ width, height });
    return (
      <div data-testid="responsive-container" data-width={String(width)} data-height={String(height)}>
        {children}
      </div>
    );
  },
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: (props: {
    children?: React.ReactNode;
    data: Array<{ name: string; value: number; color: string }>;
    dataKey: string;
    nameKey: string;
    cx: string;
    cy: string;
    innerRadius: number;
    outerRadius: number;
    paddingAngle: number;
  }) => {
    rechartsState.pieProps.push({
      data: props.data,
      dataKey: props.dataKey,
      nameKey: props.nameKey,
      cx: props.cx,
      cy: props.cy,
      innerRadius: props.innerRadius,
      outerRadius: props.outerRadius,
      paddingAngle: props.paddingAngle,
    });
    return (
      <div data-testid="pie">
        <div data-testid="pie-slice-count">{String(props.data.length)}</div>
        {props.data.map((item) => (
          <div key={item.name} data-testid="pie-data-item">
            {item.name}:{item.value}
          </div>
        ))}
        {props.children}
      </div>
    );
  },
  Cell: ({ fill }: { fill: string }) => {
    rechartsState.cellFills.push(fill);
    return <div data-testid="cell" data-fill={fill} />;
  },
  Tooltip: (props: { contentStyle: Record<string, unknown> }) => {
    rechartsState.tooltipProps.push(props);
    return <div data-testid="tooltip" />;
  },
  Legend: (props: { wrapperStyle: Record<string, unknown> }) => {
    rechartsState.legendProps.push(props);
    return <div data-testid="legend" />;
  },
}));

describe('ChurnRiskDonut', () => {
  beforeEach(() => {
    rechartsState.pieProps.length = 0;
    rechartsState.cellFills.length = 0;
    rechartsState.responsiveProps.length = 0;
    rechartsState.tooltipProps.length = 0;
    rechartsState.legendProps.length = 0;
    iconState.rendered = 0;
  });

  it('affiche le titre et le skeleton pendant le chargement', () => {
    render(<ChurnRiskDonut loading />);

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-title')).toHaveTextContent('Répartition des risques');
    expect(screen.getByTestId('pie-icon')).toHaveClass('h-4', 'w-4', 'text-primary');
    expect(screen.getByTestId('skeleton')).toHaveClass('h-[260px]', 'w-full');

    expect(screen.queryByText('Aucune donnée.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(rechartsState.pieProps).toHaveLength(0);
    expect(iconState.rendered).toBe(1);
  });

  it('affiche un état vide quand aucune donnée exploitable n’est disponible', () => {
    render(<ChurnRiskDonut kpis={{ critical: 0, high: 0, medium: 0, low: 0 }} loading={false} />);

    expect(screen.getByText('Aucune donnée.')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie')).not.toBeInTheDocument();
    expect(rechartsState.cellFills).toEqual([]);
  });

  it('rend le donut avec uniquement les catégories de risque non nulles et leurs couleurs métier', () => {
    render(
      <ChurnRiskDonut
        loading={false}
        kpis={{
          critical: 3,
          high: 2,
          medium: 0,
          low: 5,
        }}
      />,
    );

    expect(screen.getByTestId('responsive-container')).toHaveAttribute('data-width', '100%');
    expect(screen.getByTestId('responsive-container')).toHaveAttribute('data-height', '260');
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();

    const pie = screen.getByTestId('pie');
    expect(within(pie).getByTestId('pie-slice-count')).toHaveTextContent('3');
    expect(within(pie).getByText('Critique:3')).toBeInTheDocument();
    expect(within(pie).getByText('Élevé:2')).toBeInTheDocument();
    expect(within(pie).getByText('Faible:5')).toBeInTheDocument();
    expect(within(pie).queryByText('Modéré:0')).not.toBeInTheDocument();

    expect(rechartsState.pieProps).toHaveLength(1);
    expect(rechartsState.pieProps[0]).toMatchObject({
      dataKey: 'value',
      nameKey: 'name',
      cx: '50%',
      cy: '50%',
      innerRadius: 50,
      outerRadius: 90,
      paddingAngle: 2,
    });
    expect(rechartsState.pieProps[0].data).toEqual([
      { name: 'Critique', value: 3, color: 'hsl(0 84% 60%)' },
      { name: 'Élevé', value: 2, color: 'hsl(25 95% 53%)' },
      { name: 'Faible', value: 5, color: 'hsl(142 76% 36%)' },
    ]);

    expect(rechartsState.cellFills).toEqual([
      'hsl(0 84% 60%)',
      'hsl(25 95% 53%)',
      'hsl(142 76% 36%)',
    ]);

    expect(rechartsState.tooltipProps[0].contentStyle).toEqual({
      background: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      fontSize: 12,
    });

    expect(rechartsState.legendProps[0].wrapperStyle).toEqual({
      fontSize: 11,
    });
  });

  it('affiche un état vide si aucune prop kpis n’est fournie', () => {
    render(<ChurnRiskDonut loading={false} />);

    expect(screen.getByText('Aucune donnée.')).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
    expect(rechartsState.pieProps).toHaveLength(0);
  });
});