// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarEventsMonthView } from './CalendarEventsMonthView';

const { CURRENT_MONTH, MOCK_EVENTS } = vi.hoisted(() => ({
  CURRENT_MONTH: new Date('2024-05-15T12:00:00.000Z'),
  MOCK_EVENTS: [
    {
      id: 'evt-1',
      title: 'Standup',
      start_time: '2024-05-10T09:00:00.000Z',
      end_time: '2024-05-10T09:30:00.000Z',
      all_day: false,
      color: '#ff0000',
      location: 'Paris',
      video_conference_url: 'https://meet.local/r1',
      calendar: { name: 'Travail', color: '#00aa00' },
    },
    {
      id: 'evt-2',
      title: 'Déjeuner',
      start_time: '2024-05-10T12:00:00.000Z',
      end_time: '2024-05-10T13:00:00.000Z',
      all_day: false,
      color: '#0000ff',
      calendar: { name: 'Perso', color: '#0000ff' },
    },
    {
      id: 'evt-3',
      title: 'Atelier',
      start_time: '2024-05-10T15:00:00.000Z',
      end_time: '2024-05-10T16:00:00.000Z',
      all_day: false,
      calendar: { name: 'Travail', color: '#00aa00' },
    },
    {
      id: 'evt-4',
      title: 'Rétro',
      start_time: '2024-05-10T17:00:00.000Z',
      end_time: '2024-05-10T18:00:00.000Z',
      all_day: false,
      calendar: { name: 'Travail', color: '#00aa00' },
    },
    {
      id: 'evt-5',
      title: 'Jour férié',
      start_time: '2024-05-20T00:00:00.000Z',
      end_time: '2024-05-20T23:59:00.000Z',
      all_day: true,
      calendar: { name: 'National', color: '#ffaa00' },
    },
  ],
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
    onClick,
    style,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    style?: React.CSSProperties;
  }) => (
    <div data-testid="card" className={className} onClick={onClick} style={style}>
      {children}
    </div>
  ),
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
    className,
    type = 'button',
    ...props
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type} onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
    id?: string;
  }) => (
    <button
      data-testid={id}
      aria-pressed={checked ? 'true' : 'false'}
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <span className={className} style={style}>
      {children}
    </span>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span>left</span>,
  ChevronRight: () => <span>right</span>,
  Plus: () => <span>plus</span>,
  Clock: () => <span>clock</span>,
  Video: () => <span>video</span>,
}));

vi.mock('./ClickableLocation', () => ({
  ClickableLocation: ({
    location,
    className,
  }: {
    location: string;
    iconClassName?: string;
    className?: string;
  }) => <span className={className}>{location}</span>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderComponent(props?: Partial<React.ComponentProps<typeof CalendarEventsMonthView>>) {
  const onMonthChange = vi.fn();
  const onEventClick = vi.fn();
  const onCreateEvent = vi.fn();

  render(
    <CalendarEventsMonthView
      events={MOCK_EVENTS}
      currentMonth={CURRENT_MONTH}
      onMonthChange={onMonthChange}
      onEventClick={onEventClick}
      onCreateEvent={onCreateEvent}
      {...props}
    />,
    { wrapper: createWrapper() }
  );

  return { onMonthChange, onEventClick, onCreateEvent };
}

function getCalendarDayButton(dayNumber: number) {
  const dayCell = screen.getAllByText(String(dayNumber)).find((node) => node.tagName.toLowerCase() === 'div');
  if (!dayCell) {
    throw new Error(`Day label ${dayNumber} not found`);
  }
  const button = dayCell.closest('button');
  if (!button) {
    throw new Error(`Button for day ${dayNumber} not found`);
  }
  return button;
}

describe('CalendarEventsMonthView', () => {
  it('affiche le mois et permet de naviguer au mois précédent et suivant', () => {
    const { onMonthChange } = renderComponent();

    expect(screen.getByText('mai 2024')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange.mock.calls[0][0]).toBeInstanceOf(Date);
    expect((onMonthChange.mock.calls[0][0] as Date).getMonth()).toBe(3);

    fireEvent.click(buttons[2]);
    expect(onMonthChange).toHaveBeenCalledTimes(2);
    expect(onMonthChange.mock.calls[1][0]).toBeInstanceOf(Date);
    expect((onMonthChange.mock.calls[1][0] as Date).getMonth()).toBe(5);
  });

  it('déclenche la création d’un événement au double-clic sur un jour', () => {
    const { onCreateEvent } = renderComponent();

    const day10Button = getCalendarDayButton(10);
    fireEvent.doubleClick(day10Button);

    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    expect(onCreateEvent.mock.calls[0][0]).toBeInstanceOf(Date);
    expect((onCreateEvent.mock.calls[0][0] as Date).getDate()).toBe(10);
    expect((onCreateEvent.mock.calls[0][0] as Date).getMonth()).toBe(4);
  });

  it('affiche les aperçus desktop, limite à 3 et montre le compteur des autres événements', () => {
    const { onEventClick } = renderComponent();

    expect(screen.getByText(format(new Date(MOCK_EVENTS[0].start_time), 'HH:mm', { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(format(new Date(MOCK_EVENTS[1].start_time), 'HH:mm', { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(format(new Date(MOCK_EVENTS[2].start_time), 'HH:mm', { locale: fr }))).toBeInTheDocument();

    expect(screen.getByTitle('Standup')).toBeInTheDocument();
    expect(screen.getByTitle('Déjeuner')).toBeInTheDocument();
    expect(screen.getByTitle('Atelier')).toBeInTheDocument();
    expect(screen.getByText('+1 autres')).toBeInTheDocument();
    expect(screen.queryByTitle('Rétro')).toBeNull();

    fireEvent.click(screen.getByTitle('Standup'));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(MOCK_EVENTS[0]);
  });

  it('ouvre le détail du jour, trie les événements par heure, affiche les métadonnées et ferme après clic sur un événement', () => {
    const { onEventClick } = renderComponent();

    fireEvent.click(getCalendarDayButton(10));

    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText(/vendredi 10 mai 2024/i)).toBeInTheDocument();
    expect(within(sheet).getByText('Paris')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /rejoindre la visio/i })).toHaveAttribute('href', 'https://meet.local/r1');
    expect(within(sheet).getAllByText('Travail').length).toBeGreaterThan(0);
    expect(within(sheet).getByText(`${format(new Date(MOCK_EVENTS[0].start_time), 'HH:mm')} - ${format(new Date(MOCK_EVENTS[0].end_time), 'HH:mm')}`)).toBeInTheDocument();

    const titleNodes = within(sheet)
      .getAllByText(/Standup|Déjeuner|Atelier|Rétro/)
      .filter((node) => node.tagName.toLowerCase() === 'div' && node.className.includes('font-medium'));

    expect(titleNodes.map((node) => node.textContent)).toEqual(['Standup', 'Déjeuner', 'Atelier', 'Rétro']);

    fireEvent.click(titleNodes[1]);
    expect(onEventClick).toHaveBeenCalledWith(MOCK_EVENTS[1]);
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('affiche un état vide pour un jour sans événement et permet de créer depuis la feuille', () => {
    const { onCreateEvent } = renderComponent();

    fireEvent.click(getCalendarDayButton(14));

    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText('Aucun événement ce jour')).toBeInTheDocument();

    fireEvent.click(within(sheet).getByText('Créer un événement'));
    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    expect(onCreateEvent.mock.calls[0][0]).toBeInstanceOf(Date);
    expect((onCreateEvent.mock.calls[0][0] as Date).getDate()).toBe(14);
  });

  it('affiche une journée entière pour un événement all-day', () => {
    renderComponent();

    fireEvent.click(getCalendarDayButton(20));

    const sheet = screen.getByTestId('sheet');
    expect(within(sheet).getByText('Jour férié')).toBeInTheDocument();
    expect(within(sheet).getByText('Toute la journée')).toBeInTheDocument();
    expect(within(sheet).getByText('National')).toBeInTheDocument();
  });

  it('active la heatmap et applique un style de fond sur un jour avec événements', () => {
    renderComponent();

    const toggle = screen.getByTestId('heatmap-toggle-events');
    fireEvent.click(toggle);

    const day10Button = getCalendarDayButton(10);
    expect(day10Button.getAttribute('style')).toContain('background-color');
  });
});