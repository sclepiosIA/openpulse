import React from 'react';
import { renderHook, act, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProspectsScoring from './ProspectsScoring';

const {
  PROSPECTS, OWNERS, OVERVIEW, TRENDS, mockToast, mockNavigate, mockRefetchList,
  mockRecomputeMutateAsync, state, builderChain,
} = vi.hoisted(() => {
  const PROSPECTS = [
    {
      id: 'p1',
      nom: 'Alpha Co',
      score_conversion: 85,
      behavioral_score: 40,
      engagement_velocity: 2.3,
      last_engagement_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      commercial_id: 'o1',
      statut: 'qualifié',
      scoring_snoozed_until: null,
    },
    {
      id: 'p2',
      nom: 'Beta LLC',
      score_conversion: 55,
      behavioral_score: 20,
      engagement_velocity: -1.2,
      last_engagement_at: null,
      commercial_id: null,
      statut: 'nouveau',
      scoring_snoozed_until: null,
    },
  ];

  const OWNERS = [
    { id: 'o1', prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com', avatar_url: null },
  ];

  const OVERVIEW = {
    kpis: [{ label: 'prospects', value: 2 }],
    prev_kpis: [],
    by_status: [],
    channels: [],
    hot_streaks: [],
    to_relaunch: [],
    dormant: [],
    orphans: [],
  };

  const TRENDS = [{ date: Date.now(), hot: 1, warm: 0, working: 1, cold: 0 }];

  const mockToast = vi.fn();
  const mockNavigate = vi.fn();
  const mockRefetchList = vi.fn();
  const mockRecomputeMutateAsync = vi.fn().mockResolvedValue({ updated: 2, processed: 3 });

  const state = {
    currentList: { data: PROSPECTS, isLoading: false, isError: false, error: null, refetch: mockRefetchList },
    overview: { data: OVERVIEW, isLoading: false, isError: false, error: null },
    trends: { data: TRENDS, isLoading: false },
    ownersList: { data: OWNERS },
    recompute: { mutateAsync: mockRecomputeMutateAsync, isPending: false },
  };

  // Chainable supabase builder with stable methods
  const builderChain = {
    select: vi.fn(() => builderChain),
    eq: vi.fn(() => builderChain),
    gte: vi.fn(() => builderChain),
    lte: vi.fn(() => builderChain),
    in: vi.fn(() => builderChain),
    order: vi.fn(() => builderChain),
    limit: vi.fn(() => builderChain),
    insert: vi.fn(() => builderChain),
    update: vi.fn(() => builderChain),
    delete: vi.fn(() => builderChain),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn(function (onFulfilled: any) { return Promise.resolve(null).then(onFulfilled); }),
    catch: vi.fn(function (onRejected: any) { return Promise.resolve(null).catch(onRejected); }),
  };

  return { PROSPECTS, OWNERS, OVERVIEW, TRENDS, mockToast, mockNavigate, mockRefetchList, mockRecomputeMutateAsync, state, builderChain };
});

vi.mock('@/integrations/supabase/client', () => {
  return { supabase: { from: vi.fn(() => builderChain) } };
});

vi.mock('@/hooks/crm/useBehavioralScore', () => {
  return {
    useProspectsScoringList: () => ({
      data: state.currentList.data,
      isLoading: state.currentList.isLoading,
      isError: state.currentList.isError,
      error: state.currentList.error,
      refetch: state.currentList.refetch,
    }),
    useScoringOverview: () => ({
      data: state.overview.data,
      isLoading: state.overview.isLoading,
      isError: state.overview.isError,
      error: state.overview.error,
    }),
    useScoringTrends: (_days: number) => ({
      data: state.trends.data,
      isLoading: state.trends.isLoading,
    }),
    useScoringOwners: () => ({ data: state.ownersList.data }),
    useRecomputeAllScores: () => ({ mutateAsync: state.recompute.mutateAsync, isPending: state.recompute.isPending }),
  };
});

vi.mock('@/hooks/shared/usePageTitle', () => ({ usePageTitle: (_: string) => {} }));
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({ ImmersivePageBackground: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title, actions, stats }: any) => (
    <div>
      <h1>{title}</h1>
      <div data-testid="header-stats">{stats && stats.map((s: any) => <span key={s.label}>{s.label}:{s.value}</span>)}</div>
      <div data-testid="header-actions">{actions}</div>
    </div>
  ),
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({ isLoading, isError, error, onRetry, children }: any) => (
    <div>
      {isLoading ? <div data-testid="page-loading" /> : null}
      {isError ? <button data-testid="page-retry" onClick={onRetry}>Retry</button> : null}
      <div>{children}</div>
      {error ? <div data-testid="page-error">{String((error && (error as any).message) || error)}</div> : null}
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({ Badge: ({ children, ...rest }: any) => <span {...rest}>{children}</span> }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button> }));
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: () => <div data-testid="skeleton" /> }));
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children, ...rest }: any) => <tr {...rest}>{children}</tr>,
}));

vi.mock('@/components/scoring/ScoringKpiBar', () => ({ ScoringKpiBar: ({ kpis }: any) => <div data-testid="kpi">{kpis && kpis.map((k: any) => <span key={k.label}>{k.label}:{k.value}</span>)}</div> }));
vi.mock('@/components/scoring/ScoringFiltersBar', () => ({ ScoringFiltersBar: ({ ownersList }: any) => <div data-testid="filters">{ownersList && ownersList.length}</div> }));
vi.mock('@/components/scoring/ScoringTrendChart', () => ({ ScoringTrendChart: ({ data }: any) => <div data-testid="trend">{data && data.length}</div> }));
vi.mock('@/components/scoring/ScoringPhaseDistribution', () => ({ ScoringPhaseDistribution: ({ data }: any) => <div data-testid="phase">{String((data || []).length)}</div> }));
vi.mock('@/components/scoring/ScoringChannelMix', () => ({ ScoringChannelMix: ({ data }: any) => <div data-testid="channel">{String((data || []).length)}</div> }));
vi.mock('@/components/scoring/ScoringMovementSection', () => ({
  ScoringMovementSection: ({ items, title, onClick }: any) => (
    <div>
      <h2>{title}</h2>
      <div>
        {(items || []).map((it: any) => <button key={it.id} onClick={() => onClick && onClick(it.id)}>{it.nom || it.id}</button>)}
      </div>
    </div>
  ),
}));
vi.mock('@/components/scoring/ProspectActionMenu', () => ({ ProspectActionMenu: () => <div /> }));
vi.mock('@/components/scoring/ProspectScoringSheet', () => ({ ProspectScoringSheet: () => <div /> }));

describe('ProspectsScoring', () => {
  const createWrapper = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    return ({ children }: any) => (
      <QueryClientProvider client={qc}>
        <div>
          <ProspectsScoring />
          {children}
        </div>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // ensure URL methods exist to avoid errors during exportCSV
     
    // @ts-ignore
    if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:mock';
     
    // @ts-ignore
    if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
    // reset shared state
    state.currentList = { data: PROSPECTS, isLoading: false, isError: false, error: null, refetch: mockRefetchList };
    state.overview = { data: OVERVIEW, isLoading: false, isError: false, error: null };
    state.trends = { data: TRENDS, isLoading: false };
    state.ownersList = { data: OWNERS };
    state.recompute = { mutateAsync: mockRecomputeMutateAsync, isPending: false };
  });

  it('renders loading skeletons when prospects list is loading', async () => {
    state.currentList = { ...state.currentList, data: [], isLoading: true, isError: false, error: null };
    const wrapper = createWrapper();
    await act(async () => {
      renderHook(() => ({}), { wrapper });
      await Promise.resolve();
    });

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(6);
  });

  it('renders prospects, exports CSV and triggers recompute with toast', async () => {
    state.currentList = { ...state.currentList, data: PROSPECTS, isLoading: false, isError: false, error: null };
    state.overview = { ...state.overview, data: OVERVIEW, isLoading: false, isError: false, error: null };
    state.ownersList = { data: OWNERS };
    state.recompute = { mutateAsync: mockRecomputeMutateAsync, isPending: false };

    const wrapper = createWrapper();
    await act(async () => {
      renderHook(() => ({}), { wrapper });
      await Promise.resolve();
    });

    expect(screen.getByText('Alpha Co')).toBeTruthy();
    expect(screen.getByText('Beta LLC')).toBeTruthy();

    const exportBtn = screen.getByText('Export CSV');
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Export CSV téléchargé',
      description: expect.stringContaining('2 prospects'),
    }));

    const recomputeBtn = screen.getByText('Recalculer');
    await act(async () => {
      fireEvent.click(recomputeBtn);
      await Promise.resolve();
    });

    expect(mockRecomputeMutateAsync).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Scores recalculés',
      description: expect.stringContaining('2/3'),
    }));
  });

  it('shows error state and calls refetch when retry pressed', async () => {
    state.currentList = { data: null as unknown as any, isLoading: false, isError: true, error: { message: 'boom' }, refetch: mockRefetchList };
    const wrapper = createWrapper();
    await act(async () => {
      renderHook(() => ({}), { wrapper });
      await Promise.resolve();
    });

    const retryBtn = screen.getByTestId('page-retry');
    expect(retryBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(mockRefetchList).toHaveBeenCalled();
    expect(screen.getByTestId('page-error')).toHaveTextContent('boom');
  });
});