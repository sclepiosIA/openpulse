import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailContextMenu } from '../EmailContextMenu';

describe('EmailContextMenu', () => {
  it('renders children', () => {
    render(
      <EmailContextMenu
        threadId="t1"
        isUnread={false}
        isStarred={false}
        isProcessed={false}
        currentTags={[]}
        onToggleRead={vi.fn()}
        onToggleStar={vi.fn()}
        onToggleProcessed={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        onMarkAsSpam={vi.fn()}
        onUpdateTags={vi.fn()}
      >
        <span>Email item</span>
      </EmailContextMenu>
    );
    expect(screen.getByText('Email item')).toBeInTheDocument();
  });
});
