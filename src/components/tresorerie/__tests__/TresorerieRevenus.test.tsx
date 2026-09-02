import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TresorerieRevenus } from '../TresorerieRevenus';

vi.mock('../RevenusRealises', () => ({
  RevenusRealises: () => <div data-testid="revenus-realises">Réalisés Content</div>,
}));

vi.mock('../RevenusPrevisionnels', () => ({
  RevenusPrevisionnels: () => <div data-testid="revenus-prev">Prévisionnel Content</div>,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TresorerieRevenus', () => {
  it('renders tab triggers', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieRevenus />
      </QueryClientProvider>
    );
    expect(screen.getByText('Réalisés')).toBeInTheDocument();
    expect(screen.getByText('Prévisionnel')).toBeInTheDocument();
  });

  it('shows réalisés tab content by default', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieRevenus />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('revenus-realises')).toBeInTheDocument();
  });
});
