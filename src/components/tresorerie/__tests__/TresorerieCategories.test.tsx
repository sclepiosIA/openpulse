import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TresorerieCategories } from '../TresorerieCategories';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: '1' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TresorerieCategories', () => {
  it('renders page title', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieCategories />
      </QueryClientProvider>
    );
    expect(screen.getByText('Gestion des catégories')).toBeInTheDocument();
  });

  it('renders add category button', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieCategories />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nouvelle catégorie')).toBeInTheDocument();
  });
});
