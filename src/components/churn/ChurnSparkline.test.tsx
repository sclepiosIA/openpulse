import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChurnSparkline } from './ChurnSparkline';

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
  responsiveContainerSpy,
  areaChartSpy,
  areaSpy,
  tooltipSpy,
  skeletonSpy,
  churnHistorySpy,
} = vi.hoisted(() => {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => builder),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    responsiveContainerSpy: vi.fn(),
    areaChartSpy: vi.fn(),
    areaSpy: vi.fn(),
    tooltipSpy: vi.fn(),
    skeletonSpy: vi.fn(),
    churnHistorySpy: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => {
    skeletonSpy(props);
    return <div data-testid="skeleton" {...props} />;
  },
}));

vi.mock('@/hooks/csm/useChurnPredictions', () => ({
  useChurnHistory: (...args: [string, number]) => churnHistorySpy(...args),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({
    children,
    width,
    height,
  }: {
    children: React.ReactNode;
    width: string | number;
    height: string | number;
  }) => {
    responsiveContainerSpy({ width, height });
    return (
      <div data-testid="responsive-container" data-width={String(width)} data-height={String(height)}>
        {children}
      </div>
    );
  },
  AreaChart: ({
    children,
    data,
    margin,
  }: {
    children: React.ReactNode;
    data: Array<{ label: string; score: number }>;
    margin: { top: number; right: number; bottom: number; left: number };
  }) => {
    areaChartSpy({ data, margin });
    return <div data-testid="area-chart">{children}</div>;
  },
  Area: (props: {
    type: string;
    dataKey: string;
    stroke: string;
    strokeWidth: number;
    fill: string;
  }) => {
    areaSpy(props);
    return <div data-testid="area" />;
  },
  Tooltip: (props: {
    contentStyle: Record<string, unknown>;
    formatter: (v: unknown) => [string, string];
  }) => {
    tooltipSpy(props);
    return <div data-testid="tooltip" />;
  },
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

describe('ChurnSparkline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un skeleton pendant le chargement avec la hauteur fournie', () => {
    churnHistorySpy.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<ChurnSparkline etablissementId="eta-1" height={120} />, { wrapper: createWrapper() });

    expect(churnHistorySpy).toHaveBeenCalledWith('eta-1', 90);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(skeletonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'w-full',
        style: { height: 120 },
      }),
    );
    expect(screen.queryByText("Pas d'historique")).not.toBeInTheDocument();
  });

  it("affiche le message d'absence d'historique quand la liste est vide", () => {
    churnHistorySpy.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<ChurnSparkline etablissementId="eta-empty" days={30} height={70} />, { wrapper: createWrapper() });

    expect(churnHistorySpy).toHaveBeenCalledWith('eta-empty', 30);
    expect(screen.getByText("Pas d'historique")).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('transforme les données métier et configure le graphique correctement', () => {
    churnHistorySpy.mockReturnValue({
      data: [
        { day: '2024-01-05', score: '42.5' },
        { day: '2024-02-10', score: 87 },
      ],
      isLoading: false,
    });

    render(<ChurnSparkline etablissementId="eta-chart" days={60} height={88} />, { wrapper: createWrapper() });

    expect(churnHistorySpy).toHaveBeenCalledWith('eta-chart', 60);
    expect(screen.getByTestId('responsive-container')).toHaveAttribute('data-width', '100%');
    expect(screen.getByTestId('responsive-container')).toHaveAttribute('data-height', '88');

    expect(areaChartSpy).toHaveBeenCalledWith({
      data: [
        { label: '05 janv.', score: 42.5 },
        { label: '10 févr.', score: 87 },
      ],
      margin: { top: 4, right: 0, bottom: 0, left: 0 },
    });

    expect(areaSpy).toHaveBeenCalledWith({
      type: 'monotone',
      dataKey: 'score',
      stroke: 'hsl(0 84% 60%)',
      strokeWidth: 2,
      fill: 'url(#churn-spark)',
    });

    const tooltipCall = tooltipSpy.mock.calls[0]?.[0] as {
      formatter: (v: unknown) => [string, string];
      contentStyle: Record<string, unknown>;
    };

    expect(tooltipCall.contentStyle).toMatchObject({
      background: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 6,
      fontSize: 11,
      padding: '4px 8px',
    });
    expect(tooltipCall.formatter(42)).toEqual(['42/100', 'Score']);
  });

  it("gère l'absence de données même si le hook expose un état d'erreur implicite", () => {
    churnHistorySpy.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    render(<ChurnSparkline etablissementId="eta-error" />, { wrapper: createWrapper() });

    expect(churnHistorySpy).toHaveBeenCalledWith('eta-error', 90);
    expect(screen.getByText("Pas d'historique")).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });
});