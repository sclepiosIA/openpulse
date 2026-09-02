import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RHEvolutionChart } from '@/components/rh/RHEvolutionChart';

vi.mock('@/hooks/hr/useRHAnalytics', () => ({
  useRHAnalytics: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { useRHAnalytics } from '@/hooks/hr/useRHAnalytics';

describe('RHEvolutionChart', () => {
  it('shows loading skeleton', () => {
    (useRHAnalytics as any).mockReturnValue({ data: null, isLoading: true });
    render(<RHEvolutionChart />);
    expect(screen.getByText('Évolution sur 12 mois')).toBeInTheDocument();
  });

  it('shows no data when analytics empty', () => {
    (useRHAnalytics as any).mockReturnValue({ data: null, isLoading: false });
    render(<RHEvolutionChart />);
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('shows no data when evolutionMensuelle is empty', () => {
    (useRHAnalytics as any).mockReturnValue({
      data: { evolutionMensuelle: [] },
      isLoading: false,
    });
    render(<RHEvolutionChart />);
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    (useRHAnalytics as any).mockReturnValue({
      data: {
        evolutionMensuelle: [
          { mois: '2026-01', masseSalariale: 50000, effectif: 10, coutMoyen: 5000 },
          { mois: '2026-02', masseSalariale: 52000, effectif: 11, coutMoyen: 4727 },
        ],
      },
      isLoading: false,
    });
    render(<RHEvolutionChart />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByText(/Masse salariale, effectif/)).toBeInTheDocument();
  });
});
