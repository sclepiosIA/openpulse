import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingCalendar } from '../BookingCalendar';

describe('BookingCalendar', () => {
  it('renders calendar', () => {
    const { container } = render(<BookingCalendar onSelect={vi.fn()} />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('renders day headers', () => {
    render(<BookingCalendar onSelect={vi.fn()} />);
    // French locale day abbreviations
    expect(screen.getByText('lu')).toBeInTheDocument();
    expect(screen.getByText('ma')).toBeInTheDocument();
  });

  it('renders with selected date', () => {
    const date = new Date(2026, 5, 15); // June 15, 2026
    const { container } = render(<BookingCalendar selected={date} onSelect={vi.fn()} />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<BookingCalendar onSelect={vi.fn()} className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });
});
