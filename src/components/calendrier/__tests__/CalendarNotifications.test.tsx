import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarNotifications } from '../CalendarNotifications';

vi.mock('@/hooks/calendar/useCalendarNotifications', () => ({
  useCalendarNotifications: (tasks: any[]) => {
    if (tasks.length === 0) return [];
    return [
      { id: 'n1', taskId: 't1', type: 'overdue', title: 'Tâche en retard', message: 'Retard de 2 jours' },
    ];
  },
}));

describe('CalendarNotifications', () => {
  it('renders bell button', () => {
    render(<CalendarNotifications tasks={[]} onTaskClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows badge when notifications exist', () => {
    const tasks = [{ id: 't1', name: 'Task', status: 'in_progress' }] as any[];
    render(<CalendarNotifications tasks={tasks} onTaskClick={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<CalendarNotifications tasks={[]} onTaskClick={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
  });
});
