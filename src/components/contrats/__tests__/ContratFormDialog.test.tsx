import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/contracts/useContrats', () => ({
  useCreateContrat: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateContrat: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/contracts/useContratTemplates', () => ({
  useContratTemplates: () => ({ data: [], isLoading: false }),
}));

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });
chainable.single = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable },
}));

import ContratFormDialog from '../ContratFormDialog';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('ContratFormDialog', () => {
  it('renders new contrat dialog', () => {
    render(
      <QueryClientProvider client={qc}>
        <ContratFormDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Nouveau contrat/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <ContratFormDialog open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
