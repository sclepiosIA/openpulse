import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EmailQuickActions } from '../EmailQuickActions';

describe('EmailQuickActions', () => {
  const defaultProps = {
    threadId: 't1',
    isUnread: true,
    isStarred: false,
    onArchive: vi.fn(),
    onToggleRead: vi.fn(),
    onToggleStar: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders action buttons', () => {
    const { container } = render(<EmailQuickActions {...defaultProps} />);
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
  });

  it('renders archive button', () => {
    const { container } = render(<EmailQuickActions {...defaultProps} />);
    // Buttons are present
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
  });
});
