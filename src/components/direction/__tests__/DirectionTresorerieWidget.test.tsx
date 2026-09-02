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
        order: () => ({
          limit: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

import { DirectionTresorerieWidget } from '../DirectionTresorerieWidget';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('DirectionTresorerieWidget', () => {
  it('renders loading state initially', () => {
    const { container } = wrap(<DirectionTresorerieWidget />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders card container', () => {
    const { container } = wrap(<DirectionTresorerieWidget />);
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
  });
});
