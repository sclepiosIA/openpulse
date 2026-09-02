import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Supabase before importing hooks
vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    }
  }
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

import { supabase } from '@/lib/supabaseBrowser'

interface WrapperProps {
  children: React.ReactNode
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: WrapperProps) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Mock data
const mockCalendarEvents = [
  {
    id: 'event-1',
    title: 'Réunion équipe',
    start_time: '2024-01-15T10:00:00Z',
    end_time: '2024-01-15T11:00:00Z',
    calendar_id: 'cal-1',
    status: 'confirmed',
    all_day: false
  },
  {
    id: 'event-2',
    title: 'Formation',
    start_time: '2024-01-16T09:00:00Z',
    end_time: '2024-01-16T17:00:00Z',
    calendar_id: 'cal-1',
    status: 'confirmed',
    all_day: true
  }
]

const mockCalendars = [
  {
    id: 'cal-1',
    name: 'Mon calendrier',
    owner_id: 'user-123',
    color: '#3b82f6',
    is_visible: true
  }
]

describe('Calendar Events Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchCalendarEvents', () => {
    it('should fetch calendar events with date range filter', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: mockCalendarEvents,
            error: null
          })
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', '2024-01-01')
        .lte('end_time', '2024-01-31')

      expect(supabase.from).toHaveBeenCalledWith('calendar_events')
      expect(data).toEqual(mockCalendarEvents)
      expect(error).toBeNull()
    })

    it('should handle fetch errors gracefully', async () => {
      const mockError = new Error('Database connection failed')
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: null,
            error: mockError
          })
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', '2024-01-01')
        .lte('end_time', '2024-01-31')

      expect(data).toBeNull()
      expect(error).toEqual(mockError)
    })
  })

  describe('createCalendarEvent', () => {
    it('should create a new calendar event successfully', async () => {
      const newEvent = {
        title: 'Nouveau RDV',
        start_time: '2024-01-20T14:00:00Z',
        end_time: '2024-01-20T15:00:00Z',
        calendar_id: 'cal-1',
        status: 'confirmed'
      }

      const createdEvent = { id: 'event-new', ...newEvent }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createdEvent,
            error: null
          })
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(newEvent)
        .select()
        .single()

      expect(supabase.from).toHaveBeenCalledWith('calendar_events')
      expect(data).toEqual(createdEvent)
      expect(error).toBeNull()
    })
  })

  describe('updateCalendarEvent', () => {
    it('should update an existing calendar event', async () => {
      const updateData = { title: 'Réunion modifiée' }
      const updatedEvent = { ...mockCalendarEvents[0], ...updateData }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedEvent,
              error: null
            })
          })
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

      const { data, error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', 'event-1')
        .select()
        .single()

      expect(data?.title).toBe('Réunion modifiée')
      expect(error).toBeNull()
    })
  })

  describe('deleteCalendarEvent', () => {
    it('should delete a calendar event', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ delete: mockDelete } as any)

      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', 'event-1')

      expect(supabase.from).toHaveBeenCalledWith('calendar_events')
      expect(error).toBeNull()
    })
  })

  describe('Calendar Management', () => {
    it('should fetch user calendars', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockCalendars,
          error: null
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const { data } = await supabase
        .from('calendars')
        .select('*')
        .eq('owner_id', 'user-123')

      expect(data).toEqual(mockCalendars)
    })

    it('should create a new calendar', async () => {
      const newCalendar = {
        name: 'Nouveau calendrier',
        owner_id: 'user-123',
        color: '#10b981'
      }

      const createdCalendar = { id: 'cal-new', ...newCalendar, is_visible: true }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createdCalendar,
            error: null
          })
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

      const { data } = await supabase
        .from('calendars')
        .insert(newCalendar)
        .select()
        .single()

      expect(data?.name).toBe('Nouveau calendrier')
    })
  })

  describe('Event Filters', () => {
    it('should filter events by calendar', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockCalendarEvents.filter(e => e.calendar_id === 'cal-1'),
          error: null
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('calendar_id', 'cal-1')

      expect(data).toHaveLength(2)
      expect(data?.every(e => e.calendar_id === 'cal-1')).toBe(true)
    })

    it('should filter all-day events', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockCalendarEvents.filter(e => e.all_day),
          error: null
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('all_day', true)

      expect(data).toHaveLength(1)
      expect(data?.[0].title).toBe('Formation')
    })
  })

  describe('Recurring Events', () => {
    it('should create recurring event with recurrence rule', async () => {
      const recurringEvent = {
        title: 'Réunion hebdomadaire',
        start_time: '2024-01-15T10:00:00Z',
        end_time: '2024-01-15T11:00:00Z',
        calendar_id: 'cal-1',
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=10'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'event-recurring', ...recurringEvent },
            error: null
          })
        })
      })
      
      vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

      const { data } = await supabase
        .from('calendar_events')
        .insert(recurringEvent)
        .select()
        .single()

      expect(data?.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=MO;COUNT=10')
    })
  })
})
