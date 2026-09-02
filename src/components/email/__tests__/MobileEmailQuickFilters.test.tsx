import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileEmailQuickFilters } from '../MobileEmailQuickFilters';

describe('MobileEmailQuickFilters', () => {
  const defaultProps = {
    unreadOnly: false,
    onUnreadOnlyChange: vi.fn(),
    unprocessedOnly: false,
    onUnprocessedOnlyChange: vi.fn(),
    category: null,
    onCategoryChange: vi.fn(),
    mailbox: 'inbox' as const,
    onMailboxChange: vi.fn(),
    unreadCount: 5,
    unprocessedCount: 3,
    totalCount: 20,
    onOpenFilters: vi.fn(),
    hasActiveFilters: false,
  };

  it('renders inbox and sent buttons', () => {
    render(<MobileEmailQuickFilters {...defaultProps} />);
    expect(screen.getByText('Réception')).toBeInTheDocument();
    expect(screen.getByText('Envoyés')).toBeInTheDocument();
  });

  it('renders unread filter chip', () => {
    render(<MobileEmailQuickFilters {...defaultProps} />);
    expect(screen.getByText(/Non lus/)).toBeInTheDocument();
  });

  it('calls onMailboxChange when clicking sent', () => {
    render(<MobileEmailQuickFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Envoyés'));
    expect(defaultProps.onMailboxChange).toHaveBeenCalledWith('sent');
  });

  it('calls onUnreadOnlyChange when clicking unread chip', () => {
    render(<MobileEmailQuickFilters {...defaultProps} />);
    fireEvent.click(screen.getByText(/Non lus/));
    expect(defaultProps.onUnreadOnlyChange).toHaveBeenCalledWith(true);
  });

  it('shows active state for inbox', () => {
    const { container } = render(<MobileEmailQuickFilters {...defaultProps} />);
    const inboxBtn = screen.getByText('Réception').closest('button');
    expect(inboxBtn?.className).toContain('bg-primary');
  });
});
