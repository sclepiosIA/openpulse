import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerHealthDashboard } from '../CustomerHealthDashboard';

vi.mock('@/hooks/crm/useCustomerHealthMetrics', () => ({
  useCustomerHealthMetrics: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/crm/useCustomerHealth', () => ({
  useCustomerHealth: () => new Map(),
}));

vi.mock('@/components/production/CustomerHealthIndicator', () => ({
  CustomerHealthIndicator: () => <div data-testid="health-indicator">Health</div>,
}));

vi.mock('./CustomerHealthMetricsEditor', () => ({
  CustomerHealthMetricsEditor: () => null,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etablissement = {
  id: 'etab1',
  nom: 'CHU Test',
  statut: 'Production',
} as any;

describe('CustomerHealthDashboard', () => {
  it('renders no-data state', () => {
    render(
      <QueryClientProvider client={qc}>
        <CustomerHealthDashboard etablissement={etablissement} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Aucune donnée de santé/i)).toBeInTheDocument();
  });

  it('renders create button when no metrics', () => {
    render(
      <QueryClientProvider client={qc}>
        <CustomerHealthDashboard etablissement={etablissement} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Créer les métriques')).toBeInTheDocument();
  });
});
