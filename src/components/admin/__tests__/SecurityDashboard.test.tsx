import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });
chainable.single = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable, rpc: () => Promise.resolve({ data: null, error: null }) },
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SecurityDashboard } from '../SecurityDashboard';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('SecurityDashboard', () => {
  it('renders loading state initially', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <SecurityDashboard />
      </QueryClientProvider>
    );
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
