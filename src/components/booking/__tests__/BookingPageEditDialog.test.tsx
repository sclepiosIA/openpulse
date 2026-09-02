import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingPageEditDialog } from '../BookingPageEditDialog';
import type { BookingPage } from '@/types/booking';

vi.mock('@/hooks/bookings/useBookings', () => ({
  useUpdateBookingPage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBookingPageTypes: () => ({ data: [] }),
  useUpdateBookingPageTypes: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBookingPageHosts: () => ({ data: [] }),
  useUpdateBookingPageHosts: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useActiveProfilesWithRoles: () => ({ data: [], isLoading: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const mockPage = {
  id: 'p1',
  title: 'Ma page',
  slug: 'ma-page',
  description: 'Description test',
  is_active: true,
  user_id: 'u1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
} as unknown as BookingPage;

describe('BookingPageEditDialog', () => {
  it('renders dialog when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <BookingPageEditDialog page={mockPage} open={true} onOpenChange={vi.fn()} allBookingTypes={[]} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Modifier la page de réservation')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <BookingPageEditDialog page={mockPage} open={false} onOpenChange={vi.fn()} allBookingTypes={[]} />
      </QueryClientProvider>
    );
    expect(screen.queryByText('Modifier la page de réservation')).not.toBeInTheDocument();
  });

  it('renders page title in form', () => {
    render(
      <QueryClientProvider client={qc}>
        <BookingPageEditDialog page={mockPage} open={true} onOpenChange={vi.fn()} allBookingTypes={[]} />
      </QueryClientProvider>
    );
    expect(screen.getByDisplayValue('Ma page')).toBeInTheDocument();
  });
});
