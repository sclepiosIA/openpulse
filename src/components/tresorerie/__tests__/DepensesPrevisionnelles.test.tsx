import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockHook = {
  current: {
    depenses: [] as any[],
    isLoading: false,
    marquerPayee: { mutate: vi.fn(), isPending: false },
    deleteDepense: { mutate: vi.fn(), isPending: false },
    updateDepense: { mutate: vi.fn(), isPending: false },
    addDepense: { mutate: vi.fn() },
    isUpdating: false,
    isDeleting: false,
  },
};

vi.mock('@/hooks/tresorerie/useTresorerieDepenses', () => ({
  useTresorerieDepenses: () => mockHook.current,
}));

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: [], isLoading: false }),
}));

import { DepensesPrevisionnelles } from '../DepensesPrevisionnelles';

const renderCmp = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DepensesPrevisionnelles />
    </QueryClientProvider>
  );
};

describe('DepensesPrevisionnelles', () => {
  it('renders loading state with 2 animate-pulse placeholders', () => {
    mockHook.current = { ...mockHook.current, isLoading: true };
    const { container } = renderCmp();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(2);
    mockHook.current = { ...mockHook.current, isLoading: false };
  });

  it('renders the 3 KPI tiles (Total / En attente / En retard)', () => {
    renderCmp();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it('renders the empty table message when no depenses', () => {
    mockHook.current = { ...mockHook.current, depenses: [] };
    renderCmp();
    expect(screen.getByText('Aucune dépense trouvée')).toBeInTheDocument();
  });
});
