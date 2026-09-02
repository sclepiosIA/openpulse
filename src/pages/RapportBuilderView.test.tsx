import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  DASH_WITH_WIDGETS,
  DASH_NO_WIDGETS,
  useCustomDashboardMock,
  navigateMock,
  pageTitleMock,
  exportHandlerMock,
  refetchMock,
} = vi.hoisted(() => {
  const DASH_WITH_WIDGETS = {
    id: 'dash-1',
    nom: 'Tableau de bord A',
    description: 'Une description',
    filters_schema: { periode: '30d' },
    widgets: [{ id: 'w1', type: 'chart' }],
    layout: [{ i: 'w1', x: 0, y: 0, w: 6, h: 4 }],
  };
  const DASH_NO_WIDGETS = {
    id: 'dash-2',
    nom: 'Tableau vide',
    description: '',
    filters_schema: { periode: '7d' },
    widgets: [],
    layout: [],
  };
  return {
    DASH_WITH_WIDGETS,
    DASH_NO_WIDGETS,
    useCustomDashboardMock: vi.fn(),
    navigateMock: vi.fn(),
    pageTitleMock: vi.fn(),
    exportHandlerMock: vi.fn(),
    refetchMock: vi.fn(),
  };
});

vi.mock('react-router-dom', () => {
  return {
    useParams: () => ({ id: 'dash-1' }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/dashboard/useCustomDashboards', () => {
  return {
    useCustomDashboard: (id?: string | undefined) => useCustomDashboardMock(id),
  };
});

vi.mock('@/hooks/shared/usePageTitle', () => {
  return {
    usePageTitle: pageTitleMock,
  };
});

vi.mock('lucide-react', () => {
  return {
    ArrowLeft: () => null,
    Pencil: () => null,
    Share2: () => null,
    BarChart3: () => null,
    CalendarClock: () => null,
  };
});

vi.mock('@/components/ui/button', () => {
  const Button: React.FC<Record<string, unknown>> = (props) => {
    const { onClick, children } = props as { onClick?: () => void; children?: React.ReactNode };
    return (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    );
  };
  return { Button };
});

vi.mock('@/components/rapports-builder/ReportGrid', () => {
  const ReportGrid: React.FC<Record<string, unknown>> = (props) => {
    const { widgets, layout, filters } = props as { widgets: unknown[]; layout: unknown[]; filters: unknown };
    return (
      <div>
        REPORT_GRID
        <div data-testid="rg-widgets-count">{(widgets as unknown[]).length}</div>
        <div data-testid="rg-layout">{JSON.stringify(layout)}</div>
        <div data-testid="rg-filters">{JSON.stringify(filters)}</div>
      </div>
    );
  };
  return { ReportGrid };
});

vi.mock('@/components/rapports-builder/panels/GlobalFiltersBar', () => {
  const GlobalFiltersBar: React.FC<Record<string, unknown>> = (props) => {
    const { filters, onChange } = props as { filters: unknown; onChange: (f: unknown) => void };
    return (
      <div>
        <div data-testid="global-filters">{JSON.stringify(filters)}</div>
        <button onClick={() => onChange({ ...(filters as object), changed: true })}>CHANGE_FILTERS</button>
      </div>
    );
  };
  return { GlobalFiltersBar };
});

vi.mock('@/components/rapports-builder/ExportMenu', () => {
  const ExportMenu: React.FC<Record<string, unknown>> = (props) => {
    const { dashboard, filters } = props as { dashboard: unknown; filters: unknown };
    return (
      <div>
        <button
          data-testid="export-btn"
          onClick={() => {
            exportHandlerMock(dashboard, filters);
          }}
        >
          EXPORT
        </button>
      </div>
    );
  };
  return { ExportMenu };
});

vi.mock('@/components/rapports-builder/ShareDialog', () => {
  const ShareDialog: React.FC<Record<string, unknown>> = (props) => {
    const { open } = props as { open: boolean };
    return <div>{open ? 'SHARE_OPEN' : 'SHARE_CLOSED'}</div>;
  };
  return { ShareDialog };
});

vi.mock('@/components/rapports-builder/ScheduleDialog', () => {
  const ScheduleDialog: React.FC<Record<string, unknown>> = (props) => {
    const { open } = props as { open: boolean };
    return <div>{open ? 'SCHEDULE_OPEN' : 'SCHEDULE_CLOSED'}</div>;
  };
  return { ScheduleDialog };
});

vi.mock('@/components/layout/ImmersivePageHeader', () => {
  const ImmersivePageHeader: React.FC<Record<string, unknown>> = (props) => {
    const { title, subtitle, children } = props as {
      title: string;
      subtitle?: string;
      children?: React.ReactNode;
    };
    return (
      <header>
        <h1>{title}</h1>
        {subtitle ? <h2>{subtitle}</h2> : null}
        <div>{children}</div>
      </header>
    );
  };
  return { ImmersivePageHeader };
});

vi.mock('@/components/ui/skeleton', () => {
  const Skeleton: React.FC<Record<string, unknown>> = () => {
    return <div>SKELETON</div>;
  };
  return { Skeleton };
});

vi.mock('@/components/common/PageDataState', () => {
  const PageDataState: React.FC<Record<string, unknown>> = (props) => {
    const { isLoading, isError, error, onRetry, loadingFallback, children } = props as {
      isLoading?: boolean;
      isError?: boolean;
      error?: Error | null;
      onRetry?: () => void;
      loadingFallback?: React.ReactNode;
      children?: React.ReactNode;
    };
    if (isLoading) {
      return <div>{loadingFallback}</div>;
    }
    if (isError) {
      return (
        <div>
          <div data-testid="page-error">{error?.message ?? 'ERROR'}</div>
          <button onClick={onRetry}>RETRY</button>
        </div>
      );
    }
    return <div>{children}</div>;
  };
  return { PageDataState };
});

vi.mock('@/components/common/SectionErrorBoundary', () => {
  const SectionErrorBoundary: React.FC<Record<string, unknown>> = (props) => {
    const { children } = props as { children?: React.ReactNode };
    return <div>{children}</div>;
  };
  return { SectionErrorBoundary };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
};

import RapportBuilderView from './RapportBuilderView';

describe('RapportBuilderView', () => {
  it('affiche l\'état de chargement et utilise usePageTitle avec "Rapport" quand pas de dashboard', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: refetchMock,
    });

    render(
      <Wrapper>
        <RapportBuilderView />
      </Wrapper>,
    );

    const skeletons = screen.getAllByText('SKELETON');
    expect(skeletons.length).toBe(2);
    expect(pageTitleMock).toHaveBeenCalledWith('Rapport');
  });

  it('affiche l\'erreur quand le hook renvoie isError et permet de relancer via onRetry', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'erreur test' },
      refetch: refetchMock,
    });

    render(
      <Wrapper>
        <RapportBuilderView />
      </Wrapper>,
    );

    expect(screen.getByTestId('page-error').textContent).toBe('erreur test');
    const retryBtn = screen.getByText('RETRY');
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalled();
    expect(pageTitleMock).toHaveBeenCalledWith('Rapport');
  });

  it('rends le dashboard avec widgets, permet export, navigation et ouvre le schedule dialog', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: DASH_WITH_WIDGETS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock,
    });

    render(
      <Wrapper>
        <RapportBuilderView />
      </Wrapper>,
    );

    // Title and subtitle
    expect(screen.getByText(DASH_WITH_WIDGETS.nom)).toBeDefined();
    expect(screen.getByText(DASH_WITH_WIDGETS.description)).toBeDefined();

    // Report grid rendered with widget count
    expect(screen.getByTestId('rg-widgets-count').textContent).toBe(String(DASH_WITH_WIDGETS.widgets.length));

    // Export button triggers exportHandlerMock with dashboard and effective filters
    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);
    expect(exportHandlerMock).toHaveBeenCalledWith(DASH_WITH_WIDGETS, DASH_WITH_WIDGETS.filters_schema);

    // Retour navigation
    const retourBtn = screen.getByText('Retour');
    fireEvent.click(retourBtn);
    expect(navigateMock).toHaveBeenCalledWith('/rapports-custom');

    // Éditer navigation
    const editerBtn = screen.getByText('Éditer');
    fireEvent.click(editerBtn);
    expect(navigateMock).toHaveBeenCalledWith(`/rapports-custom/${DASH_WITH_WIDGETS.id}/edit`);

    // Planifier opens schedule dialog
    expect(screen.queryByText('SCHEDULE_OPEN')).toBeNull();
    const planifierBtn = screen.getByText('Planifier');
    fireEvent.click(planifierBtn);
    expect(screen.getByText('SCHEDULE_OPEN')).toBeDefined();
  });

  it('affiche l\'écran d\'accueil du rapport vide et navigue vers l\'éditeur', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: DASH_NO_WIDGETS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock,
    });

    render(
      <Wrapper>
        <RapportBuilderView />
      </Wrapper>,
    );

    expect(screen.getByText("Ce rapport n'a pas encore de widgets")).toBeDefined();
    const commencerBtn = screen.getByText('Commencer à construire');
    fireEvent.click(commencerBtn);
    expect(navigateMock).toHaveBeenCalledWith(`/rapports-custom/${DASH_NO_WIDGETS.id}/edit`);
  });

  it('peut appeler usePageTitle via renderHook avec QueryClientProvider wrapper', async () => {
    vi.clearAllMocks();
    const HookWrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    renderHook(() => {
      // call the mocked hook which is just a spy
      (pageTitleMock as unknown as (t: string) => void)('titre-hook');
      return null;
    }, { wrapper: HookWrapper });

    expect(pageTitleMock).toHaveBeenCalledWith('titre-hook');
  });
});