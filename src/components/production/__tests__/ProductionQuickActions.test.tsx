import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductionQuickActions } from '../ProductionQuickActions';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/hr/useRHMutations', () => ({
  useCreateProductionNote: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const etablissement = { id: 'e1', nom: 'Test' } as any;

describe('ProductionQuickActions', () => {
  it('renders 3 action buttons', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <ProductionQuickActions etablissement={etablissement} />
      </QueryClientProvider>
    );
    expect(container.querySelectorAll('button').length).toBe(3);
  });

  it('renders note button with title', () => {
    render(
      <QueryClientProvider client={qc}>
        <ProductionQuickActions etablissement={etablissement} />
      </QueryClientProvider>
    );
    expect(screen.getByTitle('Ajouter une note')).toBeInTheDocument();
  });

  it('renders tasks button', () => {
    render(
      <QueryClientProvider client={qc}>
        <ProductionQuickActions etablissement={etablissement} />
      </QueryClientProvider>
    );
    expect(screen.getByTitle('Voir les tâches')).toBeInTheDocument();
  });

  it('renders activities button', () => {
    render(
      <QueryClientProvider client={qc}>
        <ProductionQuickActions etablissement={etablissement} />
      </QueryClientProvider>
    );
    expect(screen.getByTitle('Voir les activités')).toBeInTheDocument();
  });
});
