import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  HOOK_STATE,
  DASHBOARDS,
  mockNavigate,
  mockRefetch,
  mockCreateMutateAsync,
  mockDupMutate,
  mockDelMutate,
  mockConfirm,
} = vi.hoisted(() => ({
  HOOK_STATE: { mode: 'success' as 'loading' | 'success' | 'error' },
  DASHBOARDS: [
    {
      id: 'd1',
      nom: 'Pipeline mensuel',
      description: 'Analyse pipeline',
      is_template: false,
      widgets: [{}, {}, {}],
      updated_at: '2024-11-10T12:00:00.000Z',
      is_shared: true,
    },
    {
      id: 'd2',
      nom: 'Suivi hebdo',
      description: '',
      is_template: false,
      widgets: [],
      updated_at: '2024-11-11T12:00:00.000Z',
      is_shared: false,
    },
    {
      id: 't1',
      nom: 'Modèle Ventes',
      description: "Prêt à l'emploi",
      is_template: true,
      widgets: [{}, {}],
      updated_at: '2024-11-12T12:00:00.000Z',
      is_shared: false,
    },
  ],
  mockNavigate: vi.fn(),
  mockRefetch: vi.fn(),
  mockCreateMutateAsync: vi.fn(),
  mockDupMutate: vi.fn(),
  mockDelMutate: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/dashboard/useCustomDashboards', () => ({
  useCustomDashboards: () => {
    if (HOOK_STATE.mode === 'loading') {
      return { data: undefined, isLoading: true, isError: false, refetch: mockRefetch };
    }
    if (HOOK_STATE.mode === 'error') {
      return { data: null, isLoading: false, isError: true, refetch: mockRefetch };
    }
    return { data: DASHBOARDS, isLoading: false, isError: false, refetch: mockRefetch };
  },
  useCreateDashboard: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useDuplicateDashboard: () => ({
    mutate: mockDupMutate,
    isPending: false,
  }),
  useDeleteDashboard: () => ({
    mutate: mockDelMutate,
    isPending: false,
  }),
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: () => {},
}));

vi.mock('lucide-react', () => {
  const Icon = ({ children, ...props }: any) => <span {...props}>{children}</span>;
  return {
    BarChart3: Icon,
    Plus: Icon,
    Copy: Icon,
    Trash2: Icon,
    Eye: Icon,
    Pencil: Icon,
    Sparkles: Icon,
    Search: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => {
    const { children, onClick, disabled, 'aria-label': ariaLabel, ...rest } = props;
    return (
      <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: (props: any) => <div data-testid="card" {...props} />,
  CardContent: (props: any) => <div data-testid="card-content" {...props} />,
  CardHeader: (props: any) => <div data-testid="card-header" {...props} />,
  CardTitle: (props: any) => <div data-testid="card-title" {...props} />,
  CardDescription: (props: any) => <div data-testid="card-description" {...props} />,
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title, subtitle, stats, actions }: any) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
      {Array.isArray(stats) ? (
        <ul>
          {stats.map((s: any) => (
            <li key={s.label}>
              {s.label}: {s.value}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ),
}));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: (props: any) => <div {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: any) => <span {...props} />,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: (props: any) => <div {...props} />,
  DialogHeader: (props: any) => <div {...props} />,
  DialogTitle: (props: any) => <div {...props} />,
  DialogFooter: (props: any) => <div {...props} />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...rest }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, rows, ...rest }: any) => (
    <textarea value={value} onChange={onChange} rows={rows} {...rest} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...rest }: any) => <label {...rest}>{children}</label>,
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({ isLoading, isError, onRetry, children }: any) => (
    <div>
      {isError ? (
        <div>
          Erreur
          <button onClick={onRetry}>Réessayer</button>
        </div>
      ) : null}
      {children}
    </div>
  ),
}));

import RapportsBuilderList from './RapportsBuilderList';

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('RapportsBuilderList', () => {
  beforeEach(() => {
    HOOK_STATE.mode = 'success';
    mockNavigate.mockReset();
    mockRefetch.mockReset();
    mockCreateMutateAsync.mockReset();
    mockDupMutate.mockReset();
    mockDelMutate.mockReset();
    mockConfirm.mockReset();
    mockConfirm.mockReturnValue(false);
    // @ts-expect-error
    global.confirm = mockConfirm;
  });

  it('affiche chargement puis les données (stats, listes) une fois disponibles', async () => {
    HOOK_STATE.mode = 'loading';
    const { rerender } = renderWithProviders(<RapportsBuilderList />);
    expect(screen.getByText('Chargement…')).toBeInTheDocument();

    HOOK_STATE.mode = 'success';
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
          })
        }
      >
        <RapportsBuilderList />
      </QueryClientProvider>
    );

    expect(screen.getByText('rapports: 2')).toBeInTheDocument();
    expect(screen.getByText('modèles: 1')).toBeInTheDocument();

    expect(screen.getByText('Mes rapports (2)')).toBeInTheDocument();
    expect(screen.getByText('Pipeline mensuel')).toBeInTheDocument();
    expect(screen.getByText('Suivi hebdo')).toBeInTheDocument();

    expect(screen.getByText(/3 widgets/i)).toBeInTheDocument();
    expect(screen.getByText(/0 widget/i)).toBeInTheDocument();

    expect(screen.getByText('Modèles pré-configurés')).toBeInTheDocument();
    expect(screen.getByText('Modèle Ventes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Utiliser' })).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: 'Voir' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Modifier' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Copier' }).length).toBeGreaterThan(0);
  });

  it('ouvre le dialogue, crée un nouveau rapport et redirige vers son édition', async () => {
    const user = userEvent.setup();
    mockCreateMutateAsync.mockResolvedValue({ id: 'new1' });

    renderWithProviders(<RapportsBuilderList />);

    await user.click(screen.getByRole('button', { name: 'Nouveau rapport' }));

    const dialog = screen.getByRole('dialog');

    const nameInput = within(dialog).getByPlaceholderText('Ex : Pipeline mensuel direction');
    await user.clear(nameInput);
    await user.type(nameInput, 'Rapport X');

    const textboxes = within(dialog).getAllByRole('textbox') as HTMLElement[];
    const descTextarea = textboxes.find(el => el.tagName.toLowerCase() === 'textarea') as HTMLTextAreaElement;
    await user.clear(descTextarea);
    await user.type(descTextarea, 'Desc');

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Créer' }));
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({ nom: 'Rapport X', description: 'Desc' });
    expect(mockNavigate).toHaveBeenCalledWith('/rapports-custom/new1/edit');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('duplique depuis un modèle et depuis un rapport existant', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RapportsBuilderList />);

    await user.click(screen.getByRole('button', { name: 'Utiliser' }));
    expect(mockDupMutate).toHaveBeenCalledTimes(1);
    expect(mockDupMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', nom: 'Modèle Ventes', is_template: true })
    );

    const pipelineCard = screen.getByText('Pipeline mensuel').closest('[data-testid="card"]') as HTMLElement;
    const withinPipeline = within(pipelineCard);
    await user.click(withinPipeline.getByRole('button', { name: 'Copier' }));

    expect(mockDupMutate).toHaveBeenCalledTimes(2);
    expect(mockDupMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'd1', nom: 'Pipeline mensuel', is_template: false })
    );
  });

  it('supprime un rapport après confirmation', async () => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(true);
    renderWithProviders(<RapportsBuilderList />);

    const suiviCard = screen.getByText('Suivi hebdo').closest('[data-testid="card"]') as HTMLElement;
    const withinSuivi = within(suiviCard);
    await user.click(withinSuivi.getByRole('button', { name: 'Supprimer' }));

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDelMutate).toHaveBeenCalledTimes(1);
    expect(mockDelMutate).toHaveBeenCalledWith('d2');
  });

  it("gère l'état d'erreur et permet de relancer le chargement", async () => {
    const user = userEvent.setup();
    HOOK_STATE.mode = 'error';
    renderWithProviders(<RapportsBuilderList />);

    expect(screen.getByText('Erreur')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('navigue vers aperçu et édition', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RapportsBuilderList />);

    await user.click(screen.getByRole('button', { name: 'Aperçu' }));
    expect(mockNavigate).toHaveBeenCalledWith('/rapports-custom/t1');

    const pipelineCard = screen.getByText('Pipeline mensuel').closest('[data-testid="card"]') as HTMLElement;
    const withinPipeline = within(pipelineCard);
    await user.click(withinPipeline.getByRole('button', { name: 'Voir' }));
    expect(mockNavigate).toHaveBeenCalledWith('/rapports-custom/d1');

    await user.click(withinPipeline.getByRole('button', { name: 'Modifier' }));
    expect(mockNavigate).toHaveBeenCalledWith('/rapports-custom/d1/edit');
  });

  it('filtre la liste via la recherche', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RapportsBuilderList />);

    const searchInput = screen.getByPlaceholderText('Rechercher un rapport…');
    await user.type(searchInput, 'pipeline');

    expect(screen.getByText('Mes rapports (1)')).toBeInTheDocument();
    expect(screen.getByText('Pipeline mensuel')).toBeInTheDocument();
    expect(screen.queryByText('Suivi hebdo')).not.toBeInTheDocument();
  });
});