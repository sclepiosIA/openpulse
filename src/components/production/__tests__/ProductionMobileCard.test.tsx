import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProductionMobileCard } from '../ProductionMobileCard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etablissement = {
  id: 'e1',
  nom: 'CHU Bordeaux',
  type: 'CHU',
  date_go_live: '2025-06-01',
  csm: { prenom: 'Marie', nom: 'Dupont' },
  logo_url: null,
} as any;

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('ProductionMobileCard', () => {
  it('renders etablissement name', () => {
    wrap(<ProductionMobileCard etablissement={etablissement} />);
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument();
  });

  it('renders type', () => {
    wrap(<ProductionMobileCard etablissement={etablissement} />);
    expect(screen.getByText('CHU')).toBeInTheDocument();
  });

  it('renders CSM initial', () => {
    wrap(<ProductionMobileCard etablissement={etablissement} />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders adoption label', () => {
    wrap(<ProductionMobileCard etablissement={etablissement} />);
    expect(screen.getByText('Adoption')).toBeInTheDocument();
  });

  it('renders CA label', () => {
    wrap(<ProductionMobileCard etablissement={etablissement} />);
    expect(screen.getByText('CA')).toBeInTheDocument();
  });
});
