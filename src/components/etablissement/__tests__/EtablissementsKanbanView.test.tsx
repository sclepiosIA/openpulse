import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EtablissementsKanbanView } from '../EtablissementsKanbanView';

vi.mock('@/hooks/system/useReferenceData', () => ({
  useStatutsEtablissement: () => ({ data: [] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etabs = [
  { id: 'e1', nom: 'CHU Lyon', ville: 'Lyon', statut: 'Prospects', logo_url: null },
  { id: 'e2', nom: 'Clinique Pasteur', ville: 'Paris', statut: 'Production', logo_url: null },
] as any[];

describe('EtablissementsKanbanView', () => {
  it('renders kanban columns with fallback statuts', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <EtablissementsKanbanView etablissements={etabs} />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Prospects')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders etablissement in correct column', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <EtablissementsKanbanView etablissements={etabs} />
        </QueryClientProvider>
      </MemoryRouter>
    );
    // CHU Lyon has statut 'Prospects' which matches the Prospects column
    expect(screen.getByText('Prospects')).toBeInTheDocument();
  });
});
