import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RHComparisonCard } from '@/components/rh/RHComparisonCard';

vi.mock('@/hooks/hr/useRHComparisons', () => ({
  useRHComparisons: vi.fn(),
}));

import { useRHComparisons } from '@/hooks/hr/useRHComparisons';

const mockComparison = {
  current: { periode: 'Mar 2026', masseSalariale: 50000, effectif: 10, coutMoyen: 5000 },
  previous: { periode: 'Fév 2026', masseSalariale: 48000, effectif: 9, coutMoyen: 5333 },
  delta: {
    masseSalariale: { value: 2000, percentage: 4.2 },
    effectif: { value: 1, percentage: 11.1 },
    coutMoyen: { value: -333, percentage: -6.3 },
  },
};

describe('RHComparisonCard', () => {
  it('shows loading skeleton', () => {
    (useRHComparisons as any).mockReturnValue({ data: null, isLoading: true });
    render(<RHComparisonCard />);
    expect(screen.getByText('Comparaison')).toBeInTheDocument();
  });

  it('shows no data message', () => {
    (useRHComparisons as any).mockReturnValue({ data: null, isLoading: false });
    render(<RHComparisonCard />);
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('renders comparison data with trends', () => {
    (useRHComparisons as any).mockReturnValue({ data: mockComparison, isLoading: false });
    render(<RHComparisonCard />);
    expect(screen.getByText('Masse salariale')).toBeInTheDocument();
    expect(screen.getByText('Effectif')).toBeInTheDocument();
    expect(screen.getByText('Coût moyen / employé')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
    expect(screen.getByText('11.1%')).toBeInTheDocument();
    expect(screen.getByText('6.3%')).toBeInTheDocument();
  });

  it('shows correct period labels', () => {
    (useRHComparisons as any).mockReturnValue({ data: mockComparison, isLoading: false });
    render(<RHComparisonCard />);
    expect(screen.getAllByText('Mar 2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fév 2026').length).toBeGreaterThanOrEqual(1);
  });

  it('renders type label for quarter', () => {
    (useRHComparisons as any).mockReturnValue({ data: mockComparison, isLoading: false });
    render(<RHComparisonCard type="quarter" />);
    expect(screen.getByText('Trimestre vs Trimestre précédent')).toBeInTheDocument();
  });

  it('renders type label for year', () => {
    (useRHComparisons as any).mockReturnValue({ data: mockComparison, isLoading: false });
    render(<RHComparisonCard type="year" />);
    expect(screen.getByText('Année vs Année précédente')).toBeInTheDocument();
  });
});
