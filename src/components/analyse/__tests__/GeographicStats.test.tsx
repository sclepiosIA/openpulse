import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/geography/useGeographicStats', () => ({
  useGeographicStats: () => ({
    stats: {
      totalEtablissements: 50,
      regionsCount: 10,
      averagePerRegion: 5,
      totalPassagesUrgences: 120000,
      conversionRate: 35.5,
      coverageRate: 55.6,
    },
    loading: false,
  }),
}));

vi.mock('@/config/phases', () => ({
  getGeoPhaseFromStatus: (s: string) => s === 'Production' ? 'production' : 'prospects',
}));

vi.mock('@/lib/geoUtils', () => ({
  formatNumber: (n: number) => n.toLocaleString('fr-FR'),
  formatPercent: (n: number) => `${n}%`,
}));

import { GeographicStats } from '../GeographicStats';

describe('GeographicStats', () => {
  it('renders stats cards', () => {
    render(<GeographicStats />);
    expect(screen.getByText('Établissements')).toBeInTheDocument();
  });

  it('renders total count', () => {
    render(<GeographicStats />);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders with filtered etablissements', () => {
    const etabs = [
      { id: '1', statut: 'Production', region: 'IDF' },
      { id: '2', statut: 'Prospect', region: 'PACA' },
    ];
    render(<GeographicStats etablissements={etabs} />);
    expect(screen.getByText('Total Établissements')).toBeInTheDocument();
  });
});
