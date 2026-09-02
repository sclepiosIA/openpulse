import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBar } from '../BulkActionsBar';

describe('BulkActionsBar', () => {
  const handlers = {
    onClearSelection: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onChangeStatut: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(<BulkActionsBar selectedCount={0} {...handlers} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders selection count badge', () => {
    render(<BulkActionsBar selectedCount={3} {...handlers} />);
    expect(screen.getByText('3 sélectionnés')).toBeInTheDocument();
  });

  it('renders singular text for 1 selected', () => {
    render(<BulkActionsBar selectedCount={1} {...handlers} />);
    expect(screen.getByText('1 sélectionné')).toBeInTheDocument();
  });

  it('calls onExport when export clicked', () => {
    render(<BulkActionsBar selectedCount={2} {...handlers} />);
    fireEvent.click(screen.getByText('Exporter'));
    expect(handlers.onExport).toHaveBeenCalled();
  });

  it('calls onDelete when delete clicked', () => {
    render(<BulkActionsBar selectedCount={2} {...handlers} />);
    fireEvent.click(screen.getByText('Supprimer'));
    expect(handlers.onDelete).toHaveBeenCalled();
  });

  it('calls onClearSelection when close clicked', () => {
    render(<BulkActionsBar selectedCount={2} {...handlers} />);
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons[buttons.length - 1];
    fireEvent.click(closeBtn);
    expect(handlers.onClearSelection).toHaveBeenCalled();
  });
});
