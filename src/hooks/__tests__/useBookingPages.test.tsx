import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: '123' } } } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: '123', email: 'test@test.com' },
    signOut: vi.fn(),
  }),
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Booking Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate booking slug correctly', () => {
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    }
    
    expect(generateSlug('Réunion Commerciale')).toBe('reunion-commerciale')
    expect(generateSlug('Démo Produit 30min')).toBe('demo-produit-30min')
    expect(generateSlug('   Test   Multiple   Spaces   ')).toBe('test-multiple-spaces')
  })

  it('should validate booking duration', () => {
    const validDurations = [15, 30, 45, 60, 90, 120]
    const isValidDuration = (minutes: number): boolean => validDurations.includes(minutes)
    
    expect(isValidDuration(30)).toBe(true)
    expect(isValidDuration(60)).toBe(true)
    expect(isValidDuration(25)).toBe(false)
    expect(isValidDuration(0)).toBe(false)
  })

  it('should format booking time correctly', () => {
    const formatBookingTime = (date: Date): string => {
      return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }
    
    const testDate = new Date('2026-02-01T14:30:00')
    expect(formatBookingTime(testDate)).toBe('14:30')
  })

  it('should calculate end time from start time and duration', () => {
    const calculateEndTime = (startTime: Date, durationMinutes: number): Date => {
      return new Date(startTime.getTime() + durationMinutes * 60 * 1000)
    }
    
    const start = new Date('2026-02-01T14:00:00')
    const end = calculateEndTime(start, 30)
    
    expect(end.getHours()).toBe(14)
    expect(end.getMinutes()).toBe(30)
  })

  it('should check for booking conflicts', () => {
    const hasConflict = (
      newStart: Date,
      newEnd: Date,
      existingBookings: Array<{ start: Date; end: Date }>
    ): boolean => {
      return existingBookings.some(booking => 
        (newStart >= booking.start && newStart < booking.end) ||
        (newEnd > booking.start && newEnd <= booking.end) ||
        (newStart <= booking.start && newEnd >= booking.end)
      )
    }
    
    const existing = [
      { start: new Date('2026-02-01T10:00'), end: new Date('2026-02-01T11:00') },
      { start: new Date('2026-02-01T14:00'), end: new Date('2026-02-01T15:00') },
    ]
    
    // Conflict: overlaps with 10:00-11:00
    expect(hasConflict(
      new Date('2026-02-01T10:30'),
      new Date('2026-02-01T11:30'),
      existing
    )).toBe(true)
    
    // No conflict: between existing bookings
    expect(hasConflict(
      new Date('2026-02-01T12:00'),
      new Date('2026-02-01T13:00'),
      existing
    )).toBe(false)
  })
})

describe('Booking Availability', () => {
  it('should check if time slot is within business hours', () => {
    const isWithinBusinessHours = (
      time: Date,
      startHour: number = 9,
      endHour: number = 18
    ): boolean => {
      const hour = time.getHours()
      return hour >= startHour && hour < endHour
    }
    
    expect(isWithinBusinessHours(new Date('2026-02-01T10:00'))).toBe(true)
    expect(isWithinBusinessHours(new Date('2026-02-01T08:00'))).toBe(false)
    expect(isWithinBusinessHours(new Date('2026-02-01T18:00'))).toBe(false)
  })

  it('should check if day is a weekend', () => {
    const isWeekend = (date: Date): boolean => {
      const day = date.getDay()
      return day === 0 || day === 6
    }
    
    // Saturday
    expect(isWeekend(new Date('2026-02-07'))).toBe(true)
    // Sunday
    expect(isWeekend(new Date('2026-02-08'))).toBe(true)
    // Monday
    expect(isWeekend(new Date('2026-02-02'))).toBe(false)
  })

  it('should generate available time slots', () => {
    const generateTimeSlots = (
      date: Date,
      startHour: number,
      endHour: number,
      intervalMinutes: number
    ): Date[] => {
      const slots: Date[] = []
      const current = new Date(date)
      current.setHours(startHour, 0, 0, 0)
      
      while (current.getHours() < endHour) {
        slots.push(new Date(current))
        current.setMinutes(current.getMinutes() + intervalMinutes)
      }
      
      return slots
    }
    
    const slots = generateTimeSlots(new Date('2026-02-01'), 9, 12, 30)
    
    expect(slots.length).toBe(6) // 9:00, 9:30, 10:00, 10:30, 11:00, 11:30
    expect(slots[0].getHours()).toBe(9)
    expect(slots[0].getMinutes()).toBe(0)
    expect(slots[5].getHours()).toBe(11)
    expect(slots[5].getMinutes()).toBe(30)
  })
})

describe('Booking Type Configuration', () => {
  it('should validate booking type configuration', () => {
    interface BookingTypeConfig {
      name: string
      duration_minutes: number
      buffer_before?: number
      buffer_after?: number
      color?: string
    }
    
    const isValidConfig = (config: BookingTypeConfig): boolean => {
      if (!config.name || config.name.length < 3) return false
      if (config.duration_minutes < 15 || config.duration_minutes > 480) return false
      if (config.buffer_before && config.buffer_before < 0) return false
      if (config.buffer_after && config.buffer_after < 0) return false
      return true
    }
    
    expect(isValidConfig({ name: 'Réunion', duration_minutes: 30 })).toBe(true)
    expect(isValidConfig({ name: 'AB', duration_minutes: 30 })).toBe(false) // name too short
    expect(isValidConfig({ name: 'Test', duration_minutes: 10 })).toBe(false) // duration too short
    expect(isValidConfig({ name: 'Test', duration_minutes: 500 })).toBe(false) // duration too long
  })
})
