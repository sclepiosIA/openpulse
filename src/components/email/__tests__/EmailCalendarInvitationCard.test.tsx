import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailCalendarInvitationCard } from '../EmailCalendarInvitationCard';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: null }),
      }),
    },
  },
}));

vi.mock('@/hooks/email/useThreadImages', () => ({
  useMessageAttachments: () => ({
    attachments: [],
    resolveCid: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/bookings/useAcceptVisioToCalendar', () => ({
  useAcceptVisioToCalendar: () => ({
    acceptToCalendar: vi.fn(),
    isAccepting: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EmailCalendarInvitationCard', () => {
  it('renders nothing for non-invitation emails', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EmailCalendarInvitationCard
          messageId="m1"
          subject="Simple email"
          bodyHtml="<p>Hello</p>"
        />
      </QueryClientProvider>
    );
    expect(container.innerHTML).not.toContain('calendar');
  });

  it('renders card for calendar invitation subjects', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EmailCalendarInvitationCard
          messageId="m1"
          subject="Invitation: Réunion équipe"
          bodyHtml="<p>calendar.google.com link</p>"
        />
      </QueryClientProvider>
    );
    // Should render something (non-null container)
    expect(container.firstChild).not.toBeNull();
  });

  it('detects VCALENDAR content', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EmailCalendarInvitationCard
          messageId="m2"
          subject="Meeting"
          bodyText="BEGIN:VCALENDAR VERSION:2.0 END:VCALENDAR"
        />
      </QueryClientProvider>
    );
    expect(container.firstChild).not.toBeNull();
  });
});
