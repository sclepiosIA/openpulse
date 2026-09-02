import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarMobileDayView } from '../CalendarMobileDayView';

vi.mock('@/hooks/calendar/useCalendarEvents', () => ({
  useCalendarEvents: () => ({ events: [], isLoading: false }),
}));

vi.mock('@/hooks/useAbsences', () => ({
  useAbsences: () => ({ data: [] }),
}));

const tasks = [
  {
    id: 't1',
    titre: 'Appel client',
    echeance: '2026-03-09T10:00:00',
    statut: 'En cours',
    priorite: 'Haute',
    created_at: '2026-03-01',
    updated_at: '2026-03-01',
  },
  {
    id: 't2',
    titre: 'Rédiger rapport',
    echeance: '2026-03-09T14:00:00',
    statut: 'A faire',
    priorite: 'Moyenne',
    created_at: '2026-03-01',
    updated_at: '2026-03-01',
  },
] as any[];

describe('CalendarMobileDayView', () => {
  it('renders date header', () => {
    render(
      <CalendarMobileDayView
        tasks={tasks}
        selectedDate={new Date(2026, 2, 9)}
        onTaskClick={vi.fn()}
        onDateChange={vi.fn()}
      />
    );
    expect(screen.getByText('9 mars')).toBeInTheDocument();
  });

  it('renders task titles', () => {
    render(
      <CalendarMobileDayView
        tasks={tasks}
        selectedDate={new Date(2026, 2, 9)}
        onTaskClick={vi.fn()}
        onDateChange={vi.fn()}
      />
    );
    expect(screen.getByText('Appel client')).toBeInTheDocument();
    expect(screen.getByText('Rédiger rapport')).toBeInTheDocument();
  });

  it('shows task count badge', () => {
    render(
      <CalendarMobileDayView
        tasks={tasks}
        selectedDate={new Date(2026, 2, 9)}
        onTaskClick={vi.fn()}
        onDateChange={vi.fn()}
      />
    );
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/tâches/)).toBeInTheDocument();
  });

  it('renders with empty tasks', () => {
    render(
      <CalendarMobileDayView
        tasks={[]}
        selectedDate={new Date(2026, 2, 9)}
        onTaskClick={vi.fn()}
        onDateChange={vi.fn()}
      />
    );
    expect(screen.getByText('9 mars')).toBeInTheDocument();
  });
});
