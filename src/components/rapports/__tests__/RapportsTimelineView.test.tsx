import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: '1', statut: 'Production', created_at: '2025-06-01', date_signature: '2025-07-01', pallier_vise: 50000 },
    ],
  }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.pallier_vise || 0,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { RapportsTimelineView } from '../RapportsTimelineView';

describe('RapportsTimelineView', () => {
  it('renders timeline cards', () => {
    render(<RapportsTimelineView />);
    expect(screen.getByText('Évolution sur 12 mois')).toBeInTheDocument();
  });
});
