// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActivityFeed from './ActivityFeed';

const {
  AUTH_STATE,
  FEED_SUCCESS,
  FEED_LOADING,
  FEED_ERROR,
  STATS_DATA,
  PINS_DATA,
  SEARCH_PARAMS_STATE,
  setSearchParamsMock,
  pageTitleMock,
  refreshMock,
  fetchNextPageMock,
  timelinePropsSpy,
  filtersBarPropsSpy,
  statsHeaderPropsSpy,
  pageDataStatePropsSpy,
  useGlobalActivityFeedMock,
  useActivityFeedStatsMock,
  useActivityPinsMock,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  FEED_SUCCESS: {
    items: [
      { id: 'a1', title: 'Interaction A' },
      { id: 'a2', title: 'Interaction B' },
      { id: 'a3', title: 'Interaction C' },
    ],
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    pendingNew: 2,
    refresh: vi.fn(),
  },
  FEED_LOADING: {
    items: [],
    isLoading: true,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    pendingNew: 0,
    refresh: vi.fn(),
  },
  FEED_ERROR: {
    items: [],
    isLoading: false,
    isError: true,
    error: { message: 'x' },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    pendingNew: 0,
    refresh: vi.fn(),
  },
  STATS_DATA: { today: 3, week: 12, month: 25 },
  PINS_DATA: {
    pins: [{ id: 'a2' }, { id: 'a99' }],
    pinnedKeys: new Set<string>(['a2', 'a99']),
  },
  SEARCH_PARAMS_STATE: {
    current: new URLSearchParams('q=alpha&types=interaction,bad&users=u9&etabs=e1&from=2024-01-01&to=2024-01-31&focus=a2'),
  },
  setSearchParamsMock: vi.fn(),
  pageTitleMock: vi.fn(),
  refreshMock: vi.fn(),
  fetchNextPageMock: vi.fn(),
  timelinePropsSpy: vi.fn(),
  filtersBarPropsSpy: vi.fn(),
  statsHeaderPropsSpy: vi.fn(),
  pageDataStatePropsSpy: vi.fn(),
  useGlobalActivityFeedMock: vi.fn(),
  useActivityFeedStatsMock: vi.fn(),
  useActivityPinsMock: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
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
    then: (
      resolve: (value: { data: null; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
    catch: (reject?: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(reject),
  };
  mockFrom.mockImplementation(() => builder);
  return { supabase: { from: mockFrom } };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: pageTitleMock,
}));

vi.mock('@/hooks/activity/useGlobalActivityFeed', () => ({
  useGlobalActivityFeed: (args: unknown) => useGlobalActivityFeedMock(args),
}));

vi.mock('@/hooks/activity/useActivityFeedStats', () => ({
  useActivityFeedStats: (args: unknown) => useActivityFeedStatsMock(args),
}));

vi.mock('@/hooks/activity/useActivityPins', () => ({
  useActivityPins: () => useActivityPinsMock(),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [SEARCH_PARAMS_STATE.current, setSearchParamsMock],
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => {
  const TabsContext = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  }>({ value: 'team', onValueChange: () => {} });

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      children: React.ReactNode;
    }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div data-testid="tabs-root">{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button
          type="button"
          className={className}
          data-testid={`tab-trigger-${value}`}
          aria-pressed={ctx.value === value}
          onClick={() => ctx.onValueChange(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      if (ctx.value !== value) return null;
      return (
        <div data-testid={`tab-content-${value}`} className={className}>
          {children}
        </div>
      );
    },
  };
});

vi.mock('lucide-react', () => {
  const Icon = () => <svg data-testid="icon" />;
  return { Activity: Icon, Users: Icon, User: Icon, Pin: Icon };
});

vi.mock('@/components/activity/ActivityFeedTimeline', () => ({
  ActivityFeedTimeline: (props: {
    items: Array<{ id: string }>;
    isLoading: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    onLoadMore?: () => void;
    pendingNew?: number;
    onRefresh?: () => void;
    focusId?: string | null;
    emptyLabel?: string;
  }) => {
    timelinePropsSpy(props);
    return (
      <div data-testid="timeline">
        <div data-testid="timeline-count">{String(props.items.length)}</div>
        <div data-testid="timeline-loading">{String(props.isLoading)}</div>
        <div data-testid="timeline-focus">{props.focusId ?? ''}</div>
        <div data-testid="timeline-empty">{props.emptyLabel ?? ''}</div>
        <button type="button" onClick={() => props.onLoadMore && props.onLoadMore()}>
          load-more
        </button>
        <button type="button" onClick={() => props.onRefresh && props.onRefresh()}>
          refresh
        </button>
        <div>{props.items.map((it) => it.id).join(',')}</div>
      </div>
    );
  },
}));

vi.mock('@/components/activity/ActivityFeedFilters', () => ({
  ActivityFeedFilters: (props: {
    filters: {
      search?: string;
      types?: string[];
      user_ids?: string[];
      etablissement_ids?: string[];
      date_from?: string;
      date_to?: string;
    };
    onChange: (next: {
      search?: string;
      types?: string[];
      user_ids?: string[];
      etablissement_ids?: string[];
      date_from?: string;
      date_to?: string;
    }) => void;
  }) => {
    filtersBarPropsSpy(props);
    return (
      <div data-testid="filters-bar">
        <div data-testid="filters-search">{props.filters.search ?? ''}</div>
        <button
          type="button"
          onClick={() =>
            props.onChange({
              search: 'beta',
              types: ['email'],
              user_ids: ['u2'],
              etablissement_ids: ['e2'],
              date_from: '2024-02-01',
              date_to: '2024-02-15',
            })
          }
        >
          change-filters
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/activity/ActivityStatsHeader', () => ({
  ActivityStatsHeader: (props: { stats: { today: number; week: number; month: number } | undefined; isLoading: boolean }) => {
    statsHeaderPropsSpy(props);
    return (
      <div data-testid="stats-header">
        {props.stats ? `${props.stats.today}-${props.stats.week}-${props.stats.month}` : 'no-stats'}-{String(props.isLoading)}
      </div>
    );
  },
}));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="immersive-bg">{children}</div>
  ),
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    stats,
  }: {
    title: string;
    subtitle: string;
    stats?: Array<{ label: string; value: number; highlight?: boolean }>;
  }) => (
    <div data-testid="immersive-header">
      <div>{title}</div>
      <div>{subtitle}</div>
      <div data-testid="header-stats">{stats ? stats.map((s) => `${s.label}:${s.value}`).join('|') : ''}</div>
    </div>
  ),
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
    error: { message?: string } | null;
    onRetry: () => void;
    children: React.ReactNode;
  }) => {
    pageDataStatePropsSpy({ isLoading, isError, error, onRetry });
    return (
      <div data-testid="page-data-state">
        <div data-testid="page-error">{isError ? error?.message ?? '' : ''}</div>
        <button type="button" onClick={onRetry}>
          retry
        </button>
        {children}
      </div>
    );
  },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SEARCH_PARAMS_STATE.current = new URLSearchParams(
      'q=alpha&types=interaction,bad&users=u9&etabs=e1&from=2024-01-01&to=2024-01-31&focus=a2'
    );
    FEED_SUCCESS.fetchNextPage = fetchNextPageMock;
    FEED_SUCCESS.refresh = refreshMock;
    FEED_LOADING.fetchNextPage = fetchNextPageMock;
    FEED_LOADING.refresh = refreshMock;
    FEED_ERROR.fetchNextPage = fetchNextPageMock;
    FEED_ERROR.refresh = refreshMock;
    useGlobalActivityFeedMock.mockReturnValue(FEED_SUCCESS);
    useActivityFeedStatsMock.mockReturnValue({ data: STATS_DATA, isLoading: false });
    useActivityPinsMock.mockReturnValue(PINS_DATA);
  });

  it('configure renderHook avec QueryClientProvider', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => React.useMemo(() => 'ready', []), { wrapper });
    expect(result.current).toBe('ready');
  });

  it('affiche le chargement avec les filtres parsés depuis l’URL et les stats métier', () => {
    useGlobalActivityFeedMock.mockReturnValue(FEED_LOADING);

    render(<ActivityFeed />, { wrapper: createWrapper() });

    expect(pageTitleMock).toHaveBeenCalledWith("Fil d'activité");
    expect(useGlobalActivityFeedMock).toHaveBeenCalledWith({
      filters: {
        search: 'alpha',
        types: ['interaction'],
        user_ids: ['u9'],
        etablissement_ids: ['e1'],
        date_from: '2024-01-01',
        date_to: '2024-01-31',
      },
      pageSize: 30,
      realtime: true,
    });
    expect(useActivityFeedStatsMock).toHaveBeenCalledWith({
      search: 'alpha',
      types: ['interaction'],
      user_ids: ['u9'],
      etablissement_ids: ['e1'],
      date_from: '2024-01-01',
      date_to: '2024-01-31',
    });
    expect(screen.getByTestId('timeline-loading')).toHaveTextContent('true');
    expect(screen.getByTestId('timeline-focus')).toHaveTextContent('a2');
    expect(screen.getByTestId('filters-search')).toHaveTextContent('alpha');
    expect(screen.getByTestId('stats-header')).toHaveTextContent('3-12-25-false');
    expect(screen.getByTestId('header-stats')).toHaveTextContent("aujourd'hui:3|7j:12|30j:25");
    expect(screen.getByTestId('tab-trigger-pinned')).toHaveTextContent('2');
  });

  it("affiche les éléments de l'équipe, permet de charger plus, de rafraîchir, de basculer sur mes activités et sur les épinglées", async () => {
    render(<ActivityFeed />, { wrapper: createWrapper() });

    expect(screen.getByTestId('timeline-count')).toHaveTextContent('3');
    expect(screen.getByText('a1,a2,a3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('load-more'));
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('refresh'));
    expect(refreshMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('tab-trigger-mine'));
    expect(useGlobalActivityFeedMock).toHaveBeenLastCalledWith({
      filters: {
        search: 'alpha',
        types: ['interaction'],
        user_ids: ['u1'],
        etablissement_ids: ['e1'],
        date_from: '2024-01-01',
        date_to: '2024-01-31',
      },
      pageSize: 30,
      realtime: true,
    });

    fireEvent.click(screen.getByTestId('tab-trigger-pinned'));
    expect(screen.getByTestId('timeline-count')).toHaveTextContent('1');
    expect(screen.getByText('a2')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-empty')).toHaveTextContent(
      "Vos activités épinglées ne sont pas dans la page courante. Chargez plus d'éléments ou ajustez les filtres."
    );

    fireEvent.click(screen.getByText('change-filters'));

    await waitFor(() => {
      expect(setSearchParamsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          toString: expect.any(Function),
        }),
        { replace: true }
      );
    });

    const lastCall = setSearchParamsMock.mock.calls.at(-1);
    const firstArg = lastCall?.[0];
    expect(firstArg instanceof URLSearchParams).toBe(true);
    if (firstArg instanceof URLSearchParams) {
      expect(firstArg.toString()).toBe('q=beta&types=email&users=u2&etabs=e2&from=2024-02-01&to=2024-02-15&focus=a2');
    }

    expect(useActivityFeedStatsMock).toHaveBeenLastCalledWith({
      search: 'beta',
      types: ['email'],
      user_ids: ['u2'],
      etablissement_ids: ['e2'],
      date_from: '2024-02-01',
      date_to: '2024-02-15',
    });
  });

  it("propage l'erreur via PageDataState et permet de relancer", () => {
    useGlobalActivityFeedMock.mockReturnValue(FEED_ERROR);

    render(<ActivityFeed />, { wrapper: createWrapper() });

    expect(screen.getByTestId('page-error')).toHaveTextContent('x');
    expect(pageDataStatePropsSpy).toHaveBeenLastCalledWith({
      isLoading: false,
      isError: true,
      error: { message: 'x' },
      onRetry: refreshMock,
    });

    fireEvent.click(screen.getByText('retry'));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});