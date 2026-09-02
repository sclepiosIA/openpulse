import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportDeckDialog } from '../ImportDeckDialog';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'p1' }, error: null }) }) }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('ImportDeckDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <ImportDeckDialog open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.queryByText(/Importer/)).not.toBeInTheDocument();
  });

  it('renders dialog when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <ImportDeckDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Importer depuis Nextcloud Deck/)).toBeInTheDocument();
  });

  it('renders file upload area', () => {
    render(
      <QueryClientProvider client={qc}>
        <ImportDeckDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Fichier JSON Deck')).toBeInTheDocument();
  });
});
