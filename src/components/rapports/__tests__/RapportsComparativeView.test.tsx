import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: '1', statut: 'Production', region: 'IDF', type_offre: 'Standard', responsable_id: 'u1', pallier_vise: 50000 },
      { id: '2', statut: 'Prospect', region: 'PACA', type_offre: 'Premium', responsable_id: 'u1', pallier_vise: 80000 },
    ],
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [{ id: 'u1', first_name: 'Jean', last_name: 'Dupont' }] }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.pallier_vise || 0,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
}));

import { RapportsComparativeView } from '../RapportsComparativeView';

describe('RapportsComparativeView', () => {
  it('renders comparative tabs', () => {
    render(<RapportsComparativeView />);
    expect(screen.getByText('Par Région')).toBeInTheDocument();
  });

  it('renders type offre tab', () => {
    render(<RapportsComparativeView />);
    expect(screen.getByText("Par Type d'Offre")).toBeInTheDocument();
  });
});
