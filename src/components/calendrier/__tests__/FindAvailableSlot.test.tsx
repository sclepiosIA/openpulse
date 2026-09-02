import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => {
  const p: any = new Proxy({}, { get: () => (..._a: any[]) => p });
  return { supabase: p };
});

vi.mock('@/hooks/bookings/useFindAvailableSlots', () => ({
  useFindAvailableSlots: () => ({ slots: [], isSearching: false, searchSlots: vi.fn() }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [{ id: 'u1', first_name: 'Jean', last_name: 'Dupont' }] }),
}));

import { FindAvailableSlot } from '../FindAvailableSlot';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('FindAvailableSlot', () => {
  it('renders trigger button', () => {
    render(
      <QueryClientProvider client={qc}>
        <FindAvailableSlot />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Trouver un créneau/i)).toBeInTheDocument();
  });
});
