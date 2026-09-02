import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarMonthView } from '../CalendarMonthView';

describe('CalendarMonthView', () => {
  it('renders month name', () => {
    render(
      <CalendarMonthView
        tasks={[]}
        currentMonth={new Date(2026, 2, 1)}
        onMonthChange={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );
    expect(screen.getByText('mars 2026')).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    const { container } = render(
      <CalendarMonthView
        tasks={[]}
        currentMonth={new Date(2026, 2, 1)}
        onMonthChange={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(2);
  });

  it('renders heatmap toggle', () => {
    render(
      <CalendarMonthView
        tasks={[]}
        currentMonth={new Date(2026, 2, 1)}
        onMonthChange={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );
    expect(screen.getByText('Carte de charge')).toBeInTheDocument();
  });
});
