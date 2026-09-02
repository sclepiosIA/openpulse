import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarItemTooltip } from '../CalendarItemTooltip'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { CalendarEvent } from '@/types/calendar'

vi.mock('@/hooks/calendar/useEventTranscription', () => ({
  useEventTranscription: () => ({ transcription: null, isLoading: false, error: null }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )

const mockTask = {
  id: 't1',
  titre: 'Déployer module CRM',
  echeance: '2026-03-15',
  statut: 'En cours',
  priorite: 'Haute',
  description: 'Description détaillée de la tâche',
  categories_taches: { nom: 'Dev', couleur: '#3b82f6' },
  etablissements: { nom: 'CHU Lyon' },
}

const mockEvent: CalendarEvent = {
  id: 'e1',
  title: 'Réunion équipe',
  start_time: '2026-03-09T14:30:00',
  end_time: '2026-03-09T15:30:00',
  all_day: false,
  status: 'confirmed',
  visibility: 'public',
  calendar_id: 'cal1',
  description: 'Discussion sprint',
  location: 'Salle A',
  color: '#10b981',
  video_conference_url: null,
  recurrence_rule: null,
  recurrence_parent_id: null,
  recurrence_exception_dates: null,
  etablissement_id: null,
  tache_id: null,
  created_by: null,
  created_at: '2026-03-09T14:00:00',
  updated_at: '2026-03-09T14:00:00',
}

describe('CalendarItemTooltip', () => {
  it('renders task tooltip with titre', () => {
    render(<CalendarItemTooltip item={mockTask} type="task" />)
    expect(screen.getByText('Déployer module CRM')).toBeInTheDocument()
  })

  it('renders task status badge', () => {
    render(<CalendarItemTooltip item={mockTask} type="task" />)
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('renders task priority badge for non-Moyenne', () => {
    render(<CalendarItemTooltip item={mockTask} type="task" />)
    expect(screen.getByText('Haute')).toBeInTheDocument()
  })

  it('renders task category', () => {
    render(<CalendarItemTooltip item={mockTask} type="task" />)
    expect(screen.getByText('Dev')).toBeInTheDocument()
  })

  it('renders task etablissement', () => {
    render(<CalendarItemTooltip item={mockTask} type="task" />)
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument()
  })

  it('renders task description', () => {
    render(<CalendarItemTooltip item={mockTask} type="task" />)
    expect(screen.getByText('Description détaillée de la tâche')).toBeInTheDocument()
  })

  it('renders event tooltip with title', () => {
    wrap(<CalendarItemTooltip item={mockEvent} type="event" />)
    expect(screen.getByText('Réunion équipe')).toBeInTheDocument()
  })

  it('renders event time range', () => {
    wrap(<CalendarItemTooltip item={mockEvent} type="event" />)
    expect(screen.getByText(/14:30/)).toBeInTheDocument()
  })

  it('renders event description', () => {
    wrap(<CalendarItemTooltip item={mockEvent} type="event" />)
    expect(screen.getByText('Discussion sprint')).toBeInTheDocument()
  })

  it('shows "Toute la journée" for all-day events', () => {
    const allDayEvent: CalendarEvent = { ...mockEvent, all_day: true }
    wrap(<CalendarItemTooltip item={allDayEvent} type="event" />)
    expect(screen.getByText('Toute la journée')).toBeInTheDocument()
  })
})
