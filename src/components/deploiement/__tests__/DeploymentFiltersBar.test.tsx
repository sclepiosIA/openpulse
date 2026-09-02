import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeploymentFiltersBar } from '../DeploymentFiltersBar';

vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({ data: [{ id: 'u1', prenom: 'Jean', nom: 'Dupont' }] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const defaultFilters = {
  searchTerm: '',
  phases: [],
  regions: [],
  types: [],
  healthStatuses: [],
  assignedTo: [],
  statuts: [],
  teamMembers: [],
};

describe('DeploymentFiltersBar', () => {
  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeploymentFiltersBar
          filters={defaultFilters}
          onFiltersChange={vi.fn()}
          sortField="nom"
          sortDirection="asc"
          onSortChange={vi.fn()}
          regions={['IDF']}
          types={['CHU']}
        />
      </QueryClientProvider>
    );
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });

  it('renders filter trigger button', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeploymentFiltersBar
          filters={defaultFilters}
          onFiltersChange={vi.fn()}
          sortField="nom"
          sortDirection="asc"
          onSortChange={vi.fn()}
          regions={[]}
          types={[]}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Filtres')).toBeInTheDocument();
  });

  it('renders sort selector', () => {
    render(
      <QueryClientProvider client={qc}>
        <DeploymentFiltersBar
          filters={defaultFilters}
          onFiltersChange={vi.fn()}
          sortField="nom"
          sortDirection="asc"
          onSortChange={vi.fn()}
          regions={[]}
          types={[]}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nom (A-Z)')).toBeInTheDocument();
  });
});
