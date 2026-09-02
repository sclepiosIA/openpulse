import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogueProduits } from '../CatalogueProduits';

vi.mock('@/hooks/catalogue/useCatalogueProduits', () => ({
  useCatalogueProduits: () => ({
    produits: [
      { id: 'p1', code: 'SVC-001', nom: 'Licence OpenPulse', description: 'Licence annuelle', type: 'licence', prix_unitaire_ht: 5000, taux_tva: 20, unite: 'unité', est_actif: true },
      { id: 'p2', code: 'SVC-002', nom: 'Formation', description: 'Session formation', type: 'formation', prix_unitaire_ht: 1500, taux_tva: 20, unite: 'session', est_actif: true },
    ],
    isLoading: false,
    createProduit: { mutateAsync: vi.fn(), isPending: false },
    updateProduit: { mutateAsync: vi.fn(), isPending: false },
    deleteProduit: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('CatalogueProduits', () => {
  it('renders catalogue title', () => {
    render(
      <QueryClientProvider client={qc}>
        <CatalogueProduits />
      </QueryClientProvider>
    );
    expect(screen.getByText('Catalogue de produits & services')).toBeInTheDocument();
  });

  it('renders product names', () => {
    render(
      <QueryClientProvider client={qc}>
        <CatalogueProduits />
      </QueryClientProvider>
    );
    expect(screen.getByText('Licence OpenPulse')).toBeInTheDocument();
    const formations = screen.getAllByText('Formation');
    expect(formations.length).toBeGreaterThanOrEqual(1);
  });

  it('renders product codes', () => {
    render(
      <QueryClientProvider client={qc}>
        <CatalogueProduits />
      </QueryClientProvider>
    );
    expect(screen.getByText('SVC-001')).toBeInTheDocument();
    expect(screen.getByText('SVC-002')).toBeInTheDocument();
  });

  it('renders add button', () => {
    render(
      <QueryClientProvider client={qc}>
        <CatalogueProduits />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nouveau produit')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <CatalogueProduits />
      </QueryClientProvider>
    );
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });
});
