import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeploymentQuickActions } from '../DeploymentQuickActions';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            limit: () => Promise.resolve({ data: [], count: 0, error: null }),
          }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etablissement = {
  id: 'e1',
  nom: 'CHU Lyon',
  statut: 'Déploiement',
} as any;

describe('DeploymentQuickActions', () => {
  it('renders 3 icon buttons', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DeploymentQuickActions etablissement={etablissement} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);
  });

  it('renders container', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DeploymentQuickActions etablissement={etablissement} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
