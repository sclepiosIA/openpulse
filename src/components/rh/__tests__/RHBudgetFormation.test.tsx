import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RHBudgetFormation } from '../RHBudgetFormation';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHBudgetFormation', () => {
  it('renders budget amounts', async () => {
    render(
      <QueryClientProvider client={qc}>
        <RHBudgetFormation />
      </QueryClientProvider>
    );
    // Wait for data to load
    expect(await screen.findByText(/Budget annuel/)).toBeInTheDocument();
  });

  it('renders suggestions section', async () => {
    render(
      <QueryClientProvider client={qc}>
        <RHBudgetFormation />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Suggestions IA')).toBeInTheDocument();
  });
});
