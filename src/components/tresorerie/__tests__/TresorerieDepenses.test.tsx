import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TresorerieDepenses } from '../TresorerieDepenses';

vi.mock('../DepensesRealisees', () => ({
  DepensesRealisees: () => <div data-testid="depenses-realisees">Réalisés</div>,
}));

vi.mock('../DepensesPrevisionnelles', () => ({
  DepensesPrevisionnelles: () => <div data-testid="depenses-prev">Prévisionnel</div>,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TresorerieDepenses', () => {
  it('renders tab triggers', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieDepenses />
      </QueryClientProvider>
    );
    expect(screen.getByRole('tab', { name: /Réalisés/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Prévisionnel/ })).toBeInTheDocument();
  });

  it('shows réalisés tab content by default', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieDepenses />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('depenses-realisees')).toBeInTheDocument();
  });
});
