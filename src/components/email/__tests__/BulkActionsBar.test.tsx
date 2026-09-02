import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBar } from '../BulkActionsBar';

describe('BulkActionsBar', () => {
  const defaultProps = {
    selectedCount: 3,
    onMarkAsRead: vi.fn(),
    onMarkAsProcessed: vi.fn(),
    onArchive: vi.fn(),
    onMarkAsSpam: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  };

  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(<BulkActionsBar {...defaultProps} selectedCount={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders selected count text', () => {
    render(<BulkActionsBar {...defaultProps} />);
    expect(screen.getByText(/3 sélectionné/)).toBeInTheDocument();
  });

  it('renders singular text for 1 item', () => {
    render(<BulkActionsBar {...defaultProps} selectedCount={1} />);
    expect(screen.getByText(/1 sélectionné/)).toBeInTheDocument();
  });

  it('calls onArchive when archive button clicked', () => {
    const onArchive = vi.fn();
    render(<BulkActionsBar {...defaultProps} onArchive={onArchive} />);
    // Find button with "Archiver" text
    fireEvent.click(screen.getByText('Archiver'));
    expect(onArchive).toHaveBeenCalled();
  });

  it('renders action buttons', () => {
    render(<BulkActionsBar {...defaultProps} />);
    expect(screen.getByText('Lu')).toBeInTheDocument();
    expect(screen.getByText('Archiver')).toBeInTheDocument();
    expect(screen.getByText('Spam')).toBeInTheDocument();
  });
});
