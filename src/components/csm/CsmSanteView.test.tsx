/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CsmSanteView } from './CsmSanteView';

const {
  ETABS,
  SANTE,
  KPIS,
  PROFILES_MAP,
  LAST_EMAIL_MAP,
  AUTH_STATE,
  navigateMock,
  invalidateQueriesMock,
  debugErrorMock,
  sanitizeEmailSubjectMock,
  productionState,
  santeState,
  kpisState,
  profilesState,
  emailsState,
  mockFrom,
  builder,
  weatherSaveFns,
  textSaveFns,
  listSaveFns,
} = vi.hoisted(() => {
  const ETABS = [
    {
      id: 'e1',
      nom: 'Clinique A',
      csm_id: 'c1',
      besoins_du_compte: 'Renfort',
      prochaine_action_orga: [{ id: 'a1', label: 'Former équipe' }],
    },
    {
      id: 'e2',
      nom: 'Hôpital B',
      csm_id: null,
      besoins_du_compte: null,
      prochaine_action_orga: null,
    },
  ];

  const SANTE = [
    {
      etablissement_id: 'e1',
      weather: 'sunny',
      taux_utilisation: 78,
      taux_utilisation_trend: 'up',
      taux_uhcd: 12,
      taux_uhcd_trend: 'stable',
    },
    {
      etablissement_id: 'e2',
      weather: 'stormy',
      taux_utilisation: 34,
      taux_utilisation_trend: 'down',
      taux_uhcd: 8,
      taux_uhcd_trend: 'up',
    },
  ];

  const KPIS = [
    { etablissement_id: 'e1', sort_order: 1, taux_satisfaction: 88 },
    { etablissement_id: 'e1', sort_order: 2, taux_satisfaction: 91 },
    { etablissement_id: 'e2', sort_order: 1, taux_satisfaction: 63 },
  ];

  const PROFILES_MAP = new Map([['c1', { full_name: 'Camille Martin' }]]);
  const LAST_EMAIL_MAP = new Map([
    [
      'e1',
      {
        id: 'thread-1',
        subject: 'Sujet original',
        ai_generated_title: 'Titre IA',
        last_message_date: '2024-01-10T00:00:00.000Z',
      },
    ],
  ]);

  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const navigateMock = vi.fn();
  const invalidateQueriesMock = vi.fn();
  const debugErrorMock = vi.fn();
  const sanitizeEmailSubjectMock = vi.fn((s: string) => `clean:${s}`);

  const productionState = {
    loading: false,
    data: ETABS,
    error: null as { message: string } | null,
  };
  const santeState = {
    loading: false,
    data: SANTE,
    error: null as { message: string } | null,
    upsert: vi.fn(),
  };
  const kpisState = {
    loading: false,
    data: KPIS,
    error: null as { message: string } | null,
  };
  const profilesState = {
    map: PROFILES_MAP,
  };
  const emailsState = {
    loading: false,
    data: LAST_EMAIL_MAP,
    error: null as { message: string } | null,
  };

  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  builder.select = chain;
  builder.eq = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.insert = chain;
  builder.delete = chain;
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.update = vi.fn(() => builder);
  builder.then = ((onFulfilled: (value: { data: null; error: null | { message: string } }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)) as unknown;
  builder.catch = ((onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)) as unknown;

  const mockFrom = vi.fn(() => builder);

  return {
    ETABS,
    SANTE,
    KPIS,
    PROFILES_MAP,
    LAST_EMAIL_MAP,
    AUTH_STATE,
    navigateMock,
    invalidateQueriesMock,
    debugErrorMock,
    sanitizeEmailSubjectMock,
    productionState,
    santeState,
    kpisState,
    profilesState,
    emailsState,
    mockFrom,
    builder,
    weatherSaveFns: [] as Array<(v: string) => void | Promise<void>>,
    textSaveFns: [] as Array<(v: string) => void | Promise<void>>,
    listSaveFns: [] as Array<(v: Array<{ id: string; label: string }> | null) => void | Promise<void>>,
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  TrendingUp: (props: Record<string, unknown>) => <svg data-testid="icon-up" {...props} />,
  TrendingDown: (props: Record<string, unknown>) => <svg data-testid="icon-down" {...props} />,
  Minus: (props: Record<string, unknown>) => <svg data-testid="icon-minus" {...props} />,
  Star: (props: Record<string, unknown>) => <svg data-testid="icon-star" {...props} />,
  Mail: (props: Record<string, unknown>) => <svg data-testid="icon-mail" {...props} />,
}));

vi.mock('@/components/csm/WeatherIcon', () => ({
  WEATHER_CONFIG: {
    sunny: { label: 'Ensoleillé' },
    'partly-cloudy': { label: 'Variable' },
    rainy: { label: 'Pluvieux' },
    stormy: { label: 'Orageux' },
    'not-started': { label: 'Non démarré' },
  },
  WeatherLegend: () => <div data-testid="weather-legend">legend</div>,
  WeatherIcon: ({ weather }: { weather: string }) => <div data-testid={`weather-${weather}`}>{weather}</div>,
}));

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: ({
    value,
    onSave,
  }: {
    value: string;
    onSave: (v: string) => void | Promise<void>;
  }) => {
    textSaveFns.push(onSave);
    return <button data-testid={`editable-cell-${value || 'empty'}`}>{value || '—'}</button>;
  },
}));

vi.mock('@/components/csm/EditableSelectCell', () => ({
  EditableSelectCell: ({
    value,
    onSave,
  }: {
    value: string;
    onSave: (v: string) => void | Promise<void>;
  }) => {
    weatherSaveFns.push(onSave);
    return <button data-testid={`editable-select-${value}`}>{value}</button>;
  },
}));

vi.mock('@/components/csm/EditableListCell', () => ({
  EditableListCell: ({
    items,
    onSave,
  }: {
    items: Array<{ id: string; label: string }> | null;
    onSave: (v: Array<{ id: string; label: string }> | null) => void | Promise<void>;
  }) => {
    listSaveFns.push(onSave);
    return (
      <button data-testid={`editable-list-${items ? items.length : 0}`}>
        {items ? items.map((i) => i.label).join(',') : 'none'}
      </button>
    );
  },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/csm/useCsmSante', () => ({
  useCsmSante: () => ({
    data: santeState.data,
    upsert: santeState.upsert,
    isLoading: santeState.loading,
    isError: Boolean(santeState.error),
    error: santeState.error,
  }),
}));

vi.mock('@/hooks/csm/useCsmKpisTrimestriels', () => ({
  useCsmKpisTrimestriels: () => ({
    data: kpisState.data,
    isLoading: kpisState.loading,
    isError: Boolean(kpisState.error),
    error: kpisState.error,
  }),
}));

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: () => ({
    data: productionState.data,
    isLoading: productionState.loading,
    isError: Boolean(productionState.error),
    error: productionState.error,
  }),
}));

vi.mock('@/hooks/profile/useProfilesMap', () => ({
  useProfilesMap: () => profilesState,
}));

vi.mock('@/hooks/email/useLastEmailByEtablissement', () => ({
  useLastEmailByEtablissement: () => ({
    data: emailsState.data,
    isLoading: emailsState.loading,
    isError: Boolean(emailsState.error),
    error: emailsState.error,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock('@/lib/emailUtils', () => ({
  sanitizeEmailSubject: sanitizeEmailSubjectMock,
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

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => 'il y a 2 jours',
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('CsmSanteView', () => {
  beforeEach(() => {
    productionState.loading = false;
    productionState.data = ETABS;
    productionState.error = null;

    santeState.loading = false;
    santeState.data = SANTE;
    santeState.error = null;
    santeState.upsert.mockClear();

    kpisState.loading = false;
    kpisState.data = KPIS;
    kpisState.error = null;

    profilesState.map = PROFILES_MAP;

    emailsState.loading = false;
    emailsState.data = LAST_EMAIL_MAP;
    emailsState.error = null;

    navigateMock.mockClear();
    invalidateQueriesMock.mockClear();
    debugErrorMock.mockClear();
    sanitizeEmailSubjectMock.mockClear();
    mockFrom.mockClear();
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.then = ((onFulfilled: (value: { data: null; error: null | { message: string } }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled)) as unknown;
    weatherSaveFns.length = 0;
    textSaveFns.length = 0;
    listSaveFns.length = 0;
  });

  it('affiche les données métier calculées et navigue vers la fiche établissement et le thread email', async () => {
    render(<CsmSanteView />, { wrapper: createWrapper() });

    expect(screen.getByTestId('weather-legend')).toBeInTheDocument();
    expect(screen.getByText('Clinique A')).toBeInTheDocument();
    expect(screen.getByText('Hôpital B')).toBeInTheDocument();
    expect(screen.getByText('Camille Martin')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('63%')).toBeInTheDocument();
    expect(screen.getByText('clean:Titre IA')).toBeInTheDocument();
    expect(screen.getByText('il y a 2 jours')).toBeInTheDocument();
    expect(screen.getByText('Aucun email associé')).toBeInTheDocument();
    expect(screen.getByTestId('weather-sunny')).toBeInTheDocument();
    expect(screen.getByTestId('weather-stormy')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clinique A'));
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/e1');

    fireEvent.click(screen.getByText('clean:Titre IA'));
    expect(navigateMock).toHaveBeenCalledWith('/emails?thread=thread-1');

    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith('Titre IA');
  });

  it('déclenche les mises à jour santé et établissement', async () => {
    render(<CsmSanteView />, { wrapper: createWrapper() });

    await weatherSaveFns[0]('rainy');
    expect(santeState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissement_id: 'e1',
        weather: 'rainy',
        taux_utilisation: 78,
        taux_uhcd: 12,
      }),
    );

    await textSaveFns[0]('82');
    expect(santeState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissement_id: 'e1',
        taux_utilisation: 82,
      }),
    );

    await listSaveFns[0]([{ id: 'a2', label: 'Planifier comité' }]);

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(builder.update).toHaveBeenCalledWith({
      prochaine_action_orga: [{ id: 'a2', label: 'Planifier comité' }],
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'e1');
    await waitFor(() => {
      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['production'] });
    });
  });

  it('gère une erreur de mise à jour établissement sans invalider les queries', async () => {
    builder.then = ((onFulfilled: (value: { data: null; error: { message: string } }) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'x' } }).then(onFulfilled)) as unknown;

    render(<CsmSanteView />, { wrapper: createWrapper() });

    await listSaveFns[0]([{ id: 'a3', label: 'Escalader sujet' }]);

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalled();
    });
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });

  it('supporte l’état de chargement puis le succès', async () => {
    productionState.loading = true;
    productionState.data = [];
    santeState.loading = true;
    santeState.data = [];
    kpisState.loading = true;
    kpisState.data = [];
    emailsState.loading = true;
    emailsState.data = new Map();

    const { rerender } = render(<CsmSanteView />, { wrapper: createWrapper() });

    expect(screen.getByTestId('weather-legend')).toBeInTheDocument();
    expect(screen.queryByText('Clinique A')).not.toBeInTheDocument();

    productionState.loading = false;
    productionState.data = ETABS;
    santeState.loading = false;
    santeState.data = SANTE;
    kpisState.loading = false;
    kpisState.data = KPIS;
    emailsState.loading = false;
    emailsState.data = LAST_EMAIL_MAP;

    rerender(<CsmSanteView />);

    expect(await screen.findByText('Clinique A')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
  });

  it('supporte un état erreur des hooks en restant rendu sans données', () => {
    productionState.error = { message: 'x' };
    productionState.data = [];
    santeState.error = { message: 'x' };
    santeState.data = [];
    kpisState.error = { message: 'x' };
    kpisState.data = [];
    emailsState.error = { message: 'x' };
    emailsState.data = new Map();

    render(<CsmSanteView />, { wrapper: createWrapper() });

    expect(screen.getByTestId('weather-legend')).toBeInTheDocument();
    expect(screen.queryByText('Clinique A')).not.toBeInTheDocument();
    expect(screen.queryByText('Hôpital B')).not.toBeInTheDocument();
  });
});