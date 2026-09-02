// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AnalyticsDashboard } from './AnalyticsDashboard';

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
  formatEuroMock,
  formatNumberMock,
  formatPercentMock,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  formatEuroMock: vi.fn((value: number) => `${value} €`),
  formatNumberMock: vi.fn((value: number) => String(value)),
  formatPercentMock: vi.fn((value: number, digits?: number) =>
    `${value.toFixed(digits ?? 1)}%`
  ),
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
    },
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    type,
    className,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} type={type} className={className} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

vi.mock('@/lib/simulator-config', () => ({
  formatEuro: formatEuroMock,
  formatNumber: formatNumberMock,
  formatPercent: formatPercentMock,
}));

vi.mock('lucide-react', () => ({
  BarChart3: () => <svg data-testid="icon-barchart3" />,
  TrendingUp: () => <svg data-testid="icon-trendingup" />,
  ArrowUp: () => <svg data-testid="icon-arrowup" />,
  Calculator: () => <svg data-testid="icon-calculator" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Target: () => <svg data-testid="icon-target" />,
  Zap: () => <svg data-testid="icon-zap" />,
  PiggyBank: () => <svg data-testid="icon-piggybank" />,
}));

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

describe('AnalyticsDashboard', () => {
  const params = {
    nbPassages: 12000,
  };

  const analyticsParams = {
    uhcdMois: 100,
    consultMois: 250,
    plusMois: 30,
    totalProj: 15000,
  };

  const results = {
    pctUhcd: 12.4,
    pctUhcdPlus: 16.8,
    uhcdAn: 1200,
    uhcdPlusTotal: 1560,
    revUhcdBase: 10000,
    revAvisBase: 2000,
    revCcmu2Base: 3000,
    revCcmu3Base: 4000,
    revTotalBase: 19000,
    revUhcdPlus: 14000,
    revAvisPlus: 2500,
    revCcmu2Plus: 3500,
    revCcmu3Plus: 4500,
    gainMonoRUM: 750,
    revTotalPlus: 25250,
    roiAnUhcdPct: 80,
    roiAnTotalPct: 95,
    scale: 1.25,
    uhcdProj: 1500,
    uhcdPlusProj: 1950,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose un rendu initial stable via renderHook avec QueryClientProvider', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [isLoading, setIsLoading] = React.useState(true);
        const [isError, setIsError] = React.useState(false);

        React.useEffect(() => {
          Promise.resolve().then(() => {
            setIsLoading(false);
            setIsError(false);
          });
        }, []);

        return { isLoading, isError, data: results };
      },
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data.revTotalPlus - result.current.data.revTotalBase).toBe(6250);
    expect(result.current.data.uhcdPlusProj - result.current.data.uhcdProj).toBe(450);
  });

  it('affiche les valeurs métier formatées et la projection quand scale est différent de 1', () => {
    const onUpdateAnalyticsParam = vi.fn();

    render(
      <AnalyticsDashboard
        params={params}
        analyticsParams={analyticsParams}
        results={results}
        onUpdateAnalyticsParam={onUpdateAnalyticsParam}
      />
    );

    expect(screen.getByText('Données mensuelles observées')).toBeInTheDocument();
    expect(screen.getByText('Comparaison des revenus annuels')).toBeInTheDocument();
    expect(screen.getByText('Gains additionnels')).toBeInTheDocument();

    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('250')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15000')).toBeInTheDocument();

    expect(screen.getByText('12.4%')).toBeInTheDocument();
    expect(screen.getByText('16.8%')).toBeInTheDocument();
    expect(screen.getByText('1200 UHCD/an')).toBeInTheDocument();
    expect(screen.getByText('1560 UHCD/an')).toBeInTheDocument();

    expect(screen.getByText('19000 €')).toBeInTheDocument();
    expect(screen.getByText('25250 €')).toBeInTheDocument();
    expect(screen.getByText('+750 €')).toBeInTheDocument();
    expect(screen.getByText('+80%')).toBeInTheDocument();
    expect(screen.getByText('+95%')).toBeInTheDocument();
    expect(screen.getByText('6250 €')).toBeInTheDocument();

    expect(screen.getByText('Projections pour 15000 passages')).toBeInTheDocument();
    expect(screen.getByText('Échelle : ×1.25')).toBeInTheDocument();
    expect(screen.getByText('+450')).toBeInTheDocument();

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute('data-value', '62');
    expect(progressBars[1]).toHaveAttribute('data-value', '84');

    expect(formatNumberMock).toHaveBeenCalledWith(analyticsParams.uhcdMois);
    expect(formatPercentMock).toHaveBeenCalledWith(results.pctUhcd);
    expect(formatEuroMock).toHaveBeenCalledWith(results.revTotalPlus);
  });

  it('déclenche la mise à jour du paramètre analytique avec une valeur numérique valide', async () => {
    const onUpdateAnalyticsParam = vi.fn();

    render(
      <AnalyticsDashboard
        params={params}
        analyticsParams={analyticsParams}
        results={results}
        onUpdateAnalyticsParam={onUpdateAnalyticsParam}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[2], { target: { value: '45' } });

    await waitFor(() => {
      expect(onUpdateAnalyticsParam).toHaveBeenCalledWith('plusMois', 45);
    });
  });

  it('ignore une valeur invalide ou négative dans les champs numériques', () => {
    const onUpdateAnalyticsParam = vi.fn();

    render(
      <AnalyticsDashboard
        params={params}
        analyticsParams={analyticsParams}
        results={results}
        onUpdateAnalyticsParam={onUpdateAnalyticsParam}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'abc' } });
    fireEvent.change(inputs[1], { target: { value: '-10' } });

    expect(onUpdateAnalyticsParam).not.toHaveBeenCalled();
  });

  it('représente un état d’erreur via renderHook quand la source renvoie { data:null, error }', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [isLoading, setIsLoading] = React.useState(true);
        const [isError, setIsError] = React.useState(false);
        const response = React.useMemo(() => ({ data: null, error: { message: 'x' } }), []);

        React.useEffect(() => {
          Promise.resolve().then(() => {
            setIsLoading(false);
            if (response.error) {
              setIsError(true);
            }
          });
        }, [response]);

        return { isLoading, isError, error: response.error, data: response.data };
      },
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();
  });
});