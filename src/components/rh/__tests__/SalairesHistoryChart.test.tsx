import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SalairesHistoryChart } from '@/components/rh/SalairesHistoryChart';

// Mock Recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { vi } from 'vitest';

describe('SalairesHistoryChart', () => {
  const mockSalaires = [
    { id: '1', mois: '2026-01-01', salaire_brut: 3500, salaire_net: 2700, primes: 200, employee_id: 'e1' },
    { id: '2', mois: '2025-12-01', salaire_brut: 3400, salaire_net: 2600, primes: 100, employee_id: 'e1' },
    { id: '3', mois: '2025-11-01', salaire_brut: 3300, salaire_net: 2500, primes: 0, employee_id: 'e1' },
  ] as any[];

  it('should render charts with data', () => {
    render(<SalairesHistoryChart salaires={mockSalaires} />);
    expect(screen.getByText('Évolution des salaires (12 mois)')).toBeInTheDocument();
    expect(screen.getByText('Primes (12 mois)')).toBeInTheDocument();
  });

  it('should render line and bar charts', () => {
    render(<SalairesHistoryChart salaires={mockSalaires} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should render empty state with no data', () => {
    render(<SalairesHistoryChart salaires={[]} />);
    expect(screen.getByText('Aucune donnée disponible pour le graphique')).toBeInTheDocument();
  });
});
