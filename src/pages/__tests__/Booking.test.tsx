import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory'

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule())
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@test.com' } }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/hooks/bookings/useBookings', () => ({
  useBookingTypes: () => ({ data: [], isLoading: false }),
  useBookingPages: () => ({ data: [], isLoading: false }),
  useBookingAvailabilitySlots: () => ({ data: [], isLoading: false }),
  useUpcomingBookings: () => ({ data: [], isLoading: false }),
  useBookings: () => ({ data: [], isLoading: false }),
  useCreateBookingPage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateAvailabilitySlot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAvailabilitySlot: () => ({ mutateAsync: vi.fn() }),
  useCreateBookingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBookingType: () => ({ mutateAsync: vi.fn() }),
  useUpdateBookingStatus: () => ({ mutateAsync: vi.fn() }),
  useUpdateBookingPage: () => ({ mutateAsync: vi.fn() }),
  useBookingExceptions: () => ({ data: [], isLoading: false }),
  useCreateBookingException: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

import Booking from '../Booking'

describe('Booking page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Booking />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
