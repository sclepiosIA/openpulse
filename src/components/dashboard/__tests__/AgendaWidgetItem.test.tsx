import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgendaWidgetItem } from '../AgendaWidgetItem'
import type { UpcomingAppointment } from '@/hooks/bookings/useUpcomingAppointments'

vi.mock('@/components/calendrier/CalendarItemTooltip', () => ({
  CalendarItemTooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

const baseAppointment: UpcomingAppointment = {
  id: 'a1',
  title: 'Réunion équipe',
  start_time: '2026-03-10T10:00:00+01:00',
  end_time: '2026-03-10T11:00:00+01:00',
  type: 'rdv',
  location: 'Salle A',
  description: 'Point hebdo',
  video_conference_url: undefined,
  all_day: false,
  calendar_name: 'Principal',
  calendar_color: '#3b82f6',
  etablissement_nom: 'CHU Lyon',
  formattedDate: '10/03/2026',
}

describe('AgendaWidgetItem', () => {
  it('renders appointment title', () => {
    render(<AgendaWidgetItem appointment={baseAppointment} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('Réunion équipe')).toBeInTheDocument()
  })

  it('renders time range', () => {
    render(<AgendaWidgetItem appointment={baseAppointment} index={0} onClick={vi.fn()} />)
    expect(screen.getByText(/10:00/)).toBeInTheDocument()
  })

  it('renders location when present', () => {
    render(<AgendaWidgetItem appointment={baseAppointment} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('Salle A')).toBeInTheDocument()
  })

  it('renders etablissement name', () => {
    render(<AgendaWidgetItem appointment={baseAppointment} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument()
  })

  it('renders without crash at different indices', () => {
    render(<AgendaWidgetItem appointment={baseAppointment} index={3} onClick={vi.fn()} />)
    expect(screen.getByText('Réunion équipe')).toBeInTheDocument()
  })
})
