import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/contracts/useContrats', () => ({
  useContrat: () => ({ data: null, isLoading: false, error: new Error('Not found') }),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/components/contrats/builder/ContractBuilderLayout', () => ({
  ContractBuilderLayout: () => <div data-testid="builder-layout" />,
}));
vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div data-testid="loader" />,
}));

import ContractBuilder from '../ContractBuilder';

describe('ContractBuilder page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders error state when contrat not found', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/contrats/builder/xxx']}>
          <Routes>
            <Route path="/contrats/builder/:id" element={<ContractBuilder />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Contrat introuvable')).toBeInTheDocument();
  });
});
