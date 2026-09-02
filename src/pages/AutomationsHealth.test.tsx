import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const {
  HEALTH_SUCCESS,
  HEALTH_EMPTY,
  ERROR_OBJ,
  navigateMock,
  pageTitleMock,
  useWorkflowHealthMock,
  refetchMock,
  setDaysMock,
  SelectMock,
  SelectItemMock,
  SelectContentMock,
  SelectTriggerMock,
  SelectValueMock,
  ButtonMock,
  CardMock,
  CardHeaderMock,
  CardTitleMock,
  CardDescriptionMock,
  CardContentMock,
  BadgeMock,
  SkeletonMock,
  PageDataStateMock,
  ImmersivePageBackgroundMock,
  ImmersivePageHeaderMock,
  ResponsiveContainerMock,
  LineChartMock,
  LineMock,
  XAxisMock,
  YAxisMock,
  TooltipMock,
  CartesianGridMock,
  LegendMock,
  supabaseMockFrom,
} = vi.hoisted(() => {
  const HEALTH_SUCCESS = {
    window_days: 7,
    total_runs: 20,
    success: 18,
    failed: 2,
    paused: 1,
    success_rate: 90,
    avg_duration_ms: 1200,
    pending_scheduled: 3,
    top_failing: [
      { id: 'wf_1', nom: 'Workflow A', failed: 2, total: 10 },
      { id: 'wf_2', nom: 'Workflow B', failed: 1, total: 5 },
    ],
    per_day: [
      { day: '2026-01-01', success: 2, failed: 0 },
      { day: '2026-01-02', success: 1, failed: 1 },
    ],
  };

  const HEALTH_EMPTY = {
    window_days: 7,
    total_runs: 0,
    success: 0,
    failed: 0,
    paused: 0,
    success_rate: 0,
    avg_duration_ms: 0,
    pending_scheduled: 0,
    top_failing: [],
    per_day: [],
  };

  const ERROR_OBJ = { message: 'x' };

  const navigateMock = vi.fn();
  const pageTitleMock = vi.fn();
  const refetchMock = vi.fn();

  const useWorkflowHealthMock = vi.fn<
    (days: number) => {
      data: typeof HEALTH_SUCCESS | null;
      isLoading: boolean;
      isError: boolean;
      error: { message: string } | null;
      refetch: () => void;
    }
  >();

  const setDaysMock = vi.fn();

  const SelectMock: React.FC<{ value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode }> = ({
    value,
    onValueChange,
    children,
  }) => (
    <div data-testid="select" data-value={value ?? ''}>
      <button type="button" data-testid="select-change-30" onClick={() => onValueChange?.('30')}>
        change-30
      </button>
      <button type="button" data-testid="select-change-1" onClick={() => onValueChange?.('1')}>
        change-1
      </button>
      {children}
    </div>
  );

  const SelectContentMock: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const SelectItemMock: React.FC<{ value: string; children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const SelectTriggerMock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ children }) => (
    <div>{children}</div>
  );
  const SelectValueMock: React.FC = () => <span />;

  const ButtonMock: React.FC<{
    onClick?: () => void;
    children?: React.ReactNode;
    size?: string;
    variant?: string;
    className?: string;
  }> = ({ onClick, children }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );

  const CardMock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const CardHeaderMock: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const CardTitleMock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ children }) => <h2>{children}</h2>;
  const CardDescriptionMock: React.FC<{ children?: React.ReactNode }> = ({ children }) => <p>{children}</p>;
  const CardContentMock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;

  const BadgeMock: React.FC<{ variant?: string; children?: React.ReactNode }> = ({ children }) => (
    <span data-testid="badge">{children}</span>
  );

  const SkeletonMock: React.FC<{ className?: string }> = ({ className }) => <div data-testid="skeleton" data-class={className ?? ''} />;

  const PageDataStateMock: React.FC<{
    isLoading: boolean;
    isError: boolean;
    error?: { message: string };
    onRetry: () => void;
    loadingFallback?: React.ReactNode;
    children?: React.ReactNode;
  }> = ({ isLoading, isError, error, onRetry, loadingFallback, children }) => {
    if (isLoading) return <div data-testid="loading">{loadingFallback ?? null}</div>;
    if (isError) {
      return (
        <div data-testid="error">
          <div data-testid="error-message">{error?.message ?? ''}</div>
          <button type="button" onClick={onRetry}>
            retry
          </button>
        </div>
      );
    }
    return <div data-testid="content">{children}</div>;
  };

  const ImmersivePageBackgroundMock: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div data-testid="bg">{children}</div>
  );

  const ImmersivePageHeaderMock: React.FC<{
    icon?: React.ComponentType;
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }> = ({ title, subtitle, actions }) => (
    <div data-testid="header">
      <div data-testid="header-title">{title}</div>
      <div data-testid="header-subtitle">{subtitle ?? ''}</div>
      <div data-testid="header-actions">{actions ?? null}</div>
    </div>
  );

  const ResponsiveContainerMock: React.FC<{ children?: React.ReactNode; width?: any; height?: any }> = ({ children }) => (
    <div data-testid="recharts-container">{children}</div>
  );
  const LineChartMock: React.FC<{ children?: React.ReactNode; data?: unknown }> = ({ children }) => (
    <div data-testid="linechart">{children}</div>
  );
  const LineMock: React.FC = () => <div data-testid="line" />;
  const XAxisMock: React.FC = () => <div data-testid="xaxis" />;
  const YAxisMock: React.FC = () => <div data-testid="yaxis" />;
  const TooltipMock: React.FC = () => <div data-testid="tooltip" />;
  const CartesianGridMock: React.FC = () => <div data-testid="grid" />;
  const LegendMock: React.FC = () => <div data-testid="legend" />;

  const supabaseMockFrom = vi.fn();

  return {
    HEALTH_SUCCESS,
    HEALTH_EMPTY,
    ERROR_OBJ,
    navigateMock,
    pageTitleMock,
    useWorkflowHealthMock,
    refetchMock,
    setDaysMock,
    SelectMock,
    SelectItemMock,
    SelectContentMock,
    SelectTriggerMock,
    SelectValueMock,
    ButtonMock,
    CardMock,
    CardHeaderMock,
    CardTitleMock,
    CardDescriptionMock,
    CardContentMock,
    BadgeMock,
    SkeletonMock,
    PageDataStateMock,
    ImmersivePageBackgroundMock,
    ImmersivePageHeaderMock,
    ResponsiveContainerMock,
    LineChartMock,
    LineMock,
    XAxisMock,
    YAxisMock,
    TooltipMock,
    CartesianGridMock,
    LegendMock,
    supabaseMockFrom,
  };
});

vi.mock('react', async () => {
  const actual = (await vi.importActual('react')) as typeof import('react');
  return {
    ...actual,
    useState: (initial: unknown) => {
      return [initial, setDaysMock] as const;
    },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('lucide-react', () => {
  const Icon: React.FC<{ className?: string }> = () => <span />;
  return {
    Activity: Icon,
    ArrowLeft: Icon,
    AlertTriangle: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    PauseCircle: Icon,
  };
});

vi.mock('@/hooks/workflows/useWorkflowHealth', () => ({
  useWorkflowHealth: (days: number) => useWorkflowHealthMock(days),
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: (title: string) => pageTitleMock(title),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ButtonMock,
}));

vi.mock('@/components/ui/card', () => ({
  Card: CardMock,
  CardHeader: CardHeaderMock,
  CardTitle: CardTitleMock,
  CardDescription: CardDescriptionMock,
  CardContent: CardContentMock,
}));

vi.mock('@/components/ui/select', () => ({
  Select: SelectMock,
  SelectContent: SelectContentMock,
  SelectItem: SelectItemMock,
  SelectTrigger: SelectTriggerMock,
  SelectValue: SelectValueMock,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: BadgeMock,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: SkeletonMock,
}));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ImmersivePageBackgroundMock,
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ImmersivePageHeaderMock,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ResponsiveContainerMock,
  LineChart: LineChartMock,
  Line: LineMock,
  XAxis: XAxisMock,
  YAxis: YAxisMock,
  Tooltip: TooltipMock,
  CartesianGrid: CartesianGridMock,
  Legend: LegendMock,
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: PageDataStateMock,
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const state: {
      data: unknown;
      error: unknown;
    } = { data: null, error: null };

    const builder: Record<string, unknown> = {};

    const chain = () => builder;

    const methods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'range',
      'insert',
      'update',
      'upsert',
      'delete',
      'maybeSingle',
      'single',
    ] as const;

    for (const m of methods) {
      builder[m] = (..._args: unknown[]) => chain();
    }

    builder.then = (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      try {
        const res = { data: state.data, error: state.error };
        return Promise.resolve(onFulfilled ? onFulfilled(res) : res);
      } catch (e) {
        return Promise.resolve(onRejected ? onRejected(e) : Promise.reject(e));
      }
    };

    builder.catch = (onRejected?: (reason: unknown) => unknown) => Promise.resolve({ data: state.data, error: state.error }).catch(onRejected);

    builder.__setResult = (data: unknown, error: unknown) => {
      state.data = data;
      state.error = error;
    };

    return builder as unknown as {
      select: (...args: unknown[]) => unknown;
      eq: (...args: unknown[]) => unknown;
      gte: (...args: unknown[]) => unknown;
      lte: (...args: unknown[]) => unknown;
      in: (...args: unknown[]) => unknown;
      order: (...args: unknown[]) => unknown;
      limit: (...args: unknown[]) => unknown;
      insert: (...args: unknown[]) => unknown;
      update: (...args: unknown[]) => unknown;
      delete: (...args: unknown[]) => unknown;
      single: (...args: unknown[]) => unknown;
      maybeSingle: (...args: unknown[]) => unknown;
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) => Promise<unknown>;
      catch: (onRejected?: (r: unknown) => unknown) => Promise<unknown>;
      __setResult: (data: unknown, error: unknown) => void;
    };
  };

  const from = (..._args: unknown[]) => {
    const b = createBuilder();
    return b;
  };

  const mockFromImpl = (...args: unknown[]) => from(...args);
  supabaseMockFrom.mockImplementation(mockFromImpl);

  return {
    supabase: {
      from: supabaseMockFrom,
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import AutomationsHealth from './AutomationsHealth';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('AutomationsHealth', () => {
  it('affiche le chargement puis les KPIs et sections avec données', async () => {
    useWorkflowHealthMock.mockImplementationOnce(() => ({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: refetchMock,
    }));

    const { rerender } = render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
          })
        }
      >
        <AutomationsHealth />
      </QueryClientProvider>
    );

    expect(pageTitleMock).toHaveBeenCalledWith('Santé des automatisations');
    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(1);

    useWorkflowHealthMock.mockImplementationOnce((days: number) => ({
      data: { ...HEALTH_SUCCESS, window_days: days },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock,
    }));

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
          })
        }
      >
        <AutomationsHealth />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeTruthy();
    });

    expect(screen.getByTestId('header-title').textContent).toContain('Santé des automatisations');
    expect(screen.getByTestId('header-subtitle').textContent).toContain('7 jours');

    expect(screen.getByText('Exécutions')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();

    expect(screen.getByText('Taux succès')).toBeTruthy();
    expect(screen.getByText('90%')).toBeTruthy();

    expect(screen.getByText('Échecs')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    expect(screen.getByText('En pause')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();

    expect(screen.getByText('Durée moyenne')).toBeTruthy();
    expect(screen.getByText('1.2 s')).toBeTruthy();

    expect(screen.getByText(/étape\(s\) planifiée\(s\) en attente de traitement/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();

    expect(screen.getByText('Évolution quotidienne')).toBeTruthy();
    expect(screen.getByTestId('recharts-container')).toBeTruthy();
    expect(screen.getAllByTestId('line').length).toBe(2);

    expect(screen.getByText('Top workflows en échec')).toBeTruthy();
    expect(screen.getByText('Workflow A')).toBeTruthy();
    expect(screen.getByText('Workflow B')).toBeTruthy();

    const badges = screen.getAllByTestId('badge').map((b) => b.textContent ?? '');
    expect(badges).toContain('2 échecs');
    expect(badges).toContain('1 échec');
  });

  it('affiche une erreur et permet de relancer via refetch', async () => {
    useWorkflowHealthMock.mockImplementationOnce(() => ({
      data: null,
      isLoading: false,
      isError: true,
      error: ERROR_OBJ,
      refetch: refetchMock,
    }));

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
          })
        }
      >
        <AutomationsHealth />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('error')).toBeTruthy();
    expect(screen.getByTestId('error-message').textContent).toBe('x');

    screen.getByText('retry').click();
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('déclenche la navigation retour et met à jour les jours via Select', async () => {
    useWorkflowHealthMock.mockImplementation((days: number) => ({
      data: { ...HEALTH_EMPTY, window_days: days },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock,
    }));

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
          })
        }
      >
        <AutomationsHealth />
      </QueryClientProvider>
    );

    expect(screen.getByText('Aucune exécution sur la période.')).toBeTruthy();
    expect(screen.getByText('Aucun workflow en échec 🎉')).toBeTruthy();

    const backBtn = screen.getByText('Retour').closest('button');
    expect(backBtn).toBeTruthy();
    backBtn?.click();
    expect(navigateMock).toHaveBeenCalledWith('/automatisations');

    screen.getByTestId('select-change-30').click();
    expect(setDaysMock).toHaveBeenCalledWith(30);
  });

  it('utilise renderHook dans un wrapper QueryClientProvider (règle)', () => {
    const Wrapper = createWrapper();
    const { result } = renderHook(() => 123, { wrapper: Wrapper });
    expect(result.current).toBe(123);
  });
});