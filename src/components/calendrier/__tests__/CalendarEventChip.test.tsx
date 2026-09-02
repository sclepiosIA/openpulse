import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarEventChip } from '@/components/calendrier/CalendarEventChip';

describe('CalendarEventChip', () => {
  it('should render title', () => {
    render(<CalendarEventChip title="Réunion" color="#3b82f6" />);
    expect(screen.getByText('Réunion')).toBeInTheDocument();
  });

  it('should render time when not all day', () => {
    render(<CalendarEventChip title="RDV" color="#3b82f6" startTime="2026-03-09T14:30:00" />);
    expect(screen.getByText('14:30')).toBeInTheDocument();
    expect(screen.getByText('RDV')).toBeInTheDocument();
  });

  it('should not render time for all day events', () => {
    render(<CalendarEventChip title="Vacances" color="#10b981" startTime="2026-03-09T00:00:00" isAllDay />);
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
    expect(screen.getByText('Vacances')).toBeInTheDocument();
  });

  it('should call onClick', () => {
    const onClick = vi.fn();
    render(<CalendarEventChip title="Click" color="#f00" onClick={onClick} />);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should apply color as background', () => {
    render(<CalendarEventChip title="Test" color="#ff0000" />);
    const button = screen.getByText('Test').closest('button');
    expect(button).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('should render compact variant', () => {
    const { container } = render(<CalendarEventChip title="Compact" color="#000" compact />);
    expect(container.querySelector('.text-\\[10px\\]')).toBeInTheDocument();
  });

  it('should render multi-day start styling', () => {
    const { container } = render(
      <CalendarEventChip title="Multi" color="#000" isMultiDay isStart isEnd={false} />
    );
    expect(container.querySelector('.rounded-l-md')).toBeInTheDocument();
  });
});
