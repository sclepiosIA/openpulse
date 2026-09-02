import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockAnalytics = { current: { data: null, isLoading: true } as any };
const mockKpis = { current: { data: null, isLoading: true } as any };

vi.mock('@/hooks/hr/useRHAnalytics', () => ({
  useRHAnalytics: () => mockAnalytics.current,
}));
vi.mock('@/hooks/hr/useRHKPIs', () => ({
  useRHKPIs: () => mockKpis.current,
}));

import { RHKPIsEnriched } from '../RHKPIsEnriched';

const renderCmp = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RHKPIsEnriched />
    </QueryClientProvider>
  );
};

describe('RHKPIsEnriched', () => {
  it('renders 6 skeleton cards when either query is loading', () => {
    mockAnalytics.current = { data: null, isLoading: true };
    mockKpis.current = { data: null, isLoading: true };
    const { container } = renderCmp();
    // StatsSkeleton count={6} → 6 CardSkeleton each with multiple <Skeleton> (bg-muted)
    expect(container.querySelectorAll('.bg-muted').length).toBeGreaterThanOrEqual(6);
  });

  it('renders the empty state when finished loading without data', () => {
    mockAnalytics.current = { data: null, isLoading: false };
    mockKpis.current = { data: null, isLoading: false };
    renderCmp();
    expect(
      screen.getByText("Aucune donnée disponible pour l'analyse RH")
    ).toBeInTheDocument();
  });

});
