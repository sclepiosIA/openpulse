import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const chainable: any = new Proxy({}, {
  get: () => (..._args: any[]) => chainable,
});
chainable.maybeSingle = () => Promise.resolve({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => chainable },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}));

vi.mock('@/lib/analyseGeoUtils', () => ({
  formatDateFr: (d: string) => d,
}));

import { GeoQuickActions } from '../GeoQuickActions';
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etab = { id: 'e1', nom: 'CHU Test', notes: 'Note existante' };

describe('GeoQuickActions', () => {
  it('renders actions button', () => {
    render(
      <QueryClientProvider client={qc}>
        <GeoQuickActions etablissement={etab} />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
