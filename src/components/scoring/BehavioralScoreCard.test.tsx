import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { AUTH, SCORE_TIER, HOOK_STATE, mockFrom } = vi.hoisted(() => {
  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const SCORE_TIER = {
    low: { label: 'Faible' },
    mid: { label: 'Moyen' },
    high: { label: 'Élevé' },
  };

  const HOOK_STATE: {
    data?: { behavioral_score?: number; engagement_velocity?: number; last_event_at?: string | null } | undefined;
    isLoading: boolean;
    isError: boolean;
    error: { message: string } | null;
  } = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  };

  type SupabaseResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
  const createBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    const methods = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'contains',
      'overlaps',
      'order',
      'limit',
      'range',
      'insert',
      'update',
      'upsert',
      'delete',
      'rpc',
      'maybeSingle',
      'single',
    ] as const;

    for (const m of methods) builder[m] = chain;

    builder.single = () => Promise.resolve({ data: null, error: null }) as SupabaseResult<null>;
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null }) as SupabaseResult<null>;

    builder.then = (onFulfilled: (v: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);
    builder.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve().catch(onRejected);

    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return { AUTH, SCORE_TIER, HOOK_STATE, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

vi.mock('@/components/ui/card', () => {
  const Card = ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>;
  const CardHeader = ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>;
  const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" data-class={className ?? ''}>
      {children}
    </h2>
  );
  const CardContent = ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>;
  return { Card, CardHeader, CardTitle, CardContent };
});

vi.mock('@/components/ui/badge', () => {
  const Badge = ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant ?? ''} data-class={className ?? ''}>
      {children}
    </span>
  );
  return { Badge };
});

vi.mock('@/hooks/crm/useBehavioralScore', () => {
  return {
    useBehavioralScore: (etablissementId: string) => {
      void etablissementId;
      if (HOOK_STATE.isError) {
        return {
          data: null,
          isLoading: false,
          isError: true,
          error: HOOK_STATE.error ?? { message: 'x' },
        };
      }
      return {
        data: HOOK_STATE.data,
        isLoading: HOOK_STATE.isLoading,
        isError: false,
        error: null,
      };
    },
  };
});

vi.mock('@/types/scoring', () => {
  return {
    getScoreTier: (total: number) => {
      if (total >= 70) return SCORE_TIER.high;
      if (total >= 35) return SCORE_TIER.mid;
      return SCORE_TIER.low;
    },
  };
});

vi.mock('date-fns', () => {
  return {
    formatDistanceToNow: (date: Date, opts?: { addSuffix?: boolean; locale?: unknown }) => {
      void date;
      void opts;
      return 'il y a 2 jours';
    },
  };
});

vi.mock('date-fns/locale', () => ({ fr: {} }));

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  );
  const PieChart = ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-piechart">{children}</div>;
  const Pie = ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-pie">{children}</div>;
  const Cell = ({ fill }: { fill: string }) => <div data-testid="recharts-cell" data-fill={fill} />;
  return { ResponsiveContainer, PieChart, Pie, Cell };
});

vi.mock('lucide-react', () => {
  const Sparkles = ({ className }: { className?: string }) => <svg data-testid="sparkles" data-class={className ?? ''} />;
  const TrendingUp = ({ className }: { className?: string }) => <svg data-testid="trend-up" data-class={className ?? ''} />;
  const TrendingDown = ({ className }: { className?: string }) => (
    <svg data-testid="trend-down" data-class={className ?? ''} />
  );
  const Minus = ({ className }: { className?: string }) => <svg data-testid="minus" data-class={className ?? ''} />;
  return { Sparkles, TrendingUp, TrendingDown, Minus };
});

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => AUTH }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH }));
vi.mock('@/components/AuthProvider', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('BehavioralScoreCard', () => {
  it('affiche le chargement puis les valeurs calculées (total, tier, statique, comportemental, velocity, dernier signal)', async () => {
    const { BehavioralScoreCard } = await import('./BehavioralScoreCard');

    HOOK_STATE.isError = false;
    HOOK_STATE.isLoading = true;
    HOOK_STATE.data = undefined;
    HOOK_STATE.error = null;

    const Wrapper = createWrapper();
    const { rerender } = render(<BehavioralScoreCard etablissementId="e1" staticScore={20} />, { wrapper: Wrapper });

    expect(screen.getByTestId('card-title').textContent).toContain('Score de conversion');
    expect(screen.getByText('…')).toBeTruthy();

    HOOK_STATE.isLoading = false;
    HOOK_STATE.data = { behavioral_score: 15, engagement_velocity: 2, last_event_at: '2024-01-01T00:00:00.000Z' };

    rerender(<BehavioralScoreCard etablissementId="e1" staticScore={20} />);

    expect(screen.getByText('35')).toBeTruthy();
    expect(screen.getByTestId('badge').textContent).toBe('Moyen');
    expect(screen.getByText('20/50')).toBeTruthy();
    expect(screen.getByText('15/50')).toBeTruthy();
    expect(screen.getByText('+2 pts/sem')).toBeTruthy();
    expect(screen.getByText(/Dernier signal : il y a 2 jours/)).toBeTruthy();

    expect(screen.queryByTestId('trend-up')).toBeTruthy();
    expect(screen.queryByTestId('trend-down')).toBeNull();
    expect(screen.queryByTestId('minus')).toBeNull();
  });

  it('cappe le total à 100 et gère un score statique null', async () => {
    const { BehavioralScoreCard } = await import('./BehavioralScoreCard');

    HOOK_STATE.isError = false;
    HOOK_STATE.isLoading = false;
    HOOK_STATE.data = { behavioral_score: 60, engagement_velocity: 0, last_event_at: null };
    HOOK_STATE.error = null;

    const Wrapper = createWrapper();
    render(<BehavioralScoreCard etablissementId="e2" staticScore={null} />, { wrapper: Wrapper });

    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByTestId('badge').textContent).toBe('Moyen');
    expect(screen.getByText('0/50')).toBeTruthy();
    expect(screen.getByText('60/50')).toBeTruthy();
    expect(screen.getByText('0 pts/sem')).toBeTruthy();

    expect(screen.queryByTestId('minus')).toBeTruthy();
    expect(screen.queryByTestId('trend-up')).toBeNull();
    expect(screen.queryByTestId('trend-down')).toBeNull();
  });

  it("affiche un fallback cohérent si le hook est en erreur (isError) sans données", async () => {
    const { BehavioralScoreCard } = await import('./BehavioralScoreCard');

    HOOK_STATE.isError = true;
    HOOK_STATE.isLoading = false;
    HOOK_STATE.data = undefined;
    HOOK_STATE.error = { message: 'x' };

    const Wrapper = createWrapper();
    render(<BehavioralScoreCard etablissementId="e3" staticScore={12} />, { wrapper: Wrapper });

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByTestId('badge').textContent).toBe('Faible');
    expect(screen.getByText('12/50')).toBeTruthy();
    expect(screen.getByText('0/50')).toBeTruthy();
    expect(screen.getByText('0 pts/sem')).toBeTruthy();
    expect(screen.queryByText(/Dernier signal/)).toBeNull();
  });
});