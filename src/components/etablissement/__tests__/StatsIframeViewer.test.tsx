import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatsIframeViewer } from '../StatsIframeViewer';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('StatsIframeViewer', () => {
  it('renders empty state when no URL', () => {
    render(
      <QueryClientProvider client={qc}>
        <StatsIframeViewer url={null} title="Stats" />
      </QueryClientProvider>
    );
    expect(screen.getByText('URL non configurée')).toBeInTheDocument();
  });

  it('renders iframe when URL provided', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <StatsIframeViewer url="https://example.com/stats" title="Stats utilisation" />
      </QueryClientProvider>
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com/stats');
  });
});
