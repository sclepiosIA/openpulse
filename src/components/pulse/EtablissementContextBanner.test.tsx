// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EtablissementContextBanner } from './EtablissementContextBanner';

const {
  ETABLISSEMENT,
  TASKS,
  EMAIL_ROWS,
  AUTH_STATE,
  mockFrom,
  mockUseEtablissement,
  mockGetStatusBadgeVariant,
  mockCn,
} = vi.hoisted(() => ({
  ETABLISSEMENT: {
    id: 'eta-1',
    nom: 'Lycée Horizon',
    logo_url: 'https://img/logo.png',
    ville: 'Lyon',
    statut: 'Actif',
    progression: 72,
    prochaine_action_csm: 'Appeler le responsable',
    prochaine_action_orga: 'Valider le planning',
  },
  TASKS: [
    { id: 't1', titre: 'Préparer la rentrée', statut: 'En cours', echeance: '2024-03-10T00:00:00.000Z' },
    { id: 't2', titre: 'Bloquant administratif', statut: 'Bloqué', echeance: '2024-03-12T00:00:00.000Z' },
    { id: 't3', titre: 'Envoyer documents', statut: 'À faire', echeance: null },
    { id: 't4', titre: 'Tâche masquée', statut: 'En cours', echeance: '2024-03-20T00:00:00.000Z' },
  ],
  EMAIL_ROWS: [
    {
      id: 'e1',
      subject: 'Sujet de secours',
      ai_generated_title: 'Suivi onboarding',
      ai_summary: 'Résumé du dernier échange',
      last_message_date: '2024-03-15T00:00:00.000Z',
    },
  ],
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockUseEtablissement: vi.fn(),
  mockGetStatusBadgeVariant: vi.fn(),
  mockCn: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Building2: Icon,
    ExternalLink: Icon,
    MapPin: Icon,
    ChevronDown: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    Mail: Icon,
    Target: Icon,
    TrendingUp: Icon,
  };
});

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ className, children }: { className?: string; children: React.ReactNode }) => <div data-testid="avatar" className={className}>{children}</div>,
  AvatarImage: ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => <img data-testid="avatar-image" src={src} alt={alt} className={className} />,
  AvatarFallback: ({ className, children }: { className?: string; children: React.ReactNode }) => <div data-testid="avatar-fallback" className={className}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ variant, className, children }: { variant?: string; className?: string; children: React.ReactNode }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissement: mockUseEtablissement,
}));

vi.mock('@/config/statusConfig', () => ({
  getStatusBadgeVariant: mockGetStatusBadgeVariant,
}));

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
  useSession: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder(table: string, mode: 'success' | 'error') {
  let resolveValue: { data: unknown; error: { message: string } | null } = { data: null, error: null };

  if (table === 'taches') {
    resolveValue = mode === 'error'
      ? { data: null, error: { message: 'x' } }
      : { data: TASKS, error: null };
  }

  if (table === 'email_threads') {
    resolveValue = mode === 'error'
      ? { data: null, error: { message: 'x' } }
      : { data: EMAIL_ROWS, error: null };
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolveValue)),
    maybeSingle: vi.fn(() => Promise.resolve(resolveValue)),
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(resolveValue).catch(onRejected),
  };

  return builder;
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseEtablissement.mockReturnValue({ data: ETABLISSEMENT });
  mockGetStatusBadgeVariant.mockImplementation((status: string) => `variant-${status}`);
  mockCn.mockImplementation((...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '));
  mockFrom.mockImplementation((table: string) => createBuilder(table, 'success'));
});

describe('EtablissementContextBanner', () => {
  it('affiche les informations principales sans détails au chargement initial', () => {
    renderWithClient(<EtablissementContextBanner etablissementId="eta-1" />);

    expect(screen.getByText('Lycée Horizon')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('Actif');
    expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'variant-Actif');
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/etablissements/eta-1');
    expect(screen.getByRole('button', { name: 'Afficher les détails' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/tâche/)).not.toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('affiche les détails métier après expansion avec tâches, email, progression et prochaines actions', async () => {
    renderWithClient(<EtablissementContextBanner etablissementId="eta-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Afficher les détails' }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches');
      expect(mockFrom).toHaveBeenCalledWith('email_threads');
    });

    expect(await screen.findByText('4 tâches en cours')).toBeInTheDocument();
    expect(screen.getByText('Préparer la rentrée')).toBeInTheDocument();
    expect(screen.getByText('Bloquant administratif')).toBeInTheDocument();
    expect(screen.getByText('Envoyer documents')).toBeInTheDocument();
    expect(screen.queryByText('Tâche masquée')).not.toBeInTheDocument();

    expect(screen.getByText('Dernier email :')).toBeInTheDocument();
    expect(screen.getByText('Suivi onboarding')).toBeInTheDocument();
    expect(screen.getByText('Résumé du dernier échange')).toBeInTheDocument();

    expect(screen.getByText('CSM :', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/Appeler le responsable/)).toBeInTheDocument();
    expect(screen.getByText('Orga :', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/Valider le planning/)).toBeInTheDocument();

    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '72');
    expect(screen.getAllByText('72%')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Réduire les détails' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('retombe sur les props quand le hook etablissement ne renvoie pas de données', () => {
    mockUseEtablissement.mockReturnValue({ data: undefined });

    renderWithClient(
      <EtablissementContextBanner
        etablissementId="eta-2"
        etablissementNom="Nom prop"
        etablissementLogoUrl="https://img/fallback.png"
        isMobileView
      />
    );

    expect(screen.getByText('Nom prop')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-image')).toHaveAttribute('src', 'https://img/fallback.png');
    expect(screen.queryByRole('button', { name: /détails/i })).not.toBeInTheDocument();
  });

  it('gère une erreur de requête tâches sans afficher les détails de tâches mais conserve le reste de l’UI', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'taches') return createBuilder(table, 'error');
      return createBuilder(table, 'success');
    });

    renderWithClient(<EtablissementContextBanner etablissementId="eta-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Afficher les détails' }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches');
      expect(mockFrom).toHaveBeenCalledWith('email_threads');
    });

    await waitFor(() => {
      expect(screen.getByText('Suivi onboarding')).toBeInTheDocument();
    });

    expect(screen.queryByText(/tâche en cours|tâches en cours/)).not.toBeInTheDocument();
    expect(screen.getByText(/Appeler le responsable/)).toBeInTheDocument();
    expect(screen.getByText(/Valider le planning/)).toBeInTheDocument();
  });
});