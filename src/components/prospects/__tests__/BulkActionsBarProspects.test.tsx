import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBarProspects } from '../BulkActionsBarProspects';

describe('BulkActionsBarProspects', () => {
  it('renders nothing when no selection', () => {
    const { container } = render(
      <BulkActionsBarProspects selectedCount={0} onClearSelection={vi.fn()} onExport={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders selection count', () => {
    render(
      <BulkActionsBarProspects selectedCount={3} onClearSelection={vi.fn()} onExport={vi.fn()} />
    );
    expect(screen.getByText('3 sélectionnés')).toBeInTheDocument();
  });

  it('renders singular form for 1 selected', () => {
    render(
      <BulkActionsBarProspects selectedCount={1} onClearSelection={vi.fn()} onExport={vi.fn()} />
    );
    expect(screen.getByText('1 sélectionné')).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(
      <BulkActionsBarProspects selectedCount={2} onClearSelection={vi.fn()} onExport={vi.fn()} />
    );
    expect(screen.getByText('Exporter')).toBeInTheDocument();
  });

  it('calls onExport when clicked', () => {
    const onExport = vi.fn();
    render(
      <BulkActionsBarProspects selectedCount={2} onClearSelection={vi.fn()} onExport={onExport} />
    );
    fireEvent.click(screen.getByText('Exporter'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('renders delete button when handler provided', () => {
    render(
      <BulkActionsBarProspects selectedCount={2} onClearSelection={vi.fn()} onExport={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('Supprimer')).toBeInTheDocument();
  });

  it('calls onClearSelection when close clicked', () => {
    const onClear = vi.fn();
    render(
      <BulkActionsBarProspects selectedCount={2} onClearSelection={onClear} onExport={vi.fn()} />
    );
    // The close button with X icon
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find(b => !b.textContent?.includes('Exporter'));
    closeBtn?.click();
    expect(onClear).toHaveBeenCalledOnce();
  });
});
