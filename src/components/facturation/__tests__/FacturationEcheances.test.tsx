import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FacturationEcheances } from '../FacturationEcheances';

vi.mock('@/hooks/billing/useFacturationEtablissement', () => ({
  useEcheancesFacturation: () => ({
    echeancesParMois: {},
    isLoading: false,
    totalMontant: 0,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('FacturationEcheances', () => {
  it('renders title', () => {
    render(
      <QueryClientProvider client={qc}>
        <FacturationEcheances />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Échéances/i)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <QueryClientProvider client={qc}>
        <FacturationEcheances />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Aucune échéance/i)).toBeInTheDocument();
  });
});
