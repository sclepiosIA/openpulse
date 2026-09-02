import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AgendaWeekView } from '../AgendaWeekView';
import type { UpcomingAppointment } from '@/hooks/bookings/useUpcomingAppointments';
import { startOfWeek, addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const monday = startOfWeek(new Date(), { weekStartsOn: 1 });

const makeAppointment = (dayOffset: number): UpcomingAppointment => {
  const d = addDays(monday, dayOffset);
  return {
    id: `apt-${dayOffset}`,
    title: `RDV ${dayOffset}`,
    start_time: d.toISOString(),
    end_time: d.toISOString(),
    type: 'rdv',
    etablissement_nom: 'CHU Test',
    formattedDate: format(d, 'PPP', { locale: fr }),
  };
};

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe('AgendaWeekView', () => {
  it('renders 7 days of the week', () => {
    const { container } = wrap(<AgendaWeekView appointments={[]} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(7);
  });

  it('renders day names in French', () => {
    wrap(<AgendaWeekView appointments={[]} />);
    expect(screen.getByText('lun.')).toBeInTheDocument();
  });

  it('renders event dots for appointments', () => {
    const appointments = [makeAppointment(0), makeAppointment(0)];
    const { container } = wrap(<AgendaWeekView appointments={appointments} />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('calls onDayClick when clicking a day', () => {
    const onDayClick = vi.fn();
    const { container } = wrap(<AgendaWeekView appointments={[]} onDayClick={onDayClick} />);
    fireEvent.click(container.querySelectorAll('button')[0]);
    expect(onDayClick).toHaveBeenCalled();
  });
});
