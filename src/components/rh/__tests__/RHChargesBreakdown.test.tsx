import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RHChargesBreakdown } from '@/components/rh/RHChargesBreakdown';

vi.mock('@/hooks/hr/useRHAnalytics', () => ({
  useRHAnalytics: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { useRHAnalytics } from '@/hooks/hr/useRHAnalytics';

describe('RHChargesBreakdown', () => {
  it('shows loading skeleton', () => {
    (useRHAnalytics as any).mockReturnValue({ data: null, isLoading: true });
    render(<RHChargesBreakdown />);
    expect(screen.getByText('Répartition des charges')).toBeInTheDocument();
  });

  it('shows no data message', () => {
    (useRHAnalytics as any).mockReturnValue({ data: null, isLoading: false });
    render(<RHChargesBreakdown />);
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('renders pyramid breakdown with data', () => {
    (useRHAnalytics as any).mockReturnValue({
      data: {
        chargesDetail: {
          totalSalaireBrut: 30000,
          totalCotisationsSalariales: 7000,
          totalCotisationsPatronales: 12000,
          totalPrimes: 2000,
        },
      },
      isLoading: false,
    });
    render(<RHChargesBreakdown />);
    expect(screen.getByText('Salaire net (perçu)')).toBeInTheDocument();
    expect(screen.getByText(/Salaire brut/)).toBeInTheDocument();
    expect(screen.getByText(/Coût total employeur/)).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders chart', () => {
    (useRHAnalytics as any).mockReturnValue({
      data: {
        chargesDetail: {
          totalSalaireBrut: 30000,
          totalCotisationsSalariales: 7000,
          totalCotisationsPatronales: 12000,
          totalPrimes: 2000,
        },
      },
      isLoading: false,
    });
    render(<RHChargesBreakdown />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });
});
