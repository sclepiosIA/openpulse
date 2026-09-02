import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailSyncHealth } from '../EmailSyncHealth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: vi.fn(),
}));

import { fromExtended } from '@/lib/supabaseTyped';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

describe('EmailSyncHealth', () => {
  beforeEach(() => {
    qc.clear();
  });

  it('renders title', () => {
    (fromExtended as any).mockReturnValue({
      select: () => ({
        or: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });
    wrap(<EmailSyncHealth />);
    expect(screen.getAllByText('Santé des comptes email').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no accounts message when empty', async () => {
    (fromExtended as any).mockReturnValue({
      select: () => ({
        or: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });
    wrap(<EmailSyncHealth />);
    expect(await screen.findByText('Aucun compte support configuré')).toBeInTheDocument();
  });

  it('renders account card with email address', async () => {
    (fromExtended as any).mockReturnValue({
      select: () => ({
        or: () => ({
          order: () => Promise.resolve({
            data: [{
              id: 'a1',
              email_address: 'support@test.com',
              imap_host: 'imap.test.com',
              is_active: true,
              sync_enabled: true,
              is_shared: true,
              last_sync_at: new Date().toISOString(),
            }],
            error: null,
          }),
        }),
      }),
    });
    wrap(<EmailSyncHealth />);
    expect(await screen.findByText('support@test.com')).toBeInTheDocument();
    expect(screen.getByText('Partagé')).toBeInTheDocument();
    expect(screen.getByText('imap.test.com')).toBeInTheDocument();
  });
});
