import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockHook = {
  current: {
    tree: [] as any[],
    revenueTree: [] as any[],
    months: ['2026-06'],
    currentMonth: '2026-06',
    grandTotal: { '2026-06': 0 },
    grandTotalAll: 0,
    grandTransactions: { '2026-06': 0 },
    revenueGrandTotal: { '2026-06': 0 },
    revenueGrandTotalAll: 0,
    revenueGrandTransactions: { '2026-06': 0 },
    solde: { '2026-06': 0 },
    soldeCumule: { '2026-06': 0 },
    isLoading: true,
  } as any,
};

vi.mock('@/hooks/tresorerie/useTresorerieDepensesParCategorie', () => ({
  useTresorerieDepensesParCategorie: () => mockHook.current,
}));

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { TresorerieAnalyseTab } from '../../TresorerieAnalyseTab';

const renderCmp = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TresorerieAnalyseTab />
    </QueryClientProvider>
  );
};

describe('TresorerieAnalyseTab', () => {
  it('renders loading spinner when isLoading=true', () => {
    mockHook.current = { ...mockHook.current, isLoading: true };
    const { container } = renderCmp();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders the main spreadsheet title and the 3 chart titles when not loading', () => {
    mockHook.current = { ...mockHook.current, isLoading: false };
    renderCmp();
    expect(
      screen.getByText('Trésorerie prévisionnelle par catégorie')
    ).toBeInTheDocument();
    expect(screen.getByText('Dépenses par catégorie')).toBeInTheDocument();
    expect(screen.getByText('Recettes par catégorie')).toBeInTheDocument();
    expect(screen.getByText('Solde cumulé')).toBeInTheDocument();
  });
});
