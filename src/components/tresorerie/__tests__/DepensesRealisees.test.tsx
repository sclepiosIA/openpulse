import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepensesRealisees } from '../DepensesRealisees';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/tresorerie/useQontoDebits', () => ({
  useQontoDebits: () => ({
    debits: [
      { id: 'd1', date_operation: '2026-01-15', libelle: 'Achat fournitures', montant: -150, categorie_code: null, reference_externe: null },
      { id: 'd2', date_operation: '2026-02-01', libelle: 'Loyer', montant: -2000, categorie_code: 'office_rental', reference_externe: null },
    ],
    isLoading: false,
    updateCategorie: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('DepensesRealisees', () => {
  const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

  it('renders search input', () => {
    wrap(<DepensesRealisees />);
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });

  it('renders transaction rows', () => {
    wrap(<DepensesRealisees />);
    expect(screen.getByText('Achat fournitures')).toBeInTheDocument();
    expect(screen.getByText('Loyer')).toBeInTheDocument();
  });

  it('renders KPI cards', () => {
    wrap(<DepensesRealisees />);
    expect(screen.getByText('Total débits')).toBeInTheDocument();
  });
});
