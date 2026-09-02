import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/bookings/useBookings', () => ({
  useBookingPageBySlug: () => ({ data: null, isLoading: true }),
  useAvailableSlots: () => ({ data: [], isLoading: false }),
  useCreateBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBookingAvailabilitySlots: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/components/booking/BookingSidebar', () => ({
  BookingSidebar: () => <div />,
}));
vi.mock('@/components/booking/BookingCalendar', () => ({
  BookingCalendar: () => <div />,
}));
vi.mock('@/components/booking/TimeSlotPicker', () => ({
  TimeSlotPicker: () => <div />,
}));
vi.mock('@/components/booking/BookingConfirmation', () => ({
  BookingConfirmation: () => <div />,
}));
vi.mock('@/components/booking/TimezoneSelector', () => ({
  getDetectedTimezone: () => 'Europe/Paris',
}));

import PublicBooking from '../PublicBooking';

describe('PublicBooking page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders loading state', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/booking/test-slug']}>
          <Routes>
            <Route path="/booking/:slug" element={<PublicBooking />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
