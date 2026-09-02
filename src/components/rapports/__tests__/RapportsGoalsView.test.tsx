import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: '1', statut: 'Production', created_at: '2026-01-15', pallier_vise: 100000, region: 'IDF', responsable_id: 'u1' },
      { id: '2', statut: 'Prospect', created_at: '2026-02-01', pallier_vise: 50000, region: 'PACA', responsable_id: 'u1' },
    ],
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [{ id: 'u1', first_name: 'A', last_name: 'B' }] }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.pallier_vise || 0,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));

import { RapportsGoalsView } from '../RapportsGoalsView';

describe('RapportsGoalsView', () => {
  it('renders goal cards', () => {
    render(<RapportsGoalsView />);
    expect(screen.getByText('CA Annuel')).toBeInTheDocument();
  });

  it('renders conversion rate card', () => {
    render(<RapportsGoalsView />);
    expect(screen.getByText('Taux de Conversion')).toBeInTheDocument();
  });

  it('renders production card', () => {
    render(<RapportsGoalsView />);
    expect(screen.getByText('En Production')).toBeInTheDocument();
  });
});
