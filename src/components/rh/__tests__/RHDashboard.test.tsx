import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/hr/useRHKPIs', () => ({
  useRHKPIs: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('./RHTresorerieWidget', () => ({
  RHTresorerieWidget: () => <div data-testid="rh-tresorerie-widget" />,
}));

vi.mock('./RHReconciliation', () => ({
  RHReconciliation: () => <div data-testid="rh-reconciliation" />,
}));

vi.mock('@/components/shared/StatsCard', () => ({
  StatsCard: ({ title, value }: { title: string; value: any }) => (
    <div><span>{title}</span><span>{String(value)}</span></div>
  ),
}));

vi.mock('@/components/shared/LoadingStates', () => ({
  StatsSkeleton: () => <div data-testid="stats-skeleton" />,
}));

import { RHDashboard } from '../RHDashboard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RHDashboard', () => {
  it('renders empty state when no data', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RHDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Aucune donnée RH disponible/)).toBeInTheDocument();
  });

  it('renders fiches button in empty state', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RHDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Aller aux fiches employés')).toBeInTheDocument();
  });
});
