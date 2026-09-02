import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaQuickActions } from '../AgendaQuickActions';

describe('AgendaQuickActions', () => {
  const defaultProps = {
    taskId: 't1',
    isCompleted: false,
    onMarkDone: vi.fn(),
    onPostpone: vi.fn(),
    onArchive: vi.fn(),
  };

  it('renders 3 buttons when not completed', () => {
    const { container } = render(<AgendaQuickActions {...defaultProps} />);
    expect(container.querySelectorAll('button').length).toBe(3);
  });

  it('renders only mark done button when completed', () => {
    const { container } = render(<AgendaQuickActions {...defaultProps} isCompleted />);
    expect(container.querySelectorAll('button').length).toBe(1);
  });

  it('calls onMarkDone with taskId', () => {
    const onMarkDone = vi.fn();
    render(<AgendaQuickActions {...defaultProps} onMarkDone={onMarkDone} />);
    fireEvent.click(screen.getByTitle('Marquer comme terminé'));
    expect(onMarkDone).toHaveBeenCalledWith('t1');
  });

  it('calls onPostpone with taskId', () => {
    const onPostpone = vi.fn();
    render(<AgendaQuickActions {...defaultProps} onPostpone={onPostpone} />);
    fireEvent.click(screen.getByTitle('Reporter à demain'));
    expect(onPostpone).toHaveBeenCalledWith('t1');
  });

  it('calls onArchive with taskId', () => {
    const onArchive = vi.fn();
    render(<AgendaQuickActions {...defaultProps} onArchive={onArchive} />);
    fireEvent.click(screen.getByTitle('Archiver'));
    expect(onArchive).toHaveBeenCalledWith('t1');
  });

  it('shows different title when completed', () => {
    render(<AgendaQuickActions {...defaultProps} isCompleted />);
    expect(screen.getByTitle('Marquer comme non terminé')).toBeInTheDocument();
  });
});
