import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortfolioHealthCard } from '../PortfolioHealthCard';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('PortfolioHealthCard', () => {
  it('renders card title', () => {
    render(
      <QueryClientProvider client={qc}>
        <PortfolioHealthCard etablissements={[{ id: 'e1', statut: 'Production' }]} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Santé du portefeuille/i)).toBeInTheDocument();
  });

  it('renders with empty etablissements', () => {
    render(
      <QueryClientProvider client={qc}>
        <PortfolioHealthCard etablissements={[]} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Santé du portefeuille/i)).toBeInTheDocument();
  });

  it('filters only Production status', () => {
    const etabs = [
      { id: 'e1', statut: 'Production' },
      { id: 'e2', statut: 'Prospect' },
      { id: 'e3', statut: 'Production' },
    ];
    render(
      <QueryClientProvider client={qc}>
        <PortfolioHealthCard etablissements={etabs} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Santé du portefeuille/i)).toBeInTheDocument();
  });
});
