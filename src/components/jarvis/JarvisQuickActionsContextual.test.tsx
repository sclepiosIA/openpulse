// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisQuickActionsContextual } from './JarvisQuickActionsContextual';

const {
  authState,
  pageContextState,
  locationState,
  navigateMock,
  toastSuccess,
  toastError,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const authState = {
    user: { id: 'u1', email: 'test@example.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const pageContextState: { primaryEntity?: { id?: string } } = {
    primaryEntity: { id: 'eta-123' },
  };

  const locationState = {
    pathname: '/',
  };

  const navigateMock = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const resolved = { data: null, error: null };

  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  } = {} as Record<string, ReturnType<typeof vi.fn>> & {
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  };

  const chainMethods = [
    'select',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'is',
    'like',
    'ilike',
    'or',
    'not',
    'order',
    'limit',
    'range',
    'insert',
    'update',
    'upsert',
    'delete',
  ] as const;

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }

  builder.single = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(resolved).then(onFulfilled, onRejected);
  builder.catch = (onRejected) => Promise.resolve(resolved).catch(onRejected);

  const mockFrom = vi.fn(() => builder);

  return {
    authState,
    pageContextState,
    locationState,
    navigateMock,
    toastSuccess,
    toastError,
    builder,
    mockFrom,
  };
});

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useNavigate: () => navigateMock,
}));

vi.mock('@/hooks/jarvis/useJarvisPageContext', () => ({
  useJarvisPageContext: () => pageContextState,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children, side, className }: { children: React.ReactNode; side?: string; className?: string }) => (
    <div data-side={side} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span className={className} data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode; mode?: string }) => <>{children}</>,
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    FileText: Icon,
    Mail: Icon,
    CheckSquare: Icon,
    BarChart2: Icon,
    Zap: Icon,
    Calendar: Icon,
    DollarSign: Icon,
    Users: Icon,
    Ticket: Icon,
    RefreshCw: Icon,
    Clock: Icon,
    TrendingUp: Icon,
    Send: Icon,
    Archive: Icon,
    Languages: Icon,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
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

describe('JarvisQuickActionsContextual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationState.pathname = '/';
    pageContextState.primaryEntity = { id: 'eta-123' };
  });

  it('monte dans un wrapper QueryClientProvider via renderHook sans erreur', async () => {
    const { result } = renderHook(() => 1, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current).toBe(1);
    });
  });

  it('affiche les actions du dashboard triées par priorité et le badge du module', () => {
    const onExecute = vi.fn();

    render(<JarvisQuickActionsContextual onExecute={onExecute} />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toHaveTextContent('Briefing');
    expect(buttons[1]).toHaveTextContent('Tâches');
    expect(buttons[2]).toHaveTextContent('Emails');
    expect(buttons[3]).toHaveTextContent('Pipeline');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('limite le nombre d’actions avec maxActions', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/emails';

    render(<JarvisQuickActionsContextual onExecute={onExecute} maxActions={2} />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('Résumé');
    expect(buttons[1]).toHaveTextContent('Traduire');
    expect(screen.queryByRole('button', { name: /Archiver/i })).not.toBeInTheDocument();
  });

  it('enrichit la commande sur une page de détail établissement avec l’ID du contexte', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/etablissements/abc-123';
    pageContextState.primaryEntity = { id: 'eta-42' };

    render(<JarvisQuickActionsContextual onExecute={onExecute} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Résumé/i }));

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(
      'Résume cet établissement avec son historique récent (ID établissement: eta-42)'
    );
  });

  it('n’enrichit pas la commande si aucun primaryEntity n’est disponible', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/etablissements/abc-123';
    pageContextState.primaryEntity = undefined;

    render(<JarvisQuickActionsContextual onExecute={onExecute} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Email/i }));

    expect(onExecute).toHaveBeenCalledWith('Rédige un email de suivi pour cet établissement');
  });

  it('utilise les actions par défaut pour un module inconnu', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/module-inconnu';

    render(<JarvisQuickActionsContextual onExecute={onExecute} />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('Briefing');
    expect(buttons[1]).toHaveTextContent('Tâches');
    expect(buttons[2]).toHaveTextContent('Emails');
    expect(screen.queryByText('default')).not.toBeInTheDocument();
  });

  it('désactive les boutons quand isDisabled=true', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/support';

    render(<JarvisQuickActionsContextual onExecute={onExecute} isDisabled />, {
      wrapper: createWrapper(),
    });

    const button = screen.getAllByRole('button')[0];
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('en mode compact masque les labels texte et le badge module', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/calendrier';

    const { container } = render(
      <JarvisQuickActionsContextual onExecute={onExecute} compact />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('calendrier')).not.toBeInTheDocument();
    expect(screen.queryByText("Aujourd'hui")).not.toBeInTheDocument();
    expect(screen.queryByText('Semaine')).not.toBeInTheDocument();
    expect(screen.queryByText('Conflits')).not.toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(3);
  });

  it('affiche le contenu du tooltip avec le label complet, la commande et la catégorie sans ambiguïté', () => {
    const onExecute = vi.fn();
    locationState.pathname = '/tresorerie';

    render(<JarvisQuickActionsContextual onExecute={onExecute} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Sync Qonto')).toBeInTheDocument();
    expect(screen.getByText('Synchronise les transactions Qonto des 30 derniers jours')).toBeInTheDocument();
    expect(screen.getAllByText('management')).toHaveLength(3);
    expect(screen.getByText('tresorerie')).toBeInTheDocument();
  });
});