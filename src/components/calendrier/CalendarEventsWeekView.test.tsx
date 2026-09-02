// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarEventsWeekView } from './CalendarEventsWeekView';

const { FIXED_NOW, EVENTS, SHORT_EVENT } = vi.hoisted(() => ({
  FIXED_NOW: new Date(2024, 3, 10, 10, 15),
  EVENTS: [
    {
      id: 'e1',
      title: 'Réunion équipe',
      start_time: new Date(2024, 3, 8, 9).toISOString(),
      end_time: new Date(2024, 3, 8, 10).toISOString(),
      color: '#ff0000',
      calendar: { color: '#00ff00' },
    },
    {
      id: 'e2',
      title: 'Point client',
      start_time: new Date(2024, 3, 8, 9, 30).toISOString(),
      end_time: new Date(2024, 3, 8, 11).toISOString(),
      color: '#0000ff',
      calendar: { color: '#00ff00' },
    },
    {
      id: 'e3',
      title: 'Déjeuner',
      start_time: new Date(2024, 3, 9, 12).toISOString(),
      end_time: new Date(2024, 3, 9, 13).toISOString(),
      color: '',
      calendar: { color: '#22c55e' },
    },
  ],
  SHORT_EVENT: {
    id: 'e4',
    title: 'Court',
    start_time: new Date(2024, 3, 11, 8).toISOString(),
    end_time: new Date(2024, 3, 11, 8, 10).toISOString(),
    color: '',
    calendar: { color: '#123456' },
  },
}));

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
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => {
  const ReactModule = React;
  return {
    ScrollArea: ReactModule.forwardRef<
      HTMLDivElement,
      { children: React.ReactNode; className?: string }
    >(({ children, className }, ref) => (
      <div ref={ref} className={className} data-testid="scroll-area">
        {children}
      </div>
    )),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left">left</span>,
  ChevronRight: () => <span data-testid="chevron-right">right</span>,
}));

describe('CalendarEventsWeekView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders week title, day headers, events, and current time indicator for today', () => {
    const onWeekChange = vi.fn();
    const onEventClick = vi.fn();
    const onCreateEvent = vi.fn();

    const { container } = render(
      <CalendarEventsWeekView
        events={EVENTS}
        currentWeek={new Date(2024, 3, 10)}
        onWeekChange={onWeekChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
        startHour={7}
        endHour={21}
      />
    );

    expect(screen.getByText(/Semaine du/i)).toBeInTheDocument();
    expect(screen.getByText('Réunion équipe')).toBeInTheDocument();
    expect(screen.getByText('Point client')).toBeInTheDocument();
    expect(screen.getByText('Déjeuner')).toBeInTheDocument();
    expect(screen.getAllByText('09:00')[0]).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();

    const todayHeader = screen.getByText('10');
    expect(todayHeader.className).toContain('text-primary');

    const eventItems = container.querySelectorAll('.event-item');
    expect(eventItems).toHaveLength(3);

    const mondayEvents = Array.from(eventItems).filter(
      (el) =>
        (el as HTMLDivElement).textContent?.includes('Réunion équipe') ||
        (el as HTMLDivElement).textContent?.includes('Point client')
    ) as HTMLDivElement[];

    expect(mondayEvents).toHaveLength(2);
    expect(mondayEvents[0].style.top).toBe('96px');
    expect(mondayEvents[0].style.height).toBe('48px');
    expect(mondayEvents[0].style.left).toBe('0%');
    expect(mondayEvents[0].style.width).toBe('48%');

    expect(mondayEvents[1].style.top).toBe('120px');
    expect(mondayEvents[1].style.height).toBe('72px');
    expect(mondayEvents[1].style.left).toBe('50%');
    expect(mondayEvents[1].style.width).toBe('48%');

    const currentTimeLine = container.querySelector('.bg-destructive');
    expect(currentTimeLine).toBeTruthy();
  });

  it('navigates to previous and next week when buttons are clicked', () => {
    const onWeekChange = vi.fn();
    const onEventClick = vi.fn();
    const onCreateEvent = vi.fn();
    const currentWeek = new Date(2024, 3, 10);

    render(
      <CalendarEventsWeekView
        events={EVENTS}
        currentWeek={currentWeek}
        onWeekChange={onWeekChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(onWeekChange).toHaveBeenNthCalledWith(1, new Date(2024, 3, 3));
    expect(onWeekChange).toHaveBeenNthCalledWith(2, new Date(2024, 3, 17));
  });

  it('calls onEventClick with the selected event', () => {
    const onWeekChange = vi.fn();
    const onEventClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <CalendarEventsWeekView
        events={EVENTS}
        currentWeek={new Date(2024, 3, 10)}
        onWeekChange={onWeekChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );

    fireEvent.click(screen.getByText('Réunion équipe'));
    expect(onEventClick).toHaveBeenCalledWith(EVENTS[0]);
  });

  it('creates an event by dragging in an empty day column', () => {
    const onWeekChange = vi.fn();
    const onEventClick = vi.fn();
    const onCreateEvent = vi.fn();

    const { container } = render(
      <CalendarEventsWeekView
        events={EVENTS}
        currentWeek={new Date(2024, 3, 10)}
        onWeekChange={onWeekChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
        startHour={7}
        endHour={21}
      />
    );

    const scrollArea = screen.getByTestId('scroll-area');
    Object.defineProperty(scrollArea, 'getBoundingClientRect', {
      value: () => ({
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      configurable: true,
    });
    Object.defineProperty(scrollArea, 'scrollTop', {
      value: 0,
      configurable: true,
    });

    const dayColumns = container.querySelectorAll('.grid.grid-cols-8 > .relative.border-l');
    const wednesdayColumn = dayColumns[2] as HTMLDivElement;

    fireEvent.mouseDown(wednesdayColumn, { clientY: 96 });
    fireEvent.mouseMove(wednesdayColumn.parentElement as Element, { clientY: 192 });
    fireEvent.mouseUp(wednesdayColumn.parentElement as Element);

    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    const [start, end] = onCreateEvent.mock.calls[0] as [Date, Date];
    expect(start).toEqual(new Date(2024, 3, 10, 9));
    expect(end).toEqual(new Date(2024, 3, 10, 11));
  });

  it('does not start drag-create when clicking on an existing event', () => {
    const onWeekChange = vi.fn();
    const onEventClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <CalendarEventsWeekView
        events={EVENTS}
        currentWeek={new Date(2024, 3, 10)}
        onWeekChange={onWeekChange}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />
    );

    const eventTitle = screen.getByText('Réunion équipe');
    fireEvent.mouseDown(eventTitle, { clientY: 100 });
    fireEvent.mouseUp(screen.getByTestId('scroll-area'));

    expect(onCreateEvent).not.toHaveBeenCalled();
  });

  it('applies minimum event height and fallback calendar color', () => {
    const { container } = render(
      <CalendarEventsWeekView
        events={[SHORT_EVENT]}
        currentWeek={new Date(2024, 3, 10)}
        onWeekChange={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />
    );

    const eventItem = container.querySelector('.event-item') as HTMLDivElement;
    expect(eventItem.style.height).toBe('16px');
    expect(eventItem.style.borderLeft).toContain('rgb(18, 52, 86)');
    expect(eventItem.style.backgroundColor).toMatch(/^rgba?\(18,\s*52,\s*86,\s*0\.(188|19)\)$/);
  });
});
