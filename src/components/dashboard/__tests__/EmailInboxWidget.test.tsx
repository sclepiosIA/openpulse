import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmailInboxWidget } from '../EmailInboxWidget';

vi.mock('@/hooks/email/useEmailThreads', () => ({
  useEmailThreads: () => ({
    threads: [],
    isLoading: false,
    invalidateThreads: vi.fn(),
  }),
}));

vi.mock('@/hooks/email/useEmailThreadActions', () => ({
  useEmailThreadActions: () => ({
    archiveThread: vi.fn(),
    markAsRead: vi.fn(),
    toggleStar: vi.fn(),
    markAsProcessed: vi.fn(),
    deleteThread: vi.fn(),
    markAsSpam: vi.fn(),
    updateTags: vi.fn(),
  }),
}));

vi.mock('@/hooks/email/useThreadsEnrichedData', () => ({
  useThreadsEnrichedData: () => ({ data: new Map() }),
}));

vi.mock('@/contexts/RealtimeEmailContext', () => ({
  useRealtimeEmailCompat: (cb: any) => ({ invalidateThreads: vi.fn() }),
}));

describe('EmailInboxWidget', () => {
  const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

  it('renders inbox title', () => {
    wrap(<EmailInboxWidget />);
    expect(screen.getByText('Boîte de réception')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    wrap(<EmailInboxWidget />);
    expect(screen.getByText('Aucun email récent')).toBeInTheDocument();
  });
});
