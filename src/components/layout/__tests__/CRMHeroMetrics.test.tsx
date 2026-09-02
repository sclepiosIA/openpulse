import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CRMHeroMetrics, MetricConfig } from '../CRMHeroMetrics';
import { Building2, Users, Euro } from 'lucide-react';

describe('CRMHeroMetrics', () => {
  const metrics: MetricConfig[] = [
    { id: 'm1', label: 'Total', value: 42, icon: Building2 },
    { id: 'm2', label: 'Actifs', value: '28', icon: Users, accentColor: 'green' },
    { id: 'm3', label: 'CA', value: '150K €', icon: Euro, trend: { value: 12, isPositive: true } },
  ];

  it('renders all metrics', () => {
    render(<CRMHeroMetrics metrics={metrics} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Actifs')).toBeInTheDocument();
    expect(screen.getByText('150K €')).toBeInTheDocument();
  });

  it('renders trend when provided', () => {
    render(<CRMHeroMetrics metrics={metrics} />);
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('applies custom columns', () => {
    const { container } = render(<CRMHeroMetrics metrics={metrics} columns={3} />);
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument();
  });

  it('renders with 2 columns', () => {
    const { container } = render(<CRMHeroMetrics metrics={metrics} columns={2} />);
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeInTheDocument();
  });
});
