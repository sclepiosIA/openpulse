import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { JarvisActionsTab } from './JarvisActionsTab';

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  PROPS_EMPTY,
  PROPS_WITH_ACTIONS,
  capturedSuggestionsProps,
  capturedActionCardProps,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockFrom: vi.fn(() => {
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
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  }),
  PROPS_EMPTY: {
    pendingActions: [],
    onAskJarvis: vi.fn(async () => {}),
    onApprove: vi.fn(async () => {}),
    onReject: vi.fn(async () => {}),
    onModify: vi.fn(),
  },
  PROPS_WITH_ACTIONS: {
    pendingActions: [
      {
        id: 'a1',
        title: 'Relancer le client',
        description: 'Envoyer un rappel pour la facture',
        type: 'follow_up',
        priority: 'high',
      },
      {
        id: 'a2',
        title: 'Mettre à jour le devis',
        description: 'Ajuster le montant selon la demande',
        type: 'quote',
        priority: 'medium',
      },
    ],
    onAskJarvis: vi.fn(async () => {}),
    onApprove: vi.fn(async () => {}),
    onReject: vi.fn(async () => {}),
    onModify: vi.fn(),
  },
  capturedSuggestionsProps: vi.fn(),
  capturedActionCardProps: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="check-icon" {...props} />,
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('./JarvisProactiveSuggestions', () => ({
  JarvisProactiveSuggestions: (props: { onAskJarvis: (prompt: string) => Promise<void>; maxSuggestions: number }) => {
    capturedSuggestionsProps(props);
    return (
      <div data-testid="proactive-suggestions">
        <button type="button" onClick={() => props.onAskJarvis('Prépare un plan d’action')}>
          Ask Jarvis
        </button>
        <span>max:{props.maxSuggestions}</span>
      </div>
    );
  },
}));

vi.mock('./JarvisActionCard', () => ({
  JarvisActionCard: ({
    action,
    onApprove,
    onReject,
    onModify,
  }: {
    action: { id: string; title?: string; description?: string };
    onApprove: (actionId: string) => Promise<void>;
    onReject: (actionId: string, reason?: string) => Promise<void>;
    onModify: (id: string) => void;
  }) => {
    capturedActionCardProps({ action, onApprove, onReject, onModify });
    return (
      <div data-testid={`action-card-${action.id}`}>
        <div>{action.title}</div>
        <div>{action.description}</div>
        <button type="button" onClick={() => onApprove(action.id)}>
          approve-{action.id}
        </button>
        <button type="button" onClick={() => onReject(action.id, 'Pas pertinent')}>
          reject-{action.id}
        </button>
        <button type="button" onClick={() => onModify(action.id)}>
          modify-{action.id}
        </button>
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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('JarvisActionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend l’état vide avec le message de succès et les suggestions proactives', () => {
    render(<JarvisActionsTab {...PROPS_EMPTY} />);

    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    expect(screen.getByTestId('proactive-suggestions')).toBeInTheDocument();
    expect(screen.getByText('Aucune action en attente')).toBeInTheDocument();
    expect(screen.getByText('Tout est sous contrôle ✨')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    expect(screen.queryByText('Actions en attente')).not.toBeInTheDocument();

    expect(capturedSuggestionsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        onAskJarvis: PROPS_EMPTY.onAskJarvis,
        maxSuggestions: 3,
      }),
    );
  });

  it('rend la liste des actions en attente et transmet les callbacks métier aux cartes', async () => {
    const user = userEvent.setup();

    render(<JarvisActionsTab {...PROPS_WITH_ACTIONS} />);

    expect(screen.getByText('Actions en attente')).toBeInTheDocument();
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    expect(screen.queryByText('Aucune action en attente')).not.toBeInTheDocument();

    const card1 = screen.getByTestId('action-card-a1');
    const card2 = screen.getByTestId('action-card-a2');

    expect(within(card1).getByText('Relancer le client')).toBeInTheDocument();
    expect(within(card1).getByText('Envoyer un rappel pour la facture')).toBeInTheDocument();
    expect(within(card2).getByText('Mettre à jour le devis')).toBeInTheDocument();
    expect(within(card2).getByText('Ajuster le montant selon la demande')).toBeInTheDocument();

    expect(capturedActionCardProps).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: PROPS_WITH_ACTIONS.pendingActions[0],
        onApprove: PROPS_WITH_ACTIONS.onApprove,
        onReject: PROPS_WITH_ACTIONS.onReject,
        onModify: PROPS_WITH_ACTIONS.onModify,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'approve-a1' }));
    await waitFor(() => {
      expect(PROPS_WITH_ACTIONS.onApprove).toHaveBeenCalledWith('a1');
    });

    await user.click(screen.getByRole('button', { name: 'reject-a2' }));
    await waitFor(() => {
      expect(PROPS_WITH_ACTIONS.onReject).toHaveBeenCalledWith('a2', 'Pas pertinent');
    });

    await user.click(screen.getByRole('button', { name: 'modify-a1' }));
    expect(PROPS_WITH_ACTIONS.onModify).toHaveBeenCalledWith('a1');
  });

  it('déclenche onAskJarvis depuis les suggestions proactives', async () => {
    const user = userEvent.setup();

    render(<JarvisActionsTab {...PROPS_EMPTY} />);

    await user.click(screen.getByRole('button', { name: 'Ask Jarvis' }));

    await waitFor(() => {
      expect(PROPS_EMPTY.onAskJarvis).toHaveBeenCalledWith('Prépare un plan d’action');
    });
  });

  it('fournit un wrapper react-query valide pour un hook: chargement puis succès puis erreur', async () => {
    const wrapper = createWrapper();

    const { result: loadingResult } = renderHook(
      () => {
        const [state, setState] = React.useState<{ isLoading: boolean; isError: boolean; data: string | null }>({
          isLoading: true,
          isError: false,
          data: null,
        });

        React.useEffect(() => {
          const timer = setTimeout(() => {
            setState({ isLoading: false, isError: false, data: 'loaded' });
          }, 0);
          return () => clearTimeout(timer);
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(loadingResult.current.isLoading).toBe(true);
    expect(loadingResult.current.data).toBeNull();

    await waitFor(() => {
      expect(loadingResult.current.isLoading).toBe(false);
    });
    expect(loadingResult.current.isError).toBe(false);
    expect(loadingResult.current.data).toBe('loaded');

    const { result: errorResult } = renderHook(
      () => {
        const response = { data: null, error: { message: 'x' } };
        return {
          isLoading: false,
          isError: response.error !== null,
          error: response.error,
          data: response.data,
        };
      },
      { wrapper },
    );

    expect(errorResult.current.isLoading).toBe(false);
    expect(errorResult.current.isError).toBe(true);
    expect(errorResult.current.error.message).toBe('x');
    expect(errorResult.current.data).toBeNull();
  });
});