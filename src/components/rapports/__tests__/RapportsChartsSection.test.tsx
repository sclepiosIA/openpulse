import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: '1', statut: 'Production', type_offre: 'Standard', region: 'IDF', pallier_vise: 50000 },
      { id: '2', statut: 'Prospect', type_offre: 'Premium', region: 'PACA', pallier_vise: 80000 },
    ],
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [{ id: 'u1', first_name: 'Test', last_name: 'User' }] }),
}));

vi.mock('@/hooks/system/useReferenceData', () => ({
  useStatutsEtablissement: () => ({ data: [] }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.pallier_vise || 0,
}));

vi.mock('@/config/referenceDataDefaults', () => ({
  FALLBACK_FUNNEL_STATUTS: [],
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  FunnelChart: ({ children }: any) => <div>{children}</div>,
  Funnel: () => null,
  LabelList: () => null,
}));

import { RapportsChartsSection } from '../RapportsChartsSection';

describe('RapportsChartsSection', () => {
  it('renders chart cards', () => {
    render(<RapportsChartsSection />);
    expect(screen.getByText('Pipeline par Statut')).toBeInTheDocument();
  });

  it('renders distribution chart', () => {
    render(<RapportsChartsSection />);
    expect(screen.getByText("Distribution par Type d'Offre")).toBeInTheDocument();
  });
});
