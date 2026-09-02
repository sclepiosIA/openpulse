// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { format, parseISO } from 'date-fns';
import { MobileDayDetailSheet } from './MobileDayDetailSheet';

const { STABLE } = vi.hoisted(() => ({
  STABLE: {
    open: true,
    date: new Date('2024-05-15T00:00:00.000Z'),
    event: {
      id: 'event-1',
      title: 'Rendez-vous client',
      start_time: '2024-05-15T09:30:00.000Z',
      end_time: '2024-05-15T10:45:00.000Z',
      location: 'Paris',
      color: '#123456',
      calendar: { color: '#654321' },
    },
    taskDone: {
      id: 'task-1',
      titre: 'Préparer le devis',
      statut: 'Terminé',
      categories_taches: { nom: 'Commercial', couleur: '#ff8800' },
    },
    taskBlocked: {
      id: 'task-2',
      titre: 'Valider contrat',
      statut: 'Bloqué',
      categories_taches: null,
    },
    absence: {
      id: 'abs-1',
      title: 'Congé',
      profile_name: 'Jean Dupont',
      start: new Date('2024-05-15T08:00:00.000Z'),
      end: new Date('2024-05-15T18:00:00.000Z'),
      type: 'Congés payés',
      color: '#ff0000',
    },
  },
}));

vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="sheet-root">{children}</div> : null);

  const SheetContent = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    side?: string;
    className?: string;
  }) => <div data-testid="sheet-content" className={className}>{children}</div>;

  const SheetHeader = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="sheet-header" className={className}>{children}</div>;

  const SheetTitle = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="sheet-title" className={className}>{children}</div>;

  return { Sheet, SheetContent, SheetHeader, SheetTitle };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    style,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <span data-testid="badge" className={className} style={style}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="scroll-area" className={className}>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('./ClickableLocation', () => ({
  ClickableLocation: ({
    location,
    iconClassName,
  }: {
    location: string;
    iconClassName?: string;
  }) => (
    <span data-testid="clickable-location" data-icon-class={iconClassName}>
      {location}
    </span>
  ),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Calendar: Icon,
    CheckSquare: Icon,
    UserMinus: Icon,
    Plus: Icon,
    Clock: Icon,
  };
});

describe('MobileDayDetailSheet', () => {
  it('returns null when date is null', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    const { container } = render(
      <MobileDayDetailSheet
        open={true}
        onOpenChange={onOpenChange}
        date={null}
        events={[]}
        tasks={[]}
        absences={[]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders empty state and create button when there are no items', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <MobileDayDetailSheet
        open={STABLE.open}
        onOpenChange={onOpenChange}
        date={STABLE.date}
        events={[]}
        tasks={[]}
        absences={[]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(screen.getByText(/aucun élément prévu ce jour/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /créer un événement/i })).toBeInTheDocument();
    expect(screen.queryByText(/absences/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/événements/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tâches/i)).not.toBeInTheDocument();
  });

  it('renders absences, events and tasks with business data', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <MobileDayDetailSheet
        open={STABLE.open}
        onOpenChange={onOpenChange}
        date={STABLE.date}
        events={[STABLE.event]}
        tasks={[STABLE.taskDone, STABLE.taskBlocked]}
        absences={[STABLE.absence]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    expect(screen.getByText('Absences (1)')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Congés payés')).toBeInTheDocument();

    expect(screen.getByText('Événements (1)')).toBeInTheDocument();
    expect(screen.getByText('Rendez-vous client')).toBeInTheDocument();
    expect(screen.getByText(`${format(parseISO(STABLE.event.start_time), 'HH:mm')} - ${format(parseISO(STABLE.event.end_time), 'HH:mm')}`)).toBeInTheDocument();
    expect(screen.getByTestId('clickable-location')).toHaveTextContent('Paris');

    expect(screen.getByText('Tâches (2)')).toBeInTheDocument();
    expect(screen.getByText('Préparer le devis')).toBeInTheDocument();
    expect(screen.getByText('Valider contrat')).toBeInTheDocument();
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getAllByText('Terminé')).toHaveLength(1);
    expect(screen.getAllByText('Bloqué')).toHaveLength(1);
  });

  it('clicking an event calls onEventClick with the event and closes the sheet', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <MobileDayDetailSheet
        open={STABLE.open}
        onOpenChange={onOpenChange}
        date={STABLE.date}
        events={[STABLE.event]}
        tasks={[]}
        absences={[]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /rendez-vous client/i }));

    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(STABLE.event);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('clicking a task calls onTaskClick with the task and closes the sheet', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <MobileDayDetailSheet
        open={STABLE.open}
        onOpenChange={onOpenChange}
        date={STABLE.date}
        events={[]}
        tasks={[STABLE.taskDone]}
        absences={[]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /préparer le devis/i }));

    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick).toHaveBeenCalledWith(STABLE.taskDone);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('clicking create button calls onCreateEvent with date and closes the sheet', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    render(
      <MobileDayDetailSheet
        open={STABLE.open}
        onOpenChange={onOpenChange}
        date={STABLE.date}
        events={[]}
        tasks={[]}
        absences={[]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /créer un événement/i }));

    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    expect(onCreateEvent).toHaveBeenCalledWith(STABLE.date);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies status-specific classes for completed and blocked tasks', () => {
    const onOpenChange = vi.fn();
    const onEventClick = vi.fn();
    const onTaskClick = vi.fn();
    const onCreateEvent = vi.fn();

    const { container } = render(
      <MobileDayDetailSheet
        open={STABLE.open}
        onOpenChange={onOpenChange}
        date={STABLE.date}
        events={[]}
        tasks={[STABLE.taskDone, STABLE.taskBlocked]}
        absences={[]}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onCreateEvent={onCreateEvent}
      />
    );

    const doneText = screen.getByText('Préparer le devis');
    expect(doneText.className).toContain('line-through');
    expect(doneText.className).toContain('text-muted-foreground');

    const dots = container.querySelectorAll('.w-3.h-3.rounded-full');
    expect(dots).toHaveLength(2);
    expect(dots[0]?.className).toContain('bg-green-500');
    expect(dots[1]?.className).toContain('bg-red-500');
  });
});