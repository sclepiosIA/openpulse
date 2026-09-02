/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  CalendarTimelinePreview,
  CalendarMonthPreview,
  CalendarEventDetailPreview,
  CalendarRemindersPreview,
  mockCalendarEvents,
  mockReminders,
} from './CalendrierPreviews'

vi.mock('../TutorielMockProviders', () => ({
  TutorielPreviewWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="preview-wrapper">{children}</div>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-title" className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-content" className={className}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="avatar" className={className}>{children}</div>,
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => <span data-testid="avatar-fallback" className={className}>{children}</span>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    Calendar: Icon,
    Clock: Icon,
    MapPin: Icon,
    Users: Icon,
    Video: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Bell: Icon,
  }
})

describe('CalendrierPreviews', () => {
  afterEach(() => {
    cleanup()
  })

  it('exports the expected mock data used by previews', () => {
    expect(mockCalendarEvents).toHaveLength(3)
    expect(mockCalendarEvents[0]).toMatchObject({
      id: '1',
      title: 'Démo OpenPulse - Cabinet Les Tilleuls',
      start: '09:00',
      end: '10:30',
      location: 'Visio Teams',
    })
    expect(mockCalendarEvents[2]).toMatchObject({
      title: 'Formation utilisateurs CH Le Villeneuve',
      start: '14:00',
      end: '17:00',
      color: 'bg-amber-500',
    })

    expect(mockReminders).toEqual([
      { id: '1', title: 'Préparer démo Cabinet', time: '30 min avant', event: 'Démo OpenPulse' },
      { id: '2', title: 'Vérifier visio', time: '15 min avant', event: 'Point hebdo' },
    ])
  })

  it('renders the timeline preview with date, hour slots and event details', () => {
    const { container } = render(<CalendarTimelinePreview />)

    expect(screen.getByTestId('preview-wrapper')).toBeInTheDocument()
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument()
    expect(screen.getByText('15 Janvier 2024')).toBeInTheDocument()

    const hourLabels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']
    hourLabels.forEach((hour) => {
      expect(screen.getByText(hour)).toBeInTheDocument()
    })

    expect(screen.getByText('Démo OpenPulse - Cabinet Les Tilleuls')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 10:30')).toBeInTheDocument()
    expect(screen.getByText('Visio Teams')).toBeInTheDocument()

    expect(screen.getByText('Point hebdo équipe')).toBeInTheDocument()
    expect(screen.getByText('11:00 - 11:30')).toBeInTheDocument()
    expect(screen.getByText('Salle de réunion A')).toBeInTheDocument()

    expect(screen.getByText('Formation utilisateurs CH Le Villeneuve')).toBeInTheDocument()
    expect(screen.getByText('14:00 - 17:00')).toBeInTheDocument()
    expect(screen.getByText('Sur site')).toBeInTheDocument()

    const eventBlocks = container.querySelectorAll('.absolute.left-0.right-2.rounded-lg')
    expect(eventBlocks).toHaveLength(3)
    expect(eventBlocks[0].getAttribute('style')).toContain('top: 64px')
    expect(eventBlocks[0].getAttribute('style')).toContain('height: 96px')
    expect(eventBlocks[1].getAttribute('style')).toContain('top: 192px')
    expect(eventBlocks[1].getAttribute('style')).toContain('height: 32px')
    expect(eventBlocks[2].getAttribute('style')).toContain('top: 384px')
    expect(eventBlocks[2].getAttribute('style')).toContain('height: 180px')
  })

  it('renders the month preview with selected day and event indicators', () => {
    const { container } = render(<CalendarMonthPreview />)

    expect(screen.getByText('Janvier 2024')).toBeInTheDocument()

    const headerDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    headerDays.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()

    const day15 = screen.getByText('15').closest('div')
    expect(day15?.className).toContain('bg-primary')
    expect(day15?.className).toContain('text-primary-foreground')

    const dots = container.querySelectorAll('.w-1.h-1.rounded-full')
    expect(dots).toHaveLength(6)

    const blueDots = container.querySelectorAll('.bg-blue-500.w-1.h-1.rounded-full')
    const purpleDots = container.querySelectorAll('.bg-purple-500.w-1.h-1.rounded-full')
    const amberDots = container.querySelectorAll('.bg-amber-500.w-1.h-1.rounded-full')
    const greenDots = container.querySelectorAll('.bg-green-500.w-1.h-1.rounded-full')
    const redDots = container.querySelectorAll('.bg-red-500.w-1.h-1.rounded-full')

    expect(blueDots).toHaveLength(2)
    expect(purpleDots).toHaveLength(1)
    expect(amberDots).toHaveLength(1)
    expect(greenDots).toHaveLength(1)
    expect(redDots).toHaveLength(1)
  })

  it('renders event detail preview with duration, location and attendee initials', () => {
    const { container } = render(<CalendarEventDetailPreview />)

    expect(screen.getByText('Démo OpenPulse - Cabinet Les Tilleuls')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 10:30')).toBeInTheDocument()
    expect(screen.getByText('Visio Teams')).toBeInTheDocument()
    expect(screen.getByText('1h30')).toBeInTheDocument()

    expect(screen.getByText('Marie Dupont')).toBeInTheDocument()
    expect(screen.getByText('Pierre Martin')).toBeInTheDocument()

    const initials = screen.getAllByTestId('avatar-fallback').map((el) => el.textContent)
    expect(initials).toEqual(['MD', 'PM'])

    const colorBar = container.querySelector('.h-2.w-full.rounded-t-lg')
    expect(colorBar?.className).toContain('bg-blue-500')
  })

  it('renders reminders preview with reminder titles, related events and timing badges', () => {
    render(<CalendarRemindersPreview />)

    expect(screen.getByText('Rappels à venir')).toBeInTheDocument()

    expect(screen.getByText('Préparer démo Cabinet')).toBeInTheDocument()
    expect(screen.getByText('Démo OpenPulse')).toBeInTheDocument()
    expect(screen.getByText('30 min avant')).toBeInTheDocument()

    expect(screen.getByText('Vérifier visio')).toBeInTheDocument()
    expect(screen.getByText('Point hebdo')).toBeInTheDocument()
    expect(screen.getByText('15 min avant')).toBeInTheDocument()

    expect(screen.getAllByTestId('badge')).toHaveLength(2)
  })

  it('keeps month selected day static when clicking another day because no click handler is wired', () => {
    render(<CalendarMonthPreview />)

    const day15 = screen.getByText('15').closest('div')
    const day18Text = screen.getByText('18')

    fireEvent.click(day18Text)

    expect(day15?.className).toContain('bg-primary')
    expect(day15?.className).toContain('text-primary-foreground')
  })
})