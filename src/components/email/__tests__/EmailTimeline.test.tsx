import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailTimeline } from '../EmailTimeline';

vi.mock('@/hooks/email/useEmailTimeline', () => ({
  useEmailTimeline: () => ({
    data: {
      timeline: [],
      chartData: [],
      events: [],
      stats: { totalEvents: 17, totalSent: 5, totalReceived: 12, totalAttachments: 3, avgResponseTime: 120 },
      recentInteractions: [],
    },
    isLoading: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EmailTimeline', () => {
  it('renders events count', () => {
    render(
      <QueryClientProvider client={qc}>
        <EmailTimeline
          etablissementId="e1"
          etablissementNom="CHU Lyon"
          onThreadSelect={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('17 événements')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <QueryClientProvider client={qc}>
        <EmailTimeline
          etablissementId="e1"
          etablissementNom="CHU Lyon"
          onThreadSelect={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText('Timeline des conversations')).toBeInTheDocument();
  });
});
