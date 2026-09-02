import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockHook = {
  current: {
    revenus: [] as any[],
    isLoading: false,
    createRevenu: vi.fn(),
    updateRevenu: vi.fn(),
    marquerFacture: vi.fn(),
    marquerPaye: vi.fn(),
    isCreating: false,
    isUpdating: false,
  },
};

vi.mock('@/hooks/tresorerie/useTresorerieRevenus', () => ({
  useTresorerieRevenus: () => mockHook.current,
}));

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: [], isLoading: false }),
}));

import { RevenusPrevisionnels } from '../RevenusPrevisionnels';

const renderCmp = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RevenusPrevisionnels />
    </QueryClientProvider>
  );
};

describe('RevenusPrevisionnels', () => {
  it('renders loading state with 2 animate-pulse placeholders', () => {
    mockHook.current = { ...mockHook.current, isLoading: true };
    const { container } = renderCmp();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(2);
    mockHook.current = { ...mockHook.current, isLoading: false };
  });

  it('renders the 2 KPI tiles (Total prévu / À facturer)', () => {
    renderCmp();
    expect(screen.getByText('Total prévu')).toBeInTheDocument();
    expect(screen.getByText('À facturer')).toBeInTheDocument();
  });

  it('renders the empty table message when no revenus', () => {
    mockHook.current = { ...mockHook.current, revenus: [] };
    renderCmp();
    expect(screen.getByText('Aucun revenu prévisionnel trouvé')).toBeInTheDocument();
  });
});
