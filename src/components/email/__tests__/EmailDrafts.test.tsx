import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EmailDrafts } from '../EmailDrafts';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

vi.mock('@/hooks/shared/useErrorHandler', () => ({
  useErrorHandler: () => ({ handleError: vi.fn() }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EmailDrafts', () => {
  it('renders component', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <EmailDrafts onDraftSelect={vi.fn()} />
        </TooltipProvider>
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders empty state when no drafts', async () => {
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <EmailDrafts onDraftSelect={vi.fn()} />
        </TooltipProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Aucun brouillon/i)).toBeInTheDocument();
  });
});
