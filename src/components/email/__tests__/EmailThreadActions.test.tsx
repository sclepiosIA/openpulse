import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailThreadActions } from '../EmailThreadActions';
import type { EmailThread } from '@/types/email';

const mockThread = {
  id: 't1',
  is_archived: false,
  is_spam: false,
} as EmailThread;

describe('EmailThreadActions', () => {
  const defaultProps = {
    thread: mockThread,
    onReply: vi.fn(),
    onReplyAll: vi.fn(),
    onArchive: vi.fn(),
    onMarkSpam: vi.fn(),
    onShowShortcuts: vi.fn(),
    isArchiving: false,
    isMarkingSpam: false,
  };

  it('renders reply button', () => {
    render(<EmailThreadActions {...defaultProps} />);
    const replyBtns = screen.getAllByText('Répondre');
    expect(replyBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('renders reply all button (desktop)', () => {
    render(<EmailThreadActions {...defaultProps} />);
    expect(screen.getByText('Répondre à tous')).toBeInTheDocument();
  });

  it('calls onReply when clicked', () => {
    render(<EmailThreadActions {...defaultProps} />);
    const replyBtns = screen.getAllByText('Répondre');
    fireEvent.click(replyBtns[0]);
    expect(defaultProps.onReply).toHaveBeenCalled();
  });

  it('calls onReplyAll when clicked', () => {
    render(<EmailThreadActions {...defaultProps} />);
    fireEvent.click(screen.getByText('Répondre à tous'));
    expect(defaultProps.onReplyAll).toHaveBeenCalled();
  });

  it('renders Plus dropdown button', () => {
    render(<EmailThreadActions {...defaultProps} />);
    expect(screen.getByText('Plus')).toBeInTheDocument();
  });
});
