import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  STABLE_PREDICTIONS,
  STABLE_OVERVIEW,
  STABLE_TRENDS,
  STABLE_OVERVIEW_ERROR,
  toast,
  hookState,
  recomputeMutate,
  usePageTitleMock,
  navigateMock,
  urlMocks,
  anchorClickMock,
  mockFrom,
  builderState,
} = vi.hoisted(() => {
  type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
  type Prediction = {
    id: string;
    etablissement_id: string;
    score: number;
    risk_level: RiskLevel;
    predicted_at: string;
    acknowledged_until: string | null;
    factors?: {
      open_tickets?: number;
      emails_30d?: number;
      unpaid_invoices?: number;
      days_since_last_interaction?: number | string;
    };
    etablissement?: {
      nom?: string;
      csm_id?: string | null;
      type_offre?: string | null;
    } | null;
  };

  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const STABLE_PREDICTIONS: readonly Prediction[] = Object.freeze([
    {
      id: 'p1',
      etablissement_id: 'e1',
      score: 92,
      risk_level: 'critical',
      predicted_at: '2026-01-10T10:00:00.000Z',
      acknowledged_until: null,
      factors: { open_tickets: 3, emails_30d: 5, unpaid_invoices: 1, days_since_last_interaction: 12 },
      etablissement: { nom: 'Alpha', csm_id: 'csm_11111111aaaa', type_offre: 'Pro' },
    },
    {
      id: 'p2',
      etablissement_id: 'e2',
      score: 61,
      risk_level: 'high',
      predicted_at: '2026-01-12T10:00:00.000Z',
      acknowledged_until: null,
      factors: { open_tickets: 1, emails_30d: 0, unpaid_invoices: 0, days_since_last_interaction: 3 },
      etablissement: { nom: 'Beta', csm_id: 'csm_22222222bbbb', type_offre: 'Basic' },
    },
    {
      id: 'p3',
      etablissement_id: 'e3',
      score: 40,
      risk_level: 'medium',
      predicted_at: '2026-01-11T10:00:00.000Z',
      acknowledged_until: future,
      factors: { open_tickets: 0, emails_30d: 2, unpaid_invoices: 0, days_since_last_interaction: 30 },
      etablissement: { nom: 'Gamma', csm_id: 'csm_11111111aaaa', type_offre: 'Pro' },
    },
    {
      id: 'p4',
      etablissement_id: 'e4',
      score: 72,
      risk_level: 'high',
      predicted_at: '2026-01-09T10:00:00.000Z',
      acknowledged_until: past,
      factors: { open_tickets: 2, emails_30d: 1, unpaid_invoices: 0, days_since_last_interaction: 7 },
      etablissement: { nom: 'Delta', csm_id: null, type_offre: 'Pro' },
    },
  ]);

  const STABLE_OVERVIEW = Object.freeze({
    kpis: { total: 4, critical: 1, high: 2 },
    prev_kpis: { total: 4, critical: 2, high: 1 },
    mrr_at_risk: 1500,
    worsened: [{ etablissement_id: 'e2' }],
    improved: [{ etablissement_id: 'e1' }],
    factors_breakdown: [{ key: 'open_tickets', label: 'Tickets', value: 3 }],
  });

  const STABLE_OVERVIEW_ERROR = Object.freeze({ message: 'overview error' });

  const STABLE_TRENDS = Object.freeze([
    { date: '2026-01-01', critical: 1, high: 2, medium: 0, low: 1 },
    { date: '2026-02-01', critical: 2, high: 1, medium: 1, low: 0 },
  ]);

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  };

  const hookState = {
    predictions: { data: STABLE_PREDICTIONS as unknown, isLoading: false, isError: false, error: null as Error | null, refetch: vi.fn() },
    overview: { data: STABLE_OVERVIEW as unknown, isLoading: false, isError: false, error: null as Error | null },
    trends: { data: STABLE_TRENDS as unknown, isLoading: false, isError: false, error: null as Error | null },
    recompute: { isPending: false },
  };

  const recomputeMutate = vi.fn();

  const usePageTitleMock = vi.fn();

  const navigateMock = vi.fn();

  const urlMocks = {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  };

  const anchorClickMock = vi.fn();

  const builderState = {
    data: null as unknown,
    error: null as { message: string } | null,
    singleData: null as unknown,
    singleError: null as { message: string } | null,
  };

  const makeThenableBuilder = () => {
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
      'like',
      'ilike',
      'is',
      'order',
      'limit',
      'range',
      'or',
      'match',
      'filter',
      'insert',
      'upsert',
      'update',
      'delete',
      'rpc',
    ] as const;

    for (const m of methods) builder[m] = chain;

    builder.single = () => Promise.resolve({ data: builderState.singleData, error: builderState.singleError });
    builder.maybeSingle = () => Promise.resolve({ data: builderState.singleData, error: builderState.singleError });

    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: builderState.data, error: builderState.error }).then(onFulfilled, onRejected);
    builder.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: builderState.data, error: builderState.error }).catch(onRejected);

    return builder;
  };

  const mockFrom = vi.fn(() => makeThenableBuilder());

  return {
    STABLE_PREDICTIONS,
    STABLE_OVERVIEW,
    STABLE_TRENDS,
    STABLE_OVERVIEW_ERROR,
    toast,
    hookState,
    recomputeMutate,
    usePageTitleMock,
    navigateMock,
    urlMocks,
    anchorClickMock,
    mockFrom,
    builderState,
  };
});

vi.mock('sonner', () => ({ toast }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
    storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })) })) },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Link: ({ children }: { children: React.ReactNode }) => React.createElement('a', null, children),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
}));

vi.mock('lucide-react', () => ({
  ShieldAlert: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'ShieldAlert', ...props }),
  RefreshCw: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'RefreshCw', ...props }),
  Download: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'Download', ...props }),
  TrendingUp: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'TrendingUp', ...props }),
  TrendingDown: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'TrendingDown', ...props }),
  BellOff: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'BellOff', ...props }),
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({ usePageTitle: usePageTitleMock }));

vi.mock('@/hooks/csm/useChurnPredictions', () => ({
  useChurnPredictions: () => hookState.predictions,
  useChurnOverview: () => hookState.overview,
  useChurnTrends: (days: number) => {
    void days;
    return hookState.trends;
  },
  useRecomputeChurn: () => ({
    mutate: recomputeMutate,
    isPending: hookState.recompute.isPending,
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => React.createElement('button', { type: 'button', onClick, disabled, ...rest }, children),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => React.createElement('div', { 'data-testid': 'skeleton', className }),
}));

vi.mock('@/components/ui/tabs', async () => {
  const ReactMod = await import('react');
  type TabsCtx = { value: string; setValue: (v: string) => void };
  const Ctx = ReactMod.createContext<TabsCtx | null>(null);

  const Tabs = ({ defaultValue, children }: { defaultValue: string; children: React.ReactNode }) => {
    const [value, setValue] = ReactMod.useState(defaultValue);
    return ReactMod.createElement(Ctx.Provider, { value: { value, setValue } }, children);
  };

  const TabsList = ({ children }: { children: React.ReactNode }) => ReactMod.createElement('div', { 'data-testid': 'tabs-list' }, children);

  const TabsTrigger = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const ctx = ReactMod.useContext(Ctx);
    if (!ctx) return ReactMod.createElement('button', null, children);
    return ReactMod.createElement(
      'button',
      { type: 'button', 'data-testid': `tab-${value}`, onClick: () => ctx.setValue(value) },
      children,
    );
  };

  const TabsContent = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => {
    const ctx = ReactMod.useContext(Ctx);
    if (!ctx || ctx.value !== value) return null;
    return ReactMod.createElement('div', { 'data-testid': `panel-${value}`, className }, children);
  };

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'bg' }, children),
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    stats,
    actions,
  }: {
    title: string;
    subtitle: string;
    stats: Array<{ label: string; value: number }>;
    actions?: React.ReactNode;
  }) =>
    React.createElement(
      'header',
      { 'data-testid': 'header' },
      React.createElement('h1', null, title),
      React.createElement('p', null, subtitle),
      React.createElement(
        'ul',
        { 'data-testid': 'stats' },
        stats.map(s => React.createElement('li', { key: s.label }, `${s.label}:${s.value}`)),
      ),
      React.createElement('div', { 'data-testid': 'actions' }, actions),
    ),
}));

vi.mock('@/components/churn/ChurnKpiBar', () => ({
  ChurnKpiBar: ({ kpis, loading, mrrAtRisk }: { kpis?: { total: number; critical: number; high: number }; loading: boolean; mrrAtRisk: number }) =>
    React.createElement(
      'div',
      { 'data-testid': 'kpi', 'data-loading': String(loading) },
      React.createElement('span', { 'data-testid': 'kpi-total' }, kpis ? String(kpis.total) : 'empty'),
      React.createElement('span', { 'data-testid': 'kpi-mrr' }, String(mrrAtRisk)),
    ),
}));

vi.mock('@/components/churn/ChurnRiskDonut', () => ({
  ChurnRiskDonut: ({ loading }: { loading: boolean }) => React.createElement('div', { 'data-testid': 'donut', 'data-loading': String(loading) }),
}));

vi.mock('@/components/churn/ChurnTrendChart', () => ({
  ChurnTrendChart: ({ data, loading }: { data: unknown; loading: boolean }) =>
    React.createElement('div', { 'data-testid': 'trend', 'data-loading': String(loading) }, Array.isArray(data) ? `points:${data.length}` : 'points:0'),
}));

vi.mock('@/components/churn/ChurnFactorsBreakdown', () => ({
  ChurnFactorsBreakdown: ({ total, loading }: { total: number; loading: boolean }) =>
    React.createElement('div', { 'data-testid': 'breakdown', 'data-loading': String(loading) }, `total:${total}`),
}));

vi.mock('@/components/churn/ChurnFiltersBar', () => ({
  ChurnFiltersBar: ({
    filters,
    onChange,
    csmOptions,
    offreOptions,
  }: {
    filters: { search: string; minScore: number; sort: string; risks: string[]; csms: string[]; offres: string[] };
    onChange: (v: { search: string; minScore: number; sort: string; risks: string[]; csms: string[]; offres: string[] }) => void;
    csmOptions: Array<{ id: string; label: string }>;
    offreOptions: string[];
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'filters' },
      React.createElement('div', { 'data-testid': 'filters-search' }, filters.search),
      React.createElement('div', { 'data-testid': 'filters-csms' }, `csms:${csmOptions.length}`),
      React.createElement('div', { 'data-testid': 'filters-offres' }, `offres:${offreOptions.length}`),
      React.createElement(
        'button',
        { type: 'button', 'data-testid': 'set-search-beta', onClick: () => onChange({ ...filters, search: 'be' }) },
        'search-be',
      ),
    ),
}));

vi.mock('@/components/churn/ChurnAccountCard', () => ({
  ChurnAccountCard: ({
    prediction,
    onOpenAction,
  }: {
    prediction: { etablissement?: { nom?: string } | null; id: string; score: number; risk_level: string; etablissement_id: string };
    onOpenAction: (id: string) => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': `card-${prediction.id}` },
      React.createElement('span', { 'data-testid': `card-name-${prediction.id}` }, prediction.etablissement?.nom ?? ''),
      React.createElement('span', { 'data-testid': `card-score-${prediction.id}` }, String(prediction.score)),
      React.createElement('span', { 'data-testid': `card-risk-${prediction.id}` }, prediction.risk_level),
      React.createElement('button', { type: 'button', 'data-testid': `open-action-${prediction.id}`, onClick: () => onOpenAction(prediction.etablissement_id) }, 'open'),
    ),
}));

vi.mock('@/components/churn/ChurnActionPlanSheet', () => ({
  ChurnActionPlanSheet: ({
    prediction,
    open,
    onOpenChange,
  }: {
    prediction: { id: string } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'action-sheet', 'data-open': String(open), 'data-prediction-id': prediction ? prediction.id : '' },
      React.createElement('button', { type: 'button', 'data-testid': 'close-sheet', onClick: () => onOpenChange(false) }, 'close'),
    ),
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    error,
    onRetry,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    error?: Error;
    onRetry?: () => void;
    children: React.ReactNode;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'page-state', 'data-loading': String(isLoading), 'data-error': String(isError) },
      React.createElement('div', { 'data-testid': 'page-state-message' }, error ? error.message : ''),
      React.createElement('button', { type: 'button', 'data-testid': 'retry', onClick: onRetry }, 'retry'),
      children,
    ),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(React.createElement(QueryClientProvider, { client }, ui));
}

describe('ChurnPredictor', () => {
  it('affiche le chargement puis le succès avec valeurs métier, export CSV et recalcul', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = urlMocks.createObjectURL;
    URL.revokeObjectURL = urlMocks.revokeObjectURL;

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        (el as HTMLAnchorElement).click = anchorClickMock as unknown as () => void;
      }
      return el;
    });

    hookState.predictions.isLoading = true;
    hookState.predictions.isError = false;
    hookState.predictions.error = null;
    hookState.predictions.data = STABLE_PREDICTIONS;

    hookState.overview.isLoading = false;
    hookState.overview.isError = false;
    hookState.overview.data = STABLE_OVERVIEW;

    hookState.trends.isLoading = false;
    hookState.trends.data = STABLE_TRENDS;

    hookState.recompute.isPending = false;

    const { default: ChurnPredictor } = await import('./ChurnPredictor');

    const { rerender } = renderWithClient(React.createElement(ChurnPredictor));

    expect(usePageTitleMock).toHaveBeenCalledWith('Prédiction de churn');
    expect(screen.getAllByTestId('skeleton').length).toBe(4);

    hookState.predictions.isLoading = false;

    rerender(
      React.createElement(
        QueryClientProvider,
        { client: createQueryClient() },
        React.createElement(ChurnPredictor),
      ),
    );

    const stats = screen.getByTestId('stats');
    expect(stats.textContent).toContain('comptes:4');
    expect(stats.textContent).toContain('critiques:1');
    expect(stats.textContent).toContain('élevés:2');

    expect(screen.getByTestId('kpi-total').textContent).toBe('4');
    expect(screen.getByTestId('trend').textContent).toContain('points:2');

    expect(screen.getByTestId('panel-all')).toBeTruthy();
    expect(screen.getByTestId('card-p1')).toBeTruthy();
    expect(screen.getByTestId('card-p2')).toBeTruthy();
    expect(screen.getByTestId('card-p4')).toBeTruthy();
    expect(screen.queryByTestId('card-p3')).toBeNull();

    fireEvent.click(screen.getByTestId('tab-snoozed'));
    expect(screen.getByTestId('panel-snoozed')).toBeTruthy();
    expect(screen.getByTestId('card-p3')).toBeTruthy();

    fireEvent.click(screen.getByTestId('tab-worsened'));
    expect(screen.getByTestId('panel-worsened')).toBeTruthy();
    expect(screen.getByTestId('card-p2')).toBeTruthy();
    expect(screen.queryByTestId('card-p1')).toBeNull();

    fireEvent.click(screen.getByTestId('tab-improved'));
    expect(screen.getByTestId('panel-improved')).toBeTruthy();
    expect(screen.getByTestId('card-p1')).toBeTruthy();
    expect(screen.queryByTestId('card-p2')).toBeNull();

    fireEvent.click(screen.getByTestId('tab-all'));
    fireEvent.click(screen.getByTestId('open-action-p2'));
    const sheet = screen.getByTestId('action-sheet');
    expect(sheet.getAttribute('data-open')).toBe('true');
    expect(sheet.getAttribute('data-prediction-id')).toBe('p2');
    fireEvent.click(screen.getByTestId('close-sheet'));
    expect(screen.getByTestId('action-sheet').getAttribute('data-open')).toBe('false');

    fireEvent.click(screen.getByTestId('set-search-beta'));
    expect(screen.getByTestId('tab-all').textContent).toContain('Tous (1)');
    expect(screen.queryByTestId('card-p1')).toBeNull();
    expect(screen.getByTestId('card-p2')).toBeTruthy();

    const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(exportBtn);
    expect(urlMocks.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClickMock).toHaveBeenCalledTimes(1);
    expect(urlMocks.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('1 comptes exportés');

    const recomputeBtn = screen.getByRole('button', { name: /Recalculer/i });
    await act(async () => {
      fireEvent.click(recomputeBtn);
    });
    expect(recomputeMutate).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('dégrade gracieusement si overview en erreur (liste toujours visible, KPI vide)', async () => {
    hookState.predictions.isLoading = false;
    hookState.predictions.isError = false;
    hookState.predictions.error = null;
    hookState.predictions.data = STABLE_PREDICTIONS;

    hookState.overview.isLoading = false;
    hookState.overview.isError = true;
    hookState.overview.error = STABLE_OVERVIEW_ERROR as unknown as Error;
    hookState.overview.data = null;

    hookState.trends.isLoading = false;
    hookState.trends.data = STABLE_TRENDS;

    const { default: ChurnPredictor } = await import('./ChurnPredictor');

    renderWithClient(React.createElement(ChurnPredictor));

    expect(screen.getByTestId('kpi-total').textContent).toBe('empty');
    expect(screen.getByTestId('card-p1')).toBeTruthy();
    expect(screen.getByTestId('card-p2')).toBeTruthy();
  });

  it("passe en erreur si la requête principale (predictions) échoue et permet retry", async () => {
    const refetch = vi.fn();

    hookState.predictions.isLoading = false;
    hookState.predictions.isError = true;
    hookState.predictions.error = new Error('x');
    hookState.predictions.data = null;
    hookState.predictions.refetch = refetch;

    hookState.overview.isLoading = false;
    hookState.overview.isError = false;
    hookState.overview.data = STABLE_OVERVIEW;

    hookState.trends.isLoading = false;
    hookState.trends.data = STABLE_TRENDS;

    const { default: ChurnPredictor } = await import('./ChurnPredictor');

    renderWithClient(React.createElement(ChurnPredictor));

    expect(screen.getByTestId('page-state').getAttribute('data-error')).toBe('true');
    expect(screen.getByTestId('page-state-message').textContent).toBe('x');

    fireEvent.click(screen.getByTestId('retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});