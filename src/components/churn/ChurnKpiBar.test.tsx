import React from 'react';
import { render, screen, within, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { MockCard, MockCardContent, MockSkeleton } = vi.hoisted(() => ({
  MockCard: (props: React.PropsWithChildren<{ className?: string }>) => <div data-testid="card" className={props.className}>{props.children}</div>,
  MockCardContent: (props: React.PropsWithChildren<{ className?: string }>) => <div data-testid="card-content" className={props.className}>{props.children}</div>,
  MockSkeleton: (props: { className?: string }) => <div data-testid="skeleton" className={props.className} />
}));

const { ROWS, mockFrom, builder } = vi.hoisted(() => {
  const ROWS = [{ id: '1' }];
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: ROWS[0], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: ROWS[0], error: null }),
    then: (res: (v: any) => any, rej?: (e: any) => any) => Promise.resolve({ data: ROWS, error: null }).then(res, rej),
    catch: (rej: (e: any) => any) => Promise.resolve({ data: ROWS, error: null }).catch(rej),
  };
  const mockFrom = vi.fn().mockReturnValue(builder);
  return { ROWS, mockFrom, builder };
});

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
  CardContent: MockCardContent,
}));
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: MockSkeleton,
}));
vi.mock('@/hooks/csm/useChurnPredictions', () => ({}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

import { ChurnKpiBar } from './ChurnKpiBar';

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const client = createClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function getHookWrapper() {
  const client = createClient();
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('ChurnKpiBar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders loading state with skeletons for each card', () => {
    renderWithProviders(
      <ChurnKpiBar
        kpis={{ total: 10, critical: 2, high: 3, medium: 4 }}
        prev={{ total: 8, critical: 2, high: 3, medium: 4 }}
        mrrAtRisk={500}
        loading
      />
    );
    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBe(5);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(5);
  });

  it('renders formatted values and correct delta badges with inversion logic', () => {
    renderWithProviders(
      <ChurnKpiBar
        kpis={{ total: 987, critical: 10, high: 20, medium: 30 }}
        prev={{ total: 900, critical: 12, high: 20, medium: 40 }}
        mrrAtRisk={999}
        loading={false}
      />
    );

    const totalCard = screen.getByText('Total analysé').closest('[data-testid="card"]') as HTMLElement;
    expect(totalCard).toBeTruthy();
    expect(within(totalCard).getByText('987')).toBeTruthy();
    const totalDelta = within(totalCard).getByText('+87');
    expect(totalDelta).toBeTruthy();
    expect(totalDelta.className).toContain('text-emerald-600');

    const criticalCard = screen.getByText('🔴 Critique (75+)').closest('[data-testid="card"]') as HTMLElement;
    expect(criticalCard).toBeTruthy();
    expect(within(criticalCard).getByText('10')).toBeTruthy();
    const criticalDelta = within(criticalCard).getByText('-2');
    expect(criticalDelta).toBeTruthy();
    expect(criticalDelta.className).toContain('text-emerald-600');

    const highCard = screen.getByText('🟠 Élevé (50-74)').closest('[data-testid="card"]') as HTMLElement;
    expect(highCard).toBeTruthy();
    expect(within(highCard).getByText('20')).toBeTruthy();
    const highDelta = within(highCard).getByText('0');
    expect(highDelta).toBeTruthy();
    expect(highDelta.className).toContain('text-muted-foreground');

    const mediumCard = screen.getByText('🟡 Modéré (25-49)').closest('[data-testid="card"]') as HTMLElement;
    expect(mediumCard).toBeTruthy();
    expect(within(mediumCard).getByText('30')).toBeTruthy();
    const mediumDelta = within(mediumCard).getByText('-10');
    expect(mediumDelta).toBeTruthy();
    expect(mediumDelta.className).toContain('text-emerald-600');

    const mrrCard = screen.getByText('💰 MRR à risque').closest('[data-testid="card"]') as HTMLElement;
    expect(mrrCard).toBeTruthy();
    expect(within(mrrCard).getByText(/999/)).toBeTruthy();
    expect(within(mrrCard).getByText(/€/)).toBeTruthy();
    expect(within(mrrCard).queryByText(/\+\d+/)).toBeNull();
    expect(within(mrrCard).queryByText(/-\d+/)).toBeNull();
  });

  it('renders negative delta as red when invert is false', () => {
    renderWithProviders(
      <ChurnKpiBar
        kpis={{ total: 800, critical: 10, high: 20, medium: 30 }}
        prev={{ total: 900, critical: 10, high: 20, medium: 30 }}
        mrrAtRisk={0}
        loading={false}
      />
    );

    const totalCard = screen.getByText('Total analysé').closest('[data-testid="card"]') as HTMLElement;
    expect(totalCard).toBeTruthy();
    const totalDelta = within(totalCard).getByText('-100');
    expect(totalDelta).toBeTruthy();
    expect(totalDelta.className).toContain('text-red-500');
  });

  it('provides a proper QueryClientProvider wrapper for hooks (sanity)', () => {
    const Wrapper = getHookWrapper();
    const { result } = renderHook(() => 42, { wrapper: Wrapper });
    expect(result.current).toBe(42);
  });
});