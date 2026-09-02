import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/calendar/useCalendarDragDrop', () => ({
  useCalendarDragDrop: () => ({
    sensors: [],
    handleDragEnd: vi.fn(),
  }),
}));

import { CalendarWeekView } from '../CalendarWeekView';

describe('CalendarWeekView', () => {
  it('renders week navigation with Semaine du text', () => {
    render(
      <CalendarWeekView
        tasks={[]}
        currentWeek={new Date(2026, 2, 10)}
        onWeekChange={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );
    expect(screen.getByText(/Semaine du/)).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    const { container } = render(
      <CalendarWeekView
        tasks={[]}
        currentWeek={new Date(2026, 2, 10)}
        onWeekChange={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(2);
  });
});
