import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/contracts/useContrats', () => ({
  useContrats: () => ({
    data: [
      {
        id: 'c1',
        numero: 'CTR-001',
        titre: 'Contrat CHU',
        statut: 'actif',
        type: 'licence',
        client_nom: 'CHU Lyon',
        montant_annuel: 50000,
        date_debut: '2026-01-01',
        date_fin: '2027-01-01',
      },
    ],
    isLoading: false,
  }),
  useDeleteContrat: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateContrat: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

import ContratsList from '../ContratsList';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('ContratsList', () => {
  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ContratsList onCreateNew={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByPlaceholderText(/Rechercher/)).toBeInTheDocument();
  });

  it('renders contrat data', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ContratsList onCreateNew={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('CTR-001')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ContratsList onCreateNew={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Liste des contrats')).toBeInTheDocument();
  });
});
