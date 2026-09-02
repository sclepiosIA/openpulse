import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/contracts/useContrats', () => ({
  useContratsKPIs: () => ({ data: { totalActifs: 12, caAnnuel: 500000, expirantBientot: 3, enAttente: 5 }, isLoading: false }),
  useContratAlertes: () => ({ data: [] }),
  useContrats: () => ({ data: [] }),
}));

import ContratsDashboard from '../ContratsDashboard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('ContratsDashboard', () => {
  it('renders KPI cards', () => {
    render(
      <QueryClientProvider client={qc}>
        <ContratsDashboard />
      </QueryClientProvider>
    );
    expect(screen.getByText('Contrats actifs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders CA annuel KPI', () => {
    render(
      <QueryClientProvider client={qc}>
        <ContratsDashboard />
      </QueryClientProvider>
    );
    expect(screen.getByText('CA annuel contracté')).toBeInTheDocument();
  });
});
