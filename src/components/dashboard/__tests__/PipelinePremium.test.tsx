import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PipelinePremium } from '../PipelinePremium';

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({
    data: [
      { id: 'e1', nom: 'CHU Lyon', statut: 'Prospect', ca_potentiel: 50000, passages_potentiel: 200 },
      { id: 'e2', nom: 'CHU Bordeaux', statut: 'RDV pris', ca_potentiel: 80000, passages_potentiel: 300 },
      { id: 'e3', nom: 'CHU Paris', statut: 'Production', ca_potentiel: 120000, passages_potentiel: 500 },
    ],
    isLoading: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('PipelinePremium', () => {
  it('renders pipeline phases', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <PipelinePremium />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getAllByText('Prospection').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Négociation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Déploiement').length).toBeGreaterThanOrEqual(1);
  });

  it('renders pipeline title', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <PipelinePremium />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Pipeline Commercial')).toBeInTheDocument();
  });
});
