import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMutation = { mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false };

vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/system/useSystemManagement', () => ({
  useDatabaseStats: () => ({ data: null, isLoading: false }),
  useDatabaseActions: () => new Proxy({}, { get: () => mockMutation }),
}));
vi.mock('@/hooks/auth/useSecurityActions', () => ({
  useAdminDataActions: () => new Proxy({}, { get: () => mockMutation }),
}));
vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) },
}));

import GestionBaseDonnees from '../GestionBaseDonnees';
import { supabase } from '@/integrations/supabase/client';

describe('GestionBaseDonnees page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><GestionBaseDonnees /></MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
