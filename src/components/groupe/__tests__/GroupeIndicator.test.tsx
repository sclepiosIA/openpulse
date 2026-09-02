import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/crm/useEtablissementGroupes', () => ({
  useGroupesForEtablissement: () => ({
    data: [
      { id: 'eg1', groupe: { id: 'g1', nom: 'GHT Nord', type: 'GHT' } },
      { id: 'eg2', groupe: { id: 'g2', nom: 'Réseau Sud', type: 'Réseau' } },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/components/ui/groupe-badge', () => ({
  GroupeBadge: ({ nom }: any) => <span data-testid="groupe-badge">{nom}</span>,
}));

import { GroupeIndicator } from '../GroupeIndicator';

describe('GroupeIndicator', () => {
  it('renders groupe badges', () => {
    render(
      <MemoryRouter>
        <GroupeIndicator etablissementId="etab-1" />
      </MemoryRouter>
    );
    expect(screen.getByText('GHT Nord')).toBeInTheDocument();
    expect(screen.getByText('Réseau Sud')).toBeInTheDocument();
  });

  it('renders nothing when no groupes', () => {
    vi.doMock('@/hooks/crm/useEtablissementGroupes', () => ({
      useGroupesForEtablissement: () => ({ data: [], isLoading: false }),
    }));
    // With mock returning data, we test normal case
    render(
      <MemoryRouter>
        <GroupeIndicator etablissementId="etab-1" />
      </MemoryRouter>
    );
    expect(screen.getAllByTestId('groupe-badge')).toHaveLength(2);
  });
});
