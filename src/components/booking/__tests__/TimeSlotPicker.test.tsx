import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeSlotPicker } from '../TimeSlotPicker';

describe('TimeSlotPicker', () => {
  const morningSlot = { start: '2026-03-10T09:00:00', end: '2026-03-10T09:30:00' };
  const afternoonSlot = { start: '2026-03-10T14:00:00', end: '2026-03-10T14:30:00' };
  const eveningSlot = { start: '2026-03-10T19:00:00', end: '2026-03-10T19:30:00' };

  it('shows loading state', () => {
    render(<TimeSlotPicker slots={[]} selectedSlot={null} onSelectSlot={vi.fn()} isLoading />);
    expect(screen.getByText('Chargement des créneaux...')).toBeInTheDocument();
  });

  it('shows empty state when no slots', () => {
    render(<TimeSlotPicker slots={[]} selectedSlot={null} onSelectSlot={vi.fn()} />);
    expect(screen.getByText('Aucun créneau disponible')).toBeInTheDocument();
  });

  it('groups slots by period', () => {
    render(<TimeSlotPicker slots={[morningSlot, afternoonSlot, eveningSlot]} selectedSlot={null} onSelectSlot={vi.fn()} />);
    expect(screen.getByText('Matin')).toBeInTheDocument();
    expect(screen.getByText('Après-midi')).toBeInTheDocument();
    expect(screen.getByText('Soir')).toBeInTheDocument();
  });

  it('calls onSelectSlot when slot clicked', () => {
    const onSelect = vi.fn();
    render(<TimeSlotPicker slots={[morningSlot]} selectedSlot={null} onSelectSlot={onSelect} />);
    fireEvent.click(screen.getByText('09:00'));
    expect(onSelect).toHaveBeenCalledWith(morningSlot);
  });

  it('shows date and duration when provided', () => {
    render(
      <TimeSlotPicker
        slots={[morningSlot]}
        selectedSlot={null}
        onSelectSlot={vi.fn()}
        date={new Date('2026-03-10')}
        duration={30}
      />
    );
    expect(screen.getByText(/mars/)).toBeInTheDocument();
    expect(screen.getByText('Durée : 30 minutes')).toBeInTheDocument();
  });

  it('shows slot count per period', () => {
    render(<TimeSlotPicker slots={[morningSlot, afternoonSlot]} selectedSlot={null} onSelectSlot={vi.fn()} />);
    const counts = screen.getAllByText('(1 créneaux)');
    expect(counts.length).toBe(2);
  });
});
