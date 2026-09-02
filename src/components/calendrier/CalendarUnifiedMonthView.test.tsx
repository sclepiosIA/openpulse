// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { format } from 'date-fns'
import { CalendarUnifiedMonthView } from './CalendarUnifiedMonthView'

const { stableDeleteMutation, stableAuth, stableMobileFalse, stableMobileTrue } = vi.hoisted(
  () => ({
    stableDeleteMutation: {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    },
    stableAuth: {
      user: { id: 'u1', email: 'u@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    stableMobileFalse: false,
    stableMobileTrue: true,
  })
)

let mobileValue = stableMobileFalse

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    className?: string
    'aria-label'?: string
  }) => (
    <button onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
}))

vi.mock('./CalendarItemTooltip', () => ({
  CalendarItemTooltip: () => <div data-testid="calendar-item-tooltip" />,
}))

vi.mock('./CalendarItemContextMenu', () => ({
  CalendarItemContextMenu: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useDeleteTache: () => stableDeleteMutation,
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => mobileValue,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  CheckSquare: () => <svg data-testid="icon-check" />,
  Plus: () => <svg data-testid="icon-plus" />,
  UserMinus: () => <svg data-testid="icon-user-minus" />,
  Flag: () => <svg data-testid="icon-flag" />,
}))

describe('CalendarUnifiedMonthView', () => {
  const currentMonth = new Date('2024-05-15T10:00:00.000Z')

  const tasks = [
    {
      id: 't1',
      titre: 'Task current day',
      echeance: '2024-05-15T09:00:00.000Z',
      statut: 'En cours',
      priorite: 'Haute',
      categories_taches: { nom: 'Cat', couleur: '#abc' },
    },
    {
      id: 't2',
      titre: 'Task other day',
      echeance: '2024-05-20T09:00:00.000Z',
      statut: 'Terminé',
      priorite: 'Basse',
      categories_taches: null,
    },
  ]

  const events = [
    {
      id: 'e1',
      title: 'Meeting',
      start_time: '2024-05-15T10:00:00.000Z',
      end_time: '2024-05-15T11:00:00.000Z',
      display_as_banner: false,
      color: '#123456',
      availability: 'busy',
      all_day: false,
      calendar: { color: '#123456', owner_id: 'u1' },
    },
    {
      id: 'e2',
      title: 'Vacation banner',
      start_time: '2024-05-14T00:00:00.000Z',
      end_time: '2024-05-16T23:59:59.000Z',
      display_as_banner: true,
      color: '#ff8800',
      availability: 'free',
      all_day: true,
      calendar: { color: '#ff8800', owner_id: 'u2' },
    },
  ]

  const absences = [
    {
      id: 'a1',
      title: 'Congé',
      profile_name: 'Jane Doe',
      start: new Date(2024, 4, 15, 0, 0, 0),
      end: new Date(2024, 4, 15, 23, 59, 59),
      type: 'leave',
      color: '#ff0000',
    },
  ]

  const baseProps = {
    tasks,
    events,
    absences,
    currentMonth,
    onMonthChange: vi.fn(),
    onTaskClick: vi.fn(),
    onEventClick: vi.fn(),
    onCreateEvent: vi.fn(),
    onDayClick: vi.fn(),
    contentFilters: {
      showTasks: true,
      showEvents: true,
      showAbsences: true,
    },
    currentAuthUserId: 'u1',
  }

  beforeEach(() => {
    mobileValue = stableMobileFalse
    vi.clearAllMocks()
  })

  it('renders day headers and visible month content on desktop', () => {
    render(<CalendarUnifiedMonthView {...baseProps} />)

    expect(screen.getByText('LUN')).toBeInTheDocument()
    expect(screen.getByText('MAR')).toBeInTheDocument()
    expect(screen.getByText('DIM')).toBeInTheDocument()

    expect(screen.getByText('Vacation banner')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()

    const addButtons = screen.getAllByLabelText('Ajouter')
    expect(addButtons.length).toBeGreaterThan(0)
  })

  it('calls onEventClick when clicking a banner event', () => {
    const onEventClick = vi.fn()

    render(<CalendarUnifiedMonthView {...baseProps} onEventClick={onEventClick} />)

    fireEvent.click(screen.getByText('Vacation banner'))
    expect(onEventClick).toHaveBeenCalledTimes(1)
    expect(onEventClick).toHaveBeenCalledWith(events[1])
  })

  it('calls onCreateEvent when clicking the add button on desktop', () => {
    const onCreateEvent = vi.fn()

    render(<CalendarUnifiedMonthView {...baseProps} onCreateEvent={onCreateEvent} />)

    fireEvent.click(screen.getAllByLabelText('Ajouter')[0])
    expect(onCreateEvent).toHaveBeenCalledTimes(1)
    expect(onCreateEvent.mock.calls[0][0]).toBeInstanceOf(Date)
  })

  it('calls onDayClick on mobile when clicking a day cell and shows overflow counter', () => {
    mobileValue = stableMobileTrue
    const onDayClick = vi.fn()

    const mobileTasks = [
      ...tasks,
      {
        id: 't3',
        titre: 'Extra task 1',
        echeance: '2024-05-15T12:00:00.000Z',
        statut: 'En cours',
        priorite: 'Moyenne',
        categories_taches: null,
      },
      {
        id: 't4',
        titre: 'Extra task 2',
        echeance: '2024-05-15T13:00:00.000Z',
        statut: 'Bloqué',
        priorite: 'Moyenne',
        categories_taches: null,
      },
      {
        id: 't5',
        titre: 'Extra task 3',
        echeance: '2024-05-15T14:00:00.000Z',
        statut: 'À faire',
        priorite: 'Moyenne',
        categories_taches: null,
      },
    ]

    const mobileEvents = [
      ...events,
      {
        id: 'e3',
        title: 'Extra event',
        start_time: '2024-05-15T15:00:00.000Z',
        end_time: '2024-05-15T16:00:00.000Z',
        display_as_banner: false,
        color: '#00aa00',
        availability: 'busy',
        all_day: false,
        calendar: { color: '#00aa00', owner_id: 'u1' },
      },
    ]

    render(
      <CalendarUnifiedMonthView
        {...baseProps}
        tasks={mobileTasks}
        events={mobileEvents}
        onDayClick={onDayClick}
      />
    )

    const dayNumber = screen.getByText('15')
    fireEvent.click(dayNumber)

    expect(onDayClick).toHaveBeenCalledTimes(1)
    expect(format(onDayClick.mock.calls[0][0], 'yyyy-MM-dd')).toBe('2024-05-15')
    const dayCell = dayNumber.parentElement?.parentElement
    expect(dayCell).not.toBeNull()
    expect(within(dayCell as HTMLElement).getByText('+2')).toBeInTheDocument()
  })

  it('hides tasks/events/absences when filters are disabled', () => {
    render(
      <CalendarUnifiedMonthView
        {...baseProps}
        contentFilters={{
          showTasks: false,
          showEvents: false,
          showAbsences: false,
        }}
      />
    )

    expect(screen.queryByText('Vacation banner')).not.toBeInTheDocument()
    expect(screen.queryByText('Jane')).not.toBeInTheDocument()
  })
})
