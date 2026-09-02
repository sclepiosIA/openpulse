import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: '1', nom: 'CHU Nord', statut: 'Production', region: 'IDF', type_offre: 'Standard', responsable_id: 'u1', created_at: '2025-01-01', pallier_vise: 50000, nombre_passages_urgences: 30000 },
      { id: '2', nom: 'Clinique Sud', statut: 'Prospect', region: 'PACA', type_offre: 'Premium', responsable_id: 'u1', created_at: '2025-06-01', pallier_vise: 80000 },
    ],
  }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [{ id: 'u1', first_name: 'Jean', last_name: 'Dupont' }] }),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: (e: any) => e.pallier_vise || 0,
}));

import { RapportsTableView } from '../RapportsTableView';

describe('RapportsTableView', () => {
  it('renders table with etablissements', () => {
    render(
      <MemoryRouter>
        <RapportsTableView />
      </MemoryRouter>
    );
    expect(screen.getByText('CHU Nord')).toBeInTheDocument();
    expect(screen.getByText('Clinique Sud')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <MemoryRouter>
        <RapportsTableView />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });
});
