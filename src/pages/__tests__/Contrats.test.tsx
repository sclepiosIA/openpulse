import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/contracts/useContrats', () => ({
  useContrats: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), setOpen: vi.fn() }),
}));

import Contrats from '../Contrats';

describe('Contrats page', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Contrats />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
