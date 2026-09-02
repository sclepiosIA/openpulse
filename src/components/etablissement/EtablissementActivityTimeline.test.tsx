import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ActivityFeedFilters } from '@/types/activity';

const {
  successItems,
  successFeed,
  loadingFeed,
  errorFeed,
  mockUseGlobalActivityFeed,
  mockFetchNextPage,
  mockRefresh,
  mockErrorRefresh,
} = vi.hoisted(() => {
  const mockFetchNextPage = vi.fn();
  const mockRefresh = vi.fn();
  const mockErrorRefresh = vi.fn();
  const mockUseGlobalActivityFeed = vi.fn();

  const successItems = [
    {
      id: 'act-1',
      type: 'email',
      title: 'Email envoyé',
      description: 'Relance envoyée au directeur',
    },
    {
      id: 'act-2',
      type: 'invoice',
      title: 'Facture validée',
      description: 'Facture mensuelle acceptée',
    },
  ];

  const emptyItems: typeof successItems = [];

  const successFeed = {
    items: successItems,
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: mockFetchNextPage,
    pendingNew: 2,
    refresh: mockRefresh,
  };

  const loadingFeed = {
    items: emptyItems,
    isLoading: true,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: mockFetchNextPage,
    pendingNew: 0,
    refresh: mockRefresh,
  };

  const errorFeed = {
    items: emptyItems,
    isLoading: false,
    isError: true,
    error: { message: 'flux indisponible' },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: mockFetchNextPage,
    pendingNew: 0,
    refresh: mockErrorRefresh,
  };

  return {
    successItems,
    successFeed,
    loadingFeed,
    errorFeed,
    mockUseGlobalActivityFeed,
    mockFetchNextPage,
    mockRefresh,
    mockErrorRefresh,
  };
});

vi.mock('@/components/ui/card', () => {
  type CardMockProps = {
    children?: ReactNode;
    className?: string;
  };

  function Card({ children, className }: CardMockProps) {
    return (
      <section data-testid="card" className={className}>
        {children}
      </section>
    );
  }

  function CardContent({ children, className }: CardMockProps) {
    return (
      <div data-testid="card-content" className={className}>
        {children}
      </div>
    );
  }

  function CardHeader({ children, className }: CardMockProps) {
    return (
      <div data-testid="card-header" className={className}>
        {children}
      </div>
    );
  }

  function CardTitle({ children, className }: CardMockProps) {
    return (
      <h2 data-testid="card-title" className={className}>
        {children}
      </h2>
    );
  }

  function CardDescription({ children, className }: CardMockProps) {
    return (
      <p data-testid="card-description" className={className}>
        {children}
      </p>
    );
  }

  function CardFooter({ children, className }: CardMockProps) {
    return (
      <footer data-testid="card-footer" className={className}>
        {children}
      </footer>
    );
  }

  return { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter };
});

vi.mock('@/components/activity/ActivityFeedFilters', () => {
  type FiltersBarMockProps = {
    filters: ActivityFeedFilters;
    onChange: (filters: ActivityFeedFilters) => void;
    hideEtablissementFilter?: boolean;
  };

  function ActivityFeedFilters({
    filters,
    onChange,
    hideEtablissementFilter = false,
  }: FiltersBarMockProps) {
    return (
      <div data-testid="filters-bar">
        <span data-testid="hide-etablissement-filter">
          {hideEtablissementFilter ? 'hidden' : 'visible'}
        </span>
        <span data-testid="filters-value">{JSON.stringify(filters)}</span>
        <button
          type="button"
          data-testid="apply-email-filter"
          onClick={() => onChange({ types: ['email'] } as ActivityFeedFilters)}
        >
          Appliquer filtre email
        </button>
      </div>
    );
  }

  return { ActivityFeedFilters };
});

vi.mock('@/components/activity/ActivityFeedTimeline', () => {
  type TimelineItem = {
    id: string;
    type: string;
    title: string;
    description: string;
  };

  type TimelineMockProps = {
    items: TimelineItem[];
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
    pendingNew: number;
    onRefresh: () => void;
    emptyLabel: string;
  };

  function ActivityFeedTimeline({
    items,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    pendingNew,
    onRefresh,
    emptyLabel,
  }: TimelineMockProps) {
    return (
      <section data-testid="activity-timeline">
        <span data-testid="timeline-loading">{isLoading ? 'loading' : 'ready'}</span>
        <span data-testid="timeline-has-next-page">{hasNextPage ? 'yes' : 'no'}</span>
        <span data-testid="timeline-fetching-next-page">
          {isFetchingNextPage ? 'fetching' : 'idle'}
        </span>
        <span data-testid="timeline-pending-new">{String(pendingNew)}</span>
        <span data-testid="timeline-empty-label">{emptyLabel}</span>

        {items.length === 0 ? <p data-testid="empty-state">{emptyLabel}</p> : null}

        {items.map((item) => (
          <article data-testid="timeline-item" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <small>{item.type}</small>
          </article>
        ))}

        <button type="button" data-testid="load-more" onClick={onLoadMore}>
          Charger plus
        </button>
        <button type="button" data-testid="refresh-timeline" onClick={onRefresh}>
          Rafraîchir
        </button>
      </section>
    );
  }

  return { ActivityFeedTimeline };
});

vi.mock('@/components/common/PageDataState', () => {
  type PageDataStateMockProps = {
    isLoading: boolean;
    isError: boolean;
    error?: unknown;
    onRetry: () => void;
    children: ReactNode;
  };

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      return typeof message === 'string' ? message : 'Erreur inconnue';
    }

    return 'Erreur inconnue';
  }

  function PageDataState({ isLoading, isError, error, onRetry, children }: PageDataStateMockProps) {
    if (isLoading) {
      return <div data-testid="page-loading">Chargement page</div>;
    }

    if (isError) {
      return (
        <div data-testid="page-error">
          <p>{getErrorMessage(error)}</p>
          <button type="button" data-testid="retry-page" onClick={onRetry}>
            Réessayer
          </button>
        </div>
      );
    }

    return <div data-testid="page-data-state">{children}</div>;
  }

  return { PageDataState };
});

vi.mock('@/hooks/activity/useGlobalActivityFeed', () => ({
  useGlobalActivityFeed: mockUseGlobalActivityFeed,
}));

import { EtablissementActivityTimeline } from './EtablissementActivityTimeline';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderComponent(etablissementId = 'eta-42') {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <EtablissementActivityTimeline etablissementId={etablissementId} />
    </QueryClientProvider>,
  );
}

describe('EtablissementActivityTimeline', () => {
  beforeEach(() => {
    mockUseGlobalActivityFeed.mockReset();
    mockFetchNextPage.mockClear();
    mockRefresh.mockClear();
    mockErrorRefresh.mockClear();
    mockUseGlobalActivityFeed.mockReturnValue(successFeed);
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche la timeline de succès filtrée sur l’établissement courant avec les activités métier', () => {
    renderComponent('eta-42');

    expect(mockUseGlobalActivityFeed).toHaveBeenLastCalledWith({
      filters: { etablissement_ids: ['eta-42'] },
      pageSize: 30,
      realtime: true,
    });

    expect(screen.getByTestId('hide-etablissement-filter')).toHaveTextContent('hidden');
    expect(screen.getByTestId('timeline-loading')).toHaveTextContent('ready');
    expect(screen.getByTestId('timeline-has-next-page')).toHaveTextContent('yes');
    expect(screen.getByTestId('timeline-fetching-next-page')).toHaveTextContent('idle');
    expect(screen.getByTestId('timeline-pending-new')).toHaveTextContent('2');
    expect(screen.getByTestId('timeline-empty-label')).toHaveTextContent(
      'Aucune activité enregistrée pour cet établissement',
    );

    const renderedItems = screen.getAllByTestId('timeline-item');
    expect(renderedItems).toHaveLength(successItems.length);
    expect(within(renderedItems[0]).getByText('Email envoyé')).toBeInTheDocument();
    expect(within(renderedItems[0]).getByText('Relance envoyée au directeur')).toBeInTheDocument();
    expect(within(renderedItems[1]).getByText('Facture validée')).toBeInTheDocument();
    expect(within(renderedItems[1]).getByText('Facture mensuelle acceptée')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('load-more'));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('refresh-timeline'));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('transmet le chargement du flux à la timeline et conserve le libellé vide de l’établissement', () => {
    mockUseGlobalActivityFeed.mockReturnValue(loadingFeed);

    renderComponent('eta-loading');

    expect(mockUseGlobalActivityFeed).toHaveBeenLastCalledWith({
      filters: { etablissement_ids: ['eta-loading'] },
      pageSize: 30,
      realtime: true,
    });

    expect(screen.getByTestId('timeline-loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('timeline-has-next-page')).toHaveTextContent('no');
    expect(screen.getByTestId('empty-state')).toHaveTextContent(
      'Aucune activité enregistrée pour cet établissement',
    );
    expect(screen.queryAllByTestId('timeline-item')).toHaveLength(0);
  });

  it('affiche l’erreur du flux et appelle le rafraîchissement au retry', () => {
    mockUseGlobalActivityFeed.mockReturnValue(errorFeed);

    renderComponent('eta-error');

    expect(mockUseGlobalActivityFeed).toHaveBeenLastCalledWith({
      filters: { etablissement_ids: ['eta-error'] },
      pageSize: 30,
      realtime: true,
    });

    expect(screen.getByTestId('page-error')).toHaveTextContent('flux indisponible');
    expect(screen.queryByTestId('activity-timeline')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('retry-page'));
    expect(mockErrorRefresh).toHaveBeenCalledTimes(1);
  });

  it('fusionne les filtres utilisateur avec le filtre établissement obligatoire', async () => {
    renderComponent('eta-filtered');

    expect(screen.getByTestId('filters-value')).toHaveTextContent('{}');

    fireEvent.click(screen.getByTestId('apply-email-filter'));

    await waitFor(() => {
      expect(mockUseGlobalActivityFeed).toHaveBeenLastCalledWith({
        filters: { types: ['email'], etablissement_ids: ['eta-filtered'] },
        pageSize: 30,
        realtime: true,
      });
    });

    expect(screen.getByTestId('filters-value')).toHaveTextContent('"email"');
  });
});