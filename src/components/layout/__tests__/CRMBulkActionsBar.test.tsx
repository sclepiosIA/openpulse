import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CRMBulkActionsBar } from '../CRMBulkActionsBar';

describe('CRMBulkActionsBar', () => {
  const actions = [
    { id: 'delete', label: 'Supprimer', onClick: vi.fn(), variant: 'destructive' as const },
    { id: 'export', label: 'Exporter', onClick: vi.fn() },
  ];

  it('renders nothing when no selection', () => {
    const { container } = render(
      <CRMBulkActionsBar selectedCount={0} onClearSelection={vi.fn()} actions={actions} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders selection count', () => {
    render(<CRMBulkActionsBar selectedCount={3} onClearSelection={vi.fn()} actions={actions} />);
    expect(screen.getByText('3 sélectionnés')).toBeInTheDocument();
  });

  it('renders singular form for 1 item', () => {
    render(<CRMBulkActionsBar selectedCount={1} onClearSelection={vi.fn()} actions={actions} />);
    expect(screen.getByText('1 sélectionné')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<CRMBulkActionsBar selectedCount={2} onClearSelection={vi.fn()} actions={actions} />);
    expect(screen.getByText('Supprimer')).toBeInTheDocument();
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('calls action onClick', () => {
    const onClick = vi.fn();
    render(<CRMBulkActionsBar selectedCount={2} onClearSelection={vi.fn()} actions={[{ id: 'a', label: 'Act', onClick }]} />);
    fireEvent.click(screen.getByText('Act'));
    expect(onClick).toHaveBeenCalled();
  });
});
