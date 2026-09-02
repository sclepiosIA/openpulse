import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarSyncSettings } from '../CalendarSyncSettings';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', nom: 'Test', prenom: 'User' } }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('CalendarSyncSettings', () => {
  it('renders nothing when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <CalendarSyncSettings isOpen={false} onClose={vi.fn()} isAdmin={false} />
      </QueryClientProvider>
    );
    expect(screen.queryByText(/Synchronisation/i)).not.toBeInTheDocument();
  });

  it('renders dialog when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <CalendarSyncSettings isOpen={true} onClose={vi.fn()} isAdmin={true} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Synchronisation/i)).toBeInTheDocument();
  });

  it('shows content for admin users', () => {
    render(
      <QueryClientProvider client={qc}>
        <CalendarSyncSettings isOpen={true} onClose={vi.fn()} isAdmin={true} />
      </QueryClientProvider>
    );
    // Dialog renders via portal, check body for dialog content
    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
  });
});
