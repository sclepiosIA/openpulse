import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerHealthMetricsEditor } from '../CustomerHealthMetricsEditor';

vi.mock('@/hooks/crm/useCustomerHealthMetrics', () => ({
  useUpdateHealthMetrics: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/validations', () => ({
  UpdateHealthMetricsSchema: { parse: vi.fn() },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('CustomerHealthMetricsEditor', () => {
  it('renders form with save button', () => {
    render(
      <QueryClientProvider client={qc}>
        <CustomerHealthMetricsEditor etablissementId="e1" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Enregistrer/i)).toBeInTheDocument();
  });

  it('renders metric fields', () => {
    render(
      <QueryClientProvider client={qc}>
        <CustomerHealthMetricsEditor etablissementId="e1" />
      </QueryClientProvider>
    );
    // Should render accordion sections
    expect(screen.getByText(/Utilisation/i)).toBeInTheDocument();
  });
});
