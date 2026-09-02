import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarTimelineView } from './CalendarTimelineView';

const {
  FIXED_NOW,
  CURRENT_DATE,
  OTHER_DATE,
  EVENTS,
  onDateChange,
  onEventClick,
  onCreateEvent,
} = vi.hoisted(() => {
  const FIXED_NOW = new Date(2024, 4, 10, 10, 15);
  const CURRENT_DATE = new Date(2024, 4, 10);
  const OTHER_DATE = new Date(2024, 4, 11);

  const EVENTS = [
    {
      id: 'evt-1',
      title: 'Réunion équipe',
      start_time: new Date(2024, 4, 10, 9).toISOString(),
      end_time: new Date(2024, 4, 10, 10).toISOString(),
      location: 'Salle A',
      color: '#ff0000',
      calendar: { color: '#00ff00' },
    },
    {
      id: 'evt-2',
      title: 'Appel client',
      start_time: new Date(2024, 4, 10, 9, 30).toISOString(),
      end_time: new Date(2024, 4, 10, 10, 30).toISOString(),
      location: '',
      color: '#0000ff',
      calendar: { color: '#00ffff' },
    },
    {
      id: 'evt-3',
      title: 'Hors jour',
      start_time: new Date(2024, 4, 11, 12).toISOString(),
      end_time: new Date(2024, 4, 11, 13).toISOString(),
      location: 'Ailleurs',
      color: '#999999',
      calendar: { color: '#999999' },
    },
  ];

  return {
    FIXED_NOW,
    CURRENT_DATE,
    OTHER_DATE,
    EVENTS,
    onDateChange: vi.fn(),
    onEventClick: vi.fn(),
    onCreateEvent: vi.fn(),
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
    ({ children, className }, ref) => (
      <div ref={ref} className={className} data-testid="scroll-area">
        {children}
      </div>
    )
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span aria-hidden="true">left</span>,
  ChevronRight: () => <span aria-hidden="true">right</span>,
}));

describe('CalendarTimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche la date, le badge du jour, les événements du jour et gère la navigation', () => {
    render(
      <CalendarTimelineView
        events={EVENTS}
        currentDate={CURRENT_DATE}
        onDateChange={onDateChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(screen.getByText("vendredi 10 mai 2024")).toBeInTheDocument();
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();

    expect(screen.getByText('Réunion équipe')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
    expect(screen.getByText('📍 Salle A')).toBeInTheDocument();

    expect(screen.getByText('Appel client')).toBeInTheDocument();
    expect(screen.getByText('09:30 - 10:30')).toBeInTheDocument();

    expect(screen.queryByText('Hors jour')).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onDateChange).toHaveBeenCalledWith(new Date(2024, 4, 9));

    fireEvent.click(buttons[1]);
    expect(onDateChange).toHaveBeenCalledWith(new Date(2024, 4, 11));
  });

  it('appelle onEventClick avec le bon événement', () => {
    render(
      <CalendarTimelineView
        events={EVENTS}
        currentDate={CURRENT_DATE}
        onDateChange={onDateChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );

    fireEvent.click(screen.getByText('Réunion équipe'));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(EVENTS[0]);
  });

  it('crée un événement par glisser-déposer sur un créneau vide', () => {
    const { container } = render(
      <CalendarTimelineView
        events={EVENTS}
        currentDate={CURRENT_DATE}
        onDateChange={onDateChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
        startHour={7}
        endHour={21}
      />
    );

    const timeline = container.querySelector('.relative.ml-16');
    expect(timeline).not.toBeNull();

    if (!timeline) {
      throw new Error('timeline not found');
    }

    Object.defineProperty(timeline, 'getBoundingClientRect', {
      value: () => ({
        top: 0,
        left: 0,
        right: 300,
        bottom: 600,
        width: 300,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      configurable: true,
    });

    Object.defineProperty(timeline, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    });

    fireEvent.mouseDown(timeline, { clientY: 120, target: timeline, currentTarget: timeline });
    expect(screen.getByText('09:00 -09:30')).toBeInTheDocument();

    fireEvent.mouseMove(timeline, { clientY: 180, target: timeline, currentTarget: timeline });
    expect(screen.getByText('09:00 -10:00')).toBeInTheDocument();

    fireEvent.mouseUp(timeline);

    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    const [start, end] = onCreateEvent.mock.calls[0] as [Date, Date];
    expect(start).toEqual(new Date(2024, 4, 10, 9));
    expect(end).toEqual(new Date(2024, 4, 10, 10));
  });

  it("n'affiche pas le badge aujourd'hui pour une autre date", () => {
    render(
      <CalendarTimelineView
        events={EVENTS}
        currentDate={OTHER_DATE}
        onDateChange={onDateChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(screen.getByText('samedi 11 mai 2024')).toBeInTheDocument();
    expect(screen.queryByText("Aujourd'hui")).not.toBeInTheDocument();
    expect(screen.getByText('Hors jour')).toBeInTheDocument();
    expect(screen.queryByText('Réunion équipe')).not.toBeInTheDocument();
  });
});
