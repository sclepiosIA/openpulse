import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttControlsCompact } from '../GanttControlsCompact';

describe('GanttControlsCompact', () => {
  const defaultProps = {
    zoomLevel: 'week' as const,
    onZoomChange: vi.fn(),
    groupBy: 'etablissement' as const,
    onGroupByChange: vi.fn(),
    sortField: 'date_debut' as const,
    onSortFieldChange: vi.fn(),
  };

  it('renders zoom, group and sort selectors', () => {
    const { container } = render(<GanttControlsCompact {...defaultProps} />);
    // Should render 3 select triggers
    const triggers = container.querySelectorAll('[role="combobox"]');
    expect(triggers.length).toBe(3);
  });

  it('displays current zoom value', () => {
    render(<GanttControlsCompact {...defaultProps} zoomLevel="month" />);
    expect(screen.getByText('Mois')).toBeInTheDocument();
  });

  it('displays current group value', () => {
    render(<GanttControlsCompact {...defaultProps} groupBy="categorie" />);
    expect(screen.getByText('Cat.')).toBeInTheDocument();
  });

  it('displays current sort value', () => {
    render(<GanttControlsCompact {...defaultProps} sortField="echeance" />);
    expect(screen.getByText('Échéance')).toBeInTheDocument();
  });
});
