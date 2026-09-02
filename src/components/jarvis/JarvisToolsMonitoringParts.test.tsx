import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockFormatLatency, mockFormatCost, mockGetHealthStatus } = vi.hoisted(() => ({
  mockFormatLatency: vi.fn((ms: number) => `${ms} ms`),
  mockFormatCost: vi.fn((c: number) => `${c.toFixed(2)} €`),
  mockGetHealthStatus: vi.fn(() => 'good' as const),
}));

vi.mock('@/hooks/jarvis/useJarvisToolsMonitoring', () => ({
  formatLatency: mockFormatLatency,
  formatCost: mockFormatCost,
  getHealthStatus: mockGetHealthStatus,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<unknown>) =>
    classes
      .flatMap((c) => {
        if (!c) return [];
        if (typeof c === 'string') return [c];
        return [];
      })
      .join(' '),
}));

vi.mock('lucide-react', () => ({
  TrendingUp: (props: { className?: string }) => <svg data-testid="icon-trending-up" className={props.className} />,
  TrendingDown: (props: { className?: string }) => <svg data-testid="icon-trending-down" className={props.className} />,
  ChevronDown: (props: { className?: string }) => <svg data-testid="icon-chevron-down" className={props.className} />,
  ChevronUp: (props: { className?: string }) => <svg data-testid="icon-chevron-up" className={props.className} />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  TableRow: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler;
  }) => (
    <div role="row" data-testid="table-row" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  TableCell: ({
    children,
    className,
    colSpan,
  }: {
    children: React.ReactNode;
    className?: string;
    colSpan?: number;
  }) => (
    <div role="cell" data-testid="table-cell" className={className} data-colspan={colSpan}>
      {children}
    </div>
  ),
}));

const { mockCollapsibleOnOpenChange } = vi.hoisted(() => ({
  mockCollapsibleOnOpenChange: vi.fn<(v: boolean) => void>(),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => {
    mockCollapsibleOnOpenChange.mockImplementation((v: boolean) => onOpenChange?.(v));
    return (
      <div data-testid="collapsible" data-open={open ? 'true' : 'false'}>
        {children}
      </div>
    );
  },
  CollapsibleTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (
    <div
      data-testid="collapsible-trigger"
      data-aschild={asChild ? 'true' : 'false'}
      onClick={() => mockCollapsibleOnOpenChange(true)}
    >
      {children}
    </div>
  ),
  CollapsibleContent: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (
    <div data-testid="collapsible-content" data-aschild={asChild ? 'true' : 'false'}>
      {children}
    </div>
  ),
}));

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return {
    ...actual,
    formatDistanceToNow: vi.fn(() => 'il y a 5 minutes'),
  };
});

vi.mock('date-fns/locale', () => ({ fr: {} }));

import { KPICard, ToolDetailRow, HEALTH_COLORS, CHART_COLORS } from './JarvisToolsMonitoringParts';

describe('JarvisToolsMonitoringParts', () => {
  it('exports constants with expected structure', () => {
    expect(Object.keys(HEALTH_COLORS).sort()).toEqual(['critical', 'degraded', 'excellent', 'good'].sort());
    expect(HEALTH_COLORS.excellent).toEqual({
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-500',
      border: 'border-emerald-500/20',
    });
    expect(CHART_COLORS).toHaveLength(6);
    expect(CHART_COLORS[0]).toBe('hsl(var(--primary))');
    expect(CHART_COLORS[5]).toBe('hsl(346, 77%, 49%)');
  });

  it('renders KPICard with positive trend and label', () => {
    render(
      <KPICard
        title="Appels"
        value={1234}
        subtitle="sur 24h"
        icon={<span data-testid="kpi-icon">I</span>}
        trend={2.34}
        trendLabel="vs hier"
      />
    );

    expect(screen.getByText('Appels')).toBeTruthy();
    expect(screen.getByText('1234')).toBeTruthy();
    expect(screen.getByText('sur 24h')).toBeTruthy();
    expect(screen.getByTestId('kpi-icon')).toBeTruthy();
    expect(screen.getByTestId('icon-trending-up')).toBeTruthy();
    expect(screen.getByText('2.3%')).toBeTruthy();
    expect(screen.getByText('vs hier')).toBeTruthy();
  });

  it('renders KPICard with negative trend', () => {
    render(<KPICard title="Coût" value="12 €" icon={<span data-testid="kpi-icon">€</span>} trend={-1.2} />);

    expect(screen.getByText('Coût')).toBeTruthy();
    expect(screen.getByText('12 €')).toBeTruthy();
    expect(screen.getByTestId('icon-trending-down')).toBeTruthy();
    expect(screen.getByText('1.2%')).toBeTruthy();
  });

  it('renders ToolDetailRow collapsed and calls onToggle when clicked', () => {
    mockGetHealthStatus.mockReturnValueOnce('good');

    const onToggle = vi.fn();
    const tool = {
      id: 'tool-1',
      name: 'tool_1',
      displayName: 'Mon Outil',
      callCount: 1200,
      successRate: 96.12,
      avgLatencyMs: 321,
      p50LatencyMs: 200,
      p90LatencyMs: 500,
      p99LatencyMs: 900,
      estimatedCost: 1.23,
      totalTokens: 4567,
      avgTokensPerCall: 3.81,
      lastUsed: '2024-01-01T00:00:00.000Z',
      trend: {
        latencyChange: 10.25,
        successRateChange: -0.5,
      },
    };

    render(<ToolDetailRow tool={tool} isExpanded={false} onToggle={onToggle} />);

    expect(mockGetHealthStatus).toHaveBeenCalledWith(96.12, 321);
    expect(screen.getByText('Mon Outil')).toBeTruthy();
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('96.1%')).toBeTruthy();

    expect(mockFormatLatency).toHaveBeenCalledWith(321);
    expect(mockFormatLatency).toHaveBeenCalledWith(500);
    expect(screen.getByText('321 ms')).toBeTruthy();
    expect(screen.getByText('500 ms')).toBeTruthy();

    expect(mockFormatCost).toHaveBeenCalledWith(1.23);
    expect(screen.getByText('1.23 €')).toBeTruthy();

    expect(screen.getByTestId('icon-chevron-down')).toBeTruthy();

    fireEvent.click(screen.getByTestId('collapsible-trigger'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders ToolDetailRow expanded with details and N/A when lastUsed is null', () => {
    mockGetHealthStatus.mockReturnValueOnce('excellent');

    const onToggle = vi.fn();
    const tool = {
      id: 'tool-2',
      name: 'tool_2',
      displayName: 'Outil 2',
      callCount: 1,
      successRate: 99.9,
      avgLatencyMs: 10,
      p50LatencyMs: 8,
      p90LatencyMs: 12,
      p99LatencyMs: 20,
      estimatedCost: 0.05,
      totalTokens: 10,
      avgTokensPerCall: 10,
      lastUsed: null,
      trend: {
        latencyChange: -2.5,
        successRateChange: 1.2,
      },
    };

    render(<ToolDetailRow tool={tool} isExpanded={true} onToggle={onToggle} />);

    expect(screen.getByTestId('icon-chevron-up')).toBeTruthy();

    expect(screen.getByText('P50: 8 ms')).toBeTruthy();
    expect(screen.getByText('P90: 12 ms')).toBeTruthy();
    expect(screen.getByText('P99: 20 ms')).toBeTruthy();

    expect(screen.getByText('10 total')).toBeTruthy();
    expect(screen.getByText('~10 / appel')).toBeTruthy();

    expect(screen.getByText('Latence: -2.5%')).toBeTruthy();
    expect(screen.getByText('Succès: +1.2%')).toBeTruthy();

    expect(screen.getByText('N/A')).toBeTruthy();
  });
});