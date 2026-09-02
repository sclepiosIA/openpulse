import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RHTresorerieWidget } from '@/components/rh/RHTresorerieWidget';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({
            single: () => Promise.resolve({
              data: { id: '1', date: '2026-03-01', solde_debut: 40000, solde_fin: 50000, total_recettes: 15000, total_depenses: 5000, created_at: '2026-03-01' },
              error: null,
            }),
          }),
        }),
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'cat1' }, error: null }),
          gte: () => ({
            order: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('RHTresorerieWidget', () => {
  it('renders title', () => {
    wrap(<RHTresorerieWidget />);
    expect(screen.getByText('Trésorerie')).toBeInTheDocument();
  });

  it('renders "Voir tout" button', () => {
    wrap(<RHTresorerieWidget />);
    expect(screen.getByText('Voir tout')).toBeInTheDocument();
  });

  it('renders solde label', () => {
    wrap(<RHTresorerieWidget />);
    expect(screen.getByText('Solde actuel')).toBeInTheDocument();
  });
});
