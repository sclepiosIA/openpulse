import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaQuickFilters } from '../AgendaQuickFilters';

const defaultProps = {
  overdueCount: 3,
  highPriorityCount: 5,
  myTasksCount: 12,
  showOnlyOverdue: false,
  showOnlyHighPriority: false,
  showOnlyMyTasks: false,
  onToggleOverdue: vi.fn(),
  onToggleHighPriority: vi.fn(),
  onToggleMyTasks: vi.fn(),
  onResetFilters: vi.fn(),
};

describe('AgendaQuickFilters', () => {
  it('renders all 3 filter buttons', () => {
    render(<AgendaQuickFilters {...defaultProps} />);
    expect(screen.getByText('En retard')).toBeInTheDocument();
    expect(screen.getByText('Priorité haute')).toBeInTheDocument();
    expect(screen.getByText('Mes tâches')).toBeInTheDocument();
  });

  it('shows badge counts', () => {
    render(<AgendaQuickFilters {...defaultProps} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('hides badge when count is 0', () => {
    render(<AgendaQuickFilters {...defaultProps} overdueCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('calls onToggleOverdue when clicked', () => {
    const onToggle = vi.fn();
    render(<AgendaQuickFilters {...defaultProps} onToggleOverdue={onToggle} />);
    fireEvent.click(screen.getByText('En retard'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('calls onToggleHighPriority when clicked', () => {
    const onToggle = vi.fn();
    render(<AgendaQuickFilters {...defaultProps} onToggleHighPriority={onToggle} />);
    fireEvent.click(screen.getByText('Priorité haute'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows reset button when filters active', () => {
    render(<AgendaQuickFilters {...defaultProps} showOnlyOverdue={true} />);
    expect(screen.getByText('Réinitialiser')).toBeInTheDocument();
  });

  it('hides reset button when no filters active', () => {
    render(<AgendaQuickFilters {...defaultProps} />);
    expect(screen.queryByText('Réinitialiser')).toBeNull();
  });

  it('calls onResetFilters when reset clicked', () => {
    const onReset = vi.fn();
    render(<AgendaQuickFilters {...defaultProps} showOnlyMyTasks={true} onResetFilters={onReset} />);
    fireEvent.click(screen.getByText('Réinitialiser'));
    expect(onReset).toHaveBeenCalled();
  });
});
