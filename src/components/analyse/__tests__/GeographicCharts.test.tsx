import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/geography/useGeographicStats', () => ({
  useGeographicStats: () => ({
    stats: {
      totalEtablissements: 50,
      byPhase: { Prospects: 20, Production: 30 },
      byRegion: { 'Île-de-France': 15, PACA: 10 },
      topRegions: [
        { region: 'Île-de-France', count: 15, byStatus: { Production: 10, Prospect: 5 } },
        { region: 'PACA', count: 10, byStatus: { Production: 6, Prospect: 4 } },
      ],
    },
    loading: false,
  }),
}));

vi.mock('@/lib/geoUtils', () => ({
  getPhaseColor: () => '#4CAF50',
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { GeographicCharts } from '../GeographicCharts';

describe('GeographicCharts', () => {
  it('renders chart titles', () => {
    render(<GeographicCharts />);
    expect(screen.getByText('Distribution par Phase')).toBeInTheDocument();
  });

  it('renders top regions chart', () => {
    render(<GeographicCharts />);
    expect(screen.getByText('Top Régions par Statut')).toBeInTheDocument();
  });
});
