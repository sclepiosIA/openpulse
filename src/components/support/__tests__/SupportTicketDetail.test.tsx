import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mockTicket = { current: { data: null as any, isLoading: true as boolean } };

vi.mock('@/hooks/support/useSupportTickets', () => ({
  useSupportTicketById: () => mockTicket.current,
  useSupportTicketComments: () => ({ data: [], isLoading: false }),
  useUpdateSupportTicket: () => ({ mutate: vi.fn() }),
  useAssignTicket: () => ({ mutate: vi.fn() }),
  useAddTicketComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [], isLoading: false }),
}));

import { SupportTicketDetail } from '../SupportTicketDetail';

const renderCmp = (ticketId: string | null) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SupportTicketDetail ticketId={ticketId} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('SupportTicketDetail', () => {
  it('renders placeholder when ticketId is null', () => {
    renderCmp(null);
    expect(
      screen.getByText('Sélectionnez un ticket pour voir les détails')
    ).toBeInTheDocument();
  });

  it('renders loading skeletons when query is loading', () => {
    mockTicket.current = { data: null, isLoading: true };
    const { container } = renderCmp('t1');
    expect(container.querySelectorAll('.bg-muted').length).toBeGreaterThanOrEqual(2);
  });

  it('renders "Ticket non trouvé" when query resolves with null data', () => {
    mockTicket.current = { data: null, isLoading: false };
    renderCmp('t1');
    expect(screen.getByText('Ticket non trouvé')).toBeInTheDocument();
  });
});
