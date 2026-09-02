import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        gte: () => ({
          lte: () => Promise.resolve({ data: [], error: null, count: 0 }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

import { DirectionRHWidget } from '../DirectionRHWidget';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('DirectionRHWidget', () => {
  it('renders loading state initially', () => {
    const { container } = wrap(<DirectionRHWidget />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders card container', () => {
    const { container } = wrap(<DirectionRHWidget />);
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
  });
});
