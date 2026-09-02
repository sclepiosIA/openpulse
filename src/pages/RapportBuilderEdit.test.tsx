/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RapportBuilderEdit from './RapportBuilderEdit';

const {
  DASHBOARD,
  EMPTY_DASHBOARD,
  useParamsMock,
  navigateMock,
  useCustomDashboardMock,
  mutateAsyncMock,
  useUpdateDashboardMock,
  toastSuccessMock,
  toastErrorMock,
  usePageTitleMock,
  blockLibraryProps,
  blockConfigPanelProps,
  reportGridProps,
  pageDataStateProps,
} = vi.hoisted(() => {
  const DASHBOARD = {
    id: 'dash-1',
    nom: 'Rapport ventes',
    widgets: [
      { id: 'w1', type: 'kpi', title: 'CA total' },
      { id: 'w2', type: 'bar', title: 'Ventes par mois' },
    ],
    layout: [
      { i: 'w1', x: 0, y: 0, w: 3, h: 2 },
      { i: 'w2', x: 3, y: 0, w: 6, h: 4 },
    ],
  };
  const EMPTY_DASHBOARD = {
    id: 'dash-2',
    nom: 'Rapport vide',
    widgets: [],
    layout: [],
  };
  return {
    DASHBOARD,
    EMPTY_DASHBOARD,
    useParamsMock: vi.fn(),
    navigateMock: vi.fn(),
    useCustomDashboardMock: vi.fn(),
    mutateAsyncMock: vi.fn(),
    useUpdateDashboardMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    usePageTitleMock: vi.fn(),
    blockLibraryProps: { current: null as null | { onAdd: (type: 'kpi' | 'bar') => void } },
    blockConfigPanelProps: { current: null as null | { onUpdate: (patch: { title?: string }) => void; onDelete: () => void; onDuplicate: () => void; widget: { id: string; title: string } | null } },
    reportGridProps: { current: null as null | { onSelectWidget: (id: string) => void; widgets: Array<{ id: string; title: string }>; selectedId: string | null } },
    pageDataStateProps: { current: null as null | { isLoading: boolean; isError: boolean; error?: Error; onRetry: () => void } },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: useParamsMock,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/dashboard/useCustomDashboards', () => ({
  useCustomDashboard: useCustomDashboardMock,
  useUpdateDashboard: useUpdateDashboardMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Save: () => <span data-testid="icon-save" />,
  Eye: () => <span data-testid="icon-eye" />,
  BarChart3: () => <span data-testid="icon-barchart" />,
}));

vi.mock('@/components/rapports-builder/ReportGrid', () => ({
  ReportGrid: (props: {
    widgets: Array<{ id: string; title: string }>;
    selectedId: string | null;
    onSelectWidget: (id: string) => void;
  }) => {
    reportGridProps.current = props;
    return (
      <div data-testid="report-grid">
        <div data-testid="grid-count">{props.widgets.length}</div>
        <div data-testid="grid-selected">{props.selectedId ?? 'none'}</div>
        <button onClick={() => props.onSelectWidget('w1')}>select-w1</button>
      </div>
    );
  },
}));

vi.mock('@/components/rapports-builder/panels/BlockLibrary', () => ({
  BlockLibrary: (props: { onAdd: (type: 'kpi' | 'bar') => void }) => {
    blockLibraryProps.current = props;
    return (
      <div data-testid="block-library">
        <button onClick={() => props.onAdd('kpi')}>add-kpi</button>
        <button onClick={() => props.onAdd('bar')}>add-bar</button>
      </div>
    );
  },
}));

vi.mock('@/components/rapports-builder/panels/BlockConfigPanel', () => ({
  BlockConfigPanel: (props: {
    widget: { id: string; title: string } | null;
    onUpdate: (patch: { title?: string }) => void;
    onDelete: () => void;
    onDuplicate: () => void;
  }) => {
    blockConfigPanelProps.current = props;
    return (
      <div data-testid="block-config-panel">
        <div data-testid="config-widget">{props.widget ? props.widget.title : 'none'}</div>
        <button onClick={() => props.onUpdate({ title: 'Titre modifié' })}>update-widget</button>
        <button onClick={props.onDelete}>delete-widget</button>
        <button onClick={props.onDuplicate}>duplicate-widget</button>
      </div>
    );
  },
}));

vi.mock('@/types/report', () => ({
  WIDGET_DEFAULT_SIZE: {
    kpi: { w: 3, h: 2 },
    bar: { w: 6, h: 4 },
  },
  MAX_WIDGETS_PER_DASHBOARD: 6,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input aria-label="nom-rapport" value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: usePageTitleMock,
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: (props: {
    isLoading: boolean;
    isError: boolean;
    error?: Error;
    onRetry: () => void;
    children: React.ReactNode;
  }) => {
    pageDataStateProps.current = props;
    return (
      <div data-testid="page-data-state">
        <div data-testid="pds-loading">{String(props.isLoading)}</div>
        <div data-testid="pds-error">{String(props.isError)}</div>
        <div data-testid="pds-message">{props.error?.message ?? ''}</div>
        <button onClick={props.onRetry}>retry</button>
        {props.children}
      </div>
    );
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
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('RapportBuilderEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blockLibraryProps.current = null;
    blockConfigPanelProps.current = null;
    reportGridProps.current = null;
    pageDataStateProps.current = null;

    useParamsMock.mockReturnValue({ id: 'dash-1' });
    mutateAsyncMock.mockResolvedValue({ data: null, error: null });
    useUpdateDashboardMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    });
  });

  it('affiche l’état de chargement via PageDataState', () => {
    useCustomDashboardMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    expect(screen.getByTestId('page-data-state')).toBeInTheDocument();
    expect(screen.getByTestId('pds-loading').textContent).toBe('true');
    expect(screen.getByTestId('pds-error').textContent).toBe('false');
    expect(usePageTitleMock).toHaveBeenCalledWith('Édition rapport');
  });

  it('affiche les données du dashboard, permet édition et sauvegarde', async () => {
    const refetchMock = vi.fn();
    useCustomDashboardMock.mockReturnValue({
      data: DASHBOARD,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock,
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue('Rapport ventes')).toBeInTheDocument();
    expect(screen.getByText('2/6 widgets')).toBeInTheDocument();
    expect(screen.getByTestId('report-grid')).toBeInTheDocument();
    expect(screen.getByTestId('grid-count').textContent).toBe('2');
    expect(usePageTitleMock).toHaveBeenCalledWith('Édition · Rapport ventes');

    fireEvent.click(screen.getByText('select-w1'));
    await waitFor(() => {
      expect(screen.getByTestId('config-widget').textContent).toBe('CA total');
    });

    fireEvent.click(screen.getByText('update-widget'));
    await waitFor(() => {
      expect(screen.getByTestId('config-widget').textContent).toBe('Titre modifié');
    });

    fireEvent.change(screen.getByLabelText('nom-rapport'), { target: { value: 'Rapport ventes final' } });
    expect(screen.getByDisplayValue('Rapport ventes final')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Enregistrer/));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        id: 'dash-1',
        patch: {
          nom: 'Rapport ventes final',
          widgets: [
            { id: 'w1', type: 'kpi', title: 'Titre modifié' },
            { id: 'w2', type: 'bar', title: 'Ventes par mois' },
          ],
          layout: DASHBOARD.layout,
        },
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Rapport sauvegardé');
  });

  it('affiche l’état d’erreur et permet retry', () => {
    const refetchMock = vi.fn();
    useCustomDashboardMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
      refetch: refetchMock,
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    expect(screen.getByTestId('page-data-state')).toBeInTheDocument();
    expect(screen.getByTestId('pds-loading').textContent).toBe('false');
    expect(screen.getByTestId('pds-error').textContent).toBe('true');
    expect(screen.getByTestId('pds-message').textContent).toBe('x');

    fireEvent.click(screen.getByText('retry'));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('affiche l’état vide quand aucun widget n’existe puis ajoute un bloc', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: EMPTY_DASHBOARD,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    expect(screen.getByText('Cliquez sur un bloc à gauche pour commencer')).toBeInTheDocument();
    expect(screen.getByText('0/6 widgets')).toBeInTheDocument();

    fireEvent.click(screen.getByText('add-kpi'));

    await waitFor(() => {
      expect(screen.getByTestId('report-grid')).toBeInTheDocument();
    });

    expect(screen.getByText('1/6 widgets')).toBeInTheDocument();
    expect(screen.getByTestId('grid-count').textContent).toBe('1');
  });

  it('duplique un widget sélectionné et affiche un toast de succès', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: DASHBOARD,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('select-w1'));

    await waitFor(() => {
      expect(screen.getByTestId('config-widget').textContent).toBe('CA total');
    });

    fireEvent.click(screen.getByText('duplicate-widget'));

    await waitFor(() => {
      expect(screen.getByText('3/6 widgets')).toBeInTheDocument();
    });

    expect(screen.getByTestId('grid-count').textContent).toBe('3');
    expect(toastSuccessMock).toHaveBeenCalledWith('Widget dupliqué');
  });

  it('supprime un widget sélectionné', async () => {
    useCustomDashboardMock.mockReturnValue({
      data: DASHBOARD,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('select-w1'));

    await waitFor(() => {
      expect(screen.getByTestId('config-widget').textContent).toBe('CA total');
    });

    fireEvent.click(screen.getByText('delete-widget'));

    await waitFor(() => {
      expect(screen.getByText('1/6 widgets')).toBeInTheDocument();
    });

    expect(screen.getByTestId('grid-count').textContent).toBe('1');
    expect(screen.getByTestId('config-widget').textContent).toBe('none');
  });

  it('navigue vers le détail et l’aperçu avec le bon id', () => {
    useCustomDashboardMock.mockReturnValue({
      data: DASHBOARD,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RapportBuilderEdit />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText(/Retour/));
    fireEvent.click(screen.getByText(/Aperçu/));

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/rapports-custom/dash-1');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/rapports-custom/dash-1');
  });
});