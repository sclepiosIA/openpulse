import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarMiniNav } from '../CalendarMiniNav';

describe('CalendarMiniNav', () => {
  const baseDate = new Date(2026, 2, 9); // 9 mars 2026

  it('renders today button', () => {
    render(<CalendarMiniNav currentDate={baseDate} onDateChange={vi.fn()} view="timeline" />);
    expect(screen.getByText('Auj.')).toBeInTheDocument();
  });

  it('renders previous/next nav buttons', () => {
    render(<CalendarMiniNav currentDate={baseDate} onDateChange={vi.fn()} view="timeline" />);
    expect(screen.getByTitle(/précédente/)).toBeInTheDocument();
    expect(screen.getByTitle(/suivante/)).toBeInTheDocument();
  });

  it('shows month label for month view', () => {
    render(<CalendarMiniNav currentDate={baseDate} onDateChange={vi.fn()} view="month" />);
    expect(screen.getByText(/Mars 2026/)).toBeInTheDocument();
  });

  it('shows week label for timeline view', () => {
    render(<CalendarMiniNav currentDate={baseDate} onDateChange={vi.fn()} view="timeline" />);
    expect(screen.getByText(/Semaine du/)).toBeInTheDocument();
  });

  it('calls onDateChange with previous week on prev click', () => {
    const onChange = vi.fn();
    render(<CalendarMiniNav currentDate={baseDate} onDateChange={onChange} view="timeline" />);
    fireEvent.click(screen.getByTitle(/précédente/));
    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0] as Date;
    expect(newDate.getDate()).toBe(2); // 9 - 7
  });

  it('calls onDateChange with next month on next click (month view)', () => {
    const onChange = vi.fn();
    render(<CalendarMiniNav currentDate={baseDate} onDateChange={onChange} view="month" />);
    fireEvent.click(screen.getByTitle(/suivant/));
    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0] as Date;
    expect(newDate.getMonth()).toBe(3); // avril
  });

  it('navigates to today on Auj. click', () => {
    const onChange = vi.fn();
    const pastDate = new Date(2025, 0, 1);
    render(<CalendarMiniNav currentDate={pastDate} onDateChange={onChange} view="timeline" />);
    fireEvent.click(screen.getByText('Auj.'));
    expect(onChange).toHaveBeenCalled();
  });
});
