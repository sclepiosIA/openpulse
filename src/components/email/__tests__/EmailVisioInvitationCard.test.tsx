import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock('@/hooks/bookings/useAcceptVisioToCalendar', () => ({
  useAcceptVisioToCalendar: () => ({
    accept: vi.fn(), isAccepting: false, accepted: false,
  }),
}));

vi.mock('@/hooks/email/useThreadImages', () => ({
  useMessageAttachments: () => ({ attachments: [], isLoading: false }),
}));

vi.mock('@/lib/calendarUtils', () => ({ downloadEventICS: vi.fn() }));
vi.mock('@/lib/icsParserClient', () => ({
  parseICSClient: vi.fn(() => null),
  extractMeetingLinkFromICS: vi.fn(() => null),
}));

import { EmailVisioInvitationCard } from '../EmailVisioInvitationCard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EmailVisioInvitationCard', () => {
  it('renders nothing when no visio link', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EmailVisioInvitationCard messageId="m1" bodyText="Hello" />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Google Meet card when link present', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EmailVisioInvitationCard
            messageId="m1"
            bodyHtml='<p>Join at https://meet.google.com/abc-defg-hij</p>'
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Google Meet')).toBeInTheDocument();
  });
});
