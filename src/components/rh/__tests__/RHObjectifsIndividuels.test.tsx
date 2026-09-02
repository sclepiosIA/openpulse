import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/hr/useRHMutations', () => ({
  useCreateObjectif: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { RHObjectifsIndividuels } from '../RHObjectifsIndividuels';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHObjectifsIndividuels', () => {
  it('renders component title', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHObjectifsIndividuels />
      </QueryClientProvider>
    );
    expect(screen.getByText('Mes objectifs')).toBeInTheDocument();
  });

  it('renders add button', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHObjectifsIndividuels />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nouvel objectif')).toBeInTheDocument();
  });
});
