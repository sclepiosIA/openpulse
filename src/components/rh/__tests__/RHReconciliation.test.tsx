import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import { RHReconciliation } from '../RHReconciliation';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHReconciliation', () => {
  it('renders component title', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHReconciliation />
      </QueryClientProvider>
    );
    expect(screen.getByText('Réconciliation RH ↔ Trésorerie')).toBeInTheDocument();
  });
});
