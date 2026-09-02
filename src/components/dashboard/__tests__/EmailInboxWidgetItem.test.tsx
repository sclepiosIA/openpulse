import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailInboxWidgetItem } from '../EmailInboxWidgetItem';

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <div data-testid="avatar">{name}</div>,
}));

vi.mock('@/components/email/EmailThreadHoverCard', () => ({
  EmailThreadHoverCardContent: () => <div>HoverCard</div>,
}));

vi.mock('@/components/email/EmailContextMenu', () => ({
  EmailContextMenuItems: () => null,
}));

vi.mock('@/lib/emailUtils', () => ({
  getThreadMainSender: (thread: any) => ({ name: thread.from_name, email: thread.from_email }),
  sanitizeDisplayName: (name: string) => name,
}));

describe('EmailInboxWidgetItem', () => {
  const thread = {
    id: 't1',
    subject: 'Test Subject',
    ai_generated_title: 'AI Title',
    from_name: 'Jean Dupont',
    from_email: 'jean@test.com',
    is_read: false,
    unread_count: 3,
    has_attachments: true,
    last_message_at: '2026-03-09T10:00:00Z',
    category: 'Commercial',
    tags: [],
  };

  it('renders AI title over subject', () => {
    render(<EmailInboxWidgetItem thread={thread} onClick={vi.fn()} />);
    expect(screen.getByText('AI Title')).toBeInTheDocument();
  });

  it('renders sender name', () => {
    render(<EmailInboxWidgetItem thread={thread} onClick={vi.fn()} />);
    const matches = screen.getAllByText('Jean Dupont');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows category badge', () => {
    render(<EmailInboxWidgetItem thread={thread} onClick={vi.fn()} />);
    expect(screen.getByText('Commercial')).toBeInTheDocument();
  });

  it('renders subject when no AI title', () => {
    render(<EmailInboxWidgetItem thread={{ ...thread, ai_generated_title: null }} onClick={vi.fn()} />);
    expect(screen.getByText('Test Subject')).toBeInTheDocument();
  });

  it('shows "Sans objet" when no title', () => {
    render(<EmailInboxWidgetItem thread={{ ...thread, ai_generated_title: null, subject: null }} onClick={vi.fn()} />);
    expect(screen.getByText('Sans objet')).toBeInTheDocument();
  });
});
