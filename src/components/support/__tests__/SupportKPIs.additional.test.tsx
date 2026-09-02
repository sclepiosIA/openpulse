import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/support/useSupportTickets', () => ({
  useSupportStats: () => ({
    data: null,
    isLoading: false,
  }),
}));

import { SupportKPIs } from '../SupportKPIs';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('SupportKPIs (no data)', () => {
  it('renders KPI labels with zero values', () => {
    render(
      <QueryClientProvider client={qc}>
        <SupportKPIs />
      </QueryClientProvider>
    );
    expect(screen.getByText('Total tickets')).toBeInTheDocument();
    expect(screen.getByText('Nouveaux')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Résolus')).toBeInTheDocument();
  });
});
