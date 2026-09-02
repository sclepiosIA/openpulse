import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/shared/useSmartNavigation', () => ({
  useSmartNavigation: () => ({ smartNavigate: vi.fn(), navigate: vi.fn() }),
}));

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <span>{name}</span>,
}));

vi.mock('./CustomerHealthIndicator', () => ({
  CustomerHealthIndicator: () => <span data-testid="health" />,
}));

vi.mock('../CustomerHealthIndicator', () => ({
  CustomerHealthIndicator: () => <span data-testid="health" />,
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: () => 50000,
}));

import { ProductionListView } from '../ProductionListView';

const etabs = [
  { id: '1', nom: 'CHU Nord', statut: 'Production', region: 'IDF', pallier_vise: 50000 },
  { id: '2', nom: 'Clinique Sud', statut: 'Production', region: 'PACA', pallier_vise: 80000 },
] as any[];

describe('ProductionListView', () => {
  it('renders table with names', () => {
    render(
      <MemoryRouter>
        <ProductionListView etablissements={etabs} healthScores={new Map()} />
      </MemoryRouter>
    );
    expect(screen.getAllByText('CHU Nord').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clinique Sud').length).toBeGreaterThanOrEqual(1);
  });

  it('renders table header', () => {
    render(
      <MemoryRouter>
        <ProductionListView etablissements={etabs} healthScores={new Map()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Nom')).toBeInTheDocument();
  });
});
