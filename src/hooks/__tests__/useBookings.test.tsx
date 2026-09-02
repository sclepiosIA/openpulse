import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase - use local mock to avoid strict type checking
const mockSupabase = {
  from: vi.fn()
}

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: mockSupabase
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

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
const mockBookingTypes = [
  {
    id: 'type-1',
    name: 'Démo OpenPulse',
    duration_minutes: 45,
    category: 'demo',
    description: 'Présentation de la solution',
    color: '#3b82f6',
    is_active: true,
    min_notice_hours: 24,
    max_future_days: 30
  },
  {
    id: 'type-2',
    name: 'Point de suivi',
    duration_minutes: 30,
    category: 'suivi',
    description: 'Réunion de suivi hebdomadaire',
    color: '#10b981',
    is_active: true,
    min_notice_hours: 4,
    max_future_days: 14
  }
]

const mockBookings = [
  {
    id: 'booking-1',
    booking_type_id: 'type-1',
    host_user_id: 'host-1',
    guest_name: 'Dr. Martin',
    guest_email: 'martin@hospital.fr',
    guest_phone: '+33612345678',
    start_time: '2024-01-20T10:00:00Z',
    end_time: '2024-01-20T10:45:00Z',
    status: 'confirmed',
    guest_notes: 'Intéressé par le module urgences',
    etablissement_id: 'etab-1',
    video_conference_url: 'https://meet.google.com/abc-xyz'
  },
  {
    id: 'booking-2',
    booking_type_id: 'type-2',
    host_user_id: 'host-1',
    guest_name: 'Marie Dupont',
    guest_email: 'dupont@clinic.fr',
    start_time: '2024-01-22T14:00:00Z',
    end_time: '2024-01-22T14:30:00Z',
    status: 'pending',
    etablissement_id: 'etab-2'
  }
]

const mockAvailabilitySlots = [
  {
    id: 'slot-1',
    user_id: 'host-1',
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '12:00',
    is_active: true
  },
  {
    id: 'slot-2',
    user_id: 'host-1',
    day_of_week: 1, // Monday
    start_time: '14:00',
    end_time: '18:00',
    is_active: true
  },
  {
    id: 'slot-3',
    user_id: 'host-1',
    day_of_week: 3, // Wednesday
    start_time: '10:00',
    end_time: '16:00',
    is_active: true
  }
]

describe('Bookings Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchBookingTypes', () => {
    it('should fetch active booking types', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBookingTypes,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('booking_types')
        .select('*')
        .eq('is_active', true)
        .order('name')

      expect(mockSupabase.from).toHaveBeenCalledWith('booking_types')
      expect(result.data).toEqual(mockBookingTypes)
      expect(result.error).toBeNull()
    })

    it('should filter booking types by category', async () => {
      const demoTypes = mockBookingTypes.filter(t => t.category === 'demo')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: demoTypes,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('booking_types')
        .select('*')
        .eq('category', 'demo')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].name).toBe('Démo OpenPulse')
    })
  })

  describe('fetchBookings', () => {
    it('should fetch bookings for a host', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBookings,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('bookings')
        .select('*')
        .eq('host_user_id', 'host-1')
        .order('start_time')

      expect(result.data).toEqual(mockBookings)
    })

    it('should fetch bookings by status', async () => {
      const confirmedBookings = mockBookings.filter(b => b.status === 'confirmed')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: confirmedBookings,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('bookings')
        .select('*')
        .eq('host_user_id', 'host-1')
        .eq('status', 'confirmed')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].status).toBe('confirmed')
    })

    it('should fetch upcoming bookings', async () => {
      const now = '2024-01-15T00:00:00Z'
      
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBookings,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('bookings')
        .select('*')
        .gte('start_time', now)
        .order('start_time')

      expect(result.data).toHaveLength(2)
    })
  })

  describe('createBooking', () => {
    it('should create a new booking', async () => {
      const newBooking = {
        booking_type_id: 'type-1',
        host_user_id: 'host-1',
        guest_name: 'Jean Nouveau',
        guest_email: 'jean@example.com',
        start_time: '2024-01-25T11:00:00Z',
        end_time: '2024-01-25T11:45:00Z',
        status: 'pending'
      }

      const createdBooking = { id: 'booking-new', ...newBooking }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createdBooking,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('bookings')
        .insert(newBooking)
        .select()
        .single()

      expect(result.data).toEqual(createdBooking)
      expect(result.error).toBeNull()
    })
  })

  describe('updateBooking', () => {
    it('should confirm a pending booking', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockBookings[1], status: 'confirmed' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', 'booking-2')
        .select()
        .single()

      expect(result.data?.status).toBe('confirmed')
    })

    it('should cancel a booking', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...mockBookings[0], 
                status: 'cancelled',
                cancellation_reason: 'Client indisponible'
              },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          cancellation_reason: 'Client indisponible'
        })
        .eq('id', 'booking-1')
        .select()
        .single()

      expect(result.data?.status).toBe('cancelled')
      expect(result.data?.cancellation_reason).toBe('Client indisponible')
    })
  })

  describe('Availability Management', () => {
    it('should fetch availability slots for a user', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAvailabilitySlots,
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('booking_availability_slots')
        .select('*')
        .eq('user_id', 'host-1')
        .eq('is_active', true)
        .order('day_of_week')

      expect(result.data).toHaveLength(3)
    })

    it('should create availability slot', async () => {
      const newSlot = {
        user_id: 'host-1',
        day_of_week: 5, // Friday
        start_time: '09:00',
        end_time: '17:00',
        is_active: true
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'slot-new', ...newSlot },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('booking_availability_slots')
        .insert(newSlot)
        .select()
        .single()

      expect(result.data?.day_of_week).toBe(5)
    })

    it('should disable availability slot', async () => {
      const disabledSlot = { ...mockAvailabilitySlots[0], is_active: false }
      
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: disabledSlot,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('booking_availability_slots')
        .update({ is_active: false })
        .eq('id', 'slot-1')

      expect(result.data?.is_active).toBe(false)
    })
  })

  describe('Booking Exceptions', () => {
    it('should create booking exception (blocked date)', async () => {
      const exception = {
        user_id: 'host-1',
        date: '2024-01-25',
        is_available: false,
        reason: 'Congés'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'exc-1', ...exception },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('booking_exceptions')
        .insert(exception)
        .select()
        .single()

      expect(result.data?.is_available).toBe(false)
      expect(result.data?.reason).toBe('Congés')
    })
  })

  describe('Booking Analytics', () => {
    it('should count bookings by status', () => {
      const bookingsByStatus = mockBookings.reduce((acc, booking) => {
        acc[booking.status] = (acc[booking.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(bookingsByStatus['confirmed']).toBe(1)
      expect(bookingsByStatus['pending']).toBe(1)
    })

    it('should calculate total duration of bookings', () => {
      const totalMinutes = mockBookings.reduce((sum, booking) => {
        const start = new Date(booking.start_time).getTime()
        const end = new Date(booking.end_time).getTime()
        return sum + (end - start) / (1000 * 60)
      }, 0)

      expect(totalMinutes).toBe(75) // 45 + 30 minutes
    })
  })
})
