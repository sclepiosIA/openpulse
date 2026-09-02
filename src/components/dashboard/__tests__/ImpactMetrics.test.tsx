import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImpactMetrics } from '../ImpactMetrics';
import { Building2, Euro } from 'lucide-react';

describe('ImpactMetrics', () => {
  const metrics = [
    { value: 42, label: 'Établissements', color: 'primary' as const, icon: Building2, trend: 5 },
    { value: '1.2M€', label: 'CA Total', sublabel: 'Pipeline actif', color: 'success' as const, icon: Euro },
    { value: 85, label: 'Taux', color: 'warning' as const, trend: -3 },
  ];

  it('renders all metric labels', () => {
    render(<ImpactMetrics metrics={metrics} />);
    expect(screen.getByText('Établissements')).toBeInTheDocument();
    expect(screen.getByText('CA Total')).toBeInTheDocument();
    expect(screen.getByText('Taux')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<ImpactMetrics metrics={metrics} title="Vue d'ensemble" />);
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
  });

  it('renders sublabel when provided', () => {
    render(<ImpactMetrics metrics={metrics} />);
    expect(screen.getByText('Pipeline actif')).toBeInTheDocument();
  });

  it('renders positive trend with up icon', () => {
    render(<ImpactMetrics metrics={metrics} />);
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('renders negative trend with down icon', () => {
    render(<ImpactMetrics metrics={metrics} />);
    expect(screen.getByText('3%')).toBeInTheDocument();
  });

  it('renders string values correctly', () => {
    render(<ImpactMetrics metrics={metrics} />);
    expect(screen.getByText('1.2M€')).toBeInTheDocument();
  });
});
