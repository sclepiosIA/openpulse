/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskLinkerModal } from './TaskLinkerModal';

const {
  TASKS_ROWS,
  AUTH_STATE,
  MESSAGE,
  mockFrom,
  mockFromExtended,
  invalidateQueries,
  toastSuccess,
  toastError,
  debugError,
  onOpenChange,
  createMutate,
  createHookState,
  supabaseState,
  extendedState,
} = vi.hoisted(() => {
  const TASKS_ROWS = [
    {
      id: 'task-1',
      titre: 'Préparer dossier patient',
      statut: 'a_faire',
      priorite: 'haute',
      etablissement: { nom: 'Clinique du Lac' },
    },
    {
      id: 'task-2',
      titre: 'Appeler la famille',
      statut: 'en_cours',
      priorite: 'moyenne',
      etablissement: null,
    },
  ];

  const AUTH_STATE = {
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const MESSAGE = {
    id: 'msg-1',
    content: 'Besoin de créer une tâche pour le suivi du patient après la visite.',
    user: { prenom: 'Alice' },
  };

  const supabaseState = {
    mode: 'success' as 'success' | 'error' | 'loading',
    delayMs: 0,
  };

  const extendedState = {
    insertResult: { error: null as null | { message: string } },
  };

  const mockFrom = vi.fn();
  const mockFromExtended = vi.fn();
  const invalidateQueries = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const debugError = vi.fn();
  const onOpenChange = vi.fn();
  const createMutate = vi.fn();
  const createHookState = {
    isPending: false,
  };

  return {
    TASKS_ROWS,
    AUTH_STATE,
    MESSAGE,
    mockFrom,
    mockFromExtended,
    invalidateQueries,
    toastSuccess,
    toastError,
    debugError,
    onOpenChange,
    createMutate,
    createHookState,
    supabaseState,
    extendedState,
  };
});

function createThenableBuilder(resultFactory: () => Promise<{ data: unknown; error: null | { message: string } }>) {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: <TResult1 = { data: unknown; error: null | { message: string } }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: null | { message: string } }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => Promise<{ data: unknown; error: null | { message: string } } | TResult>;
  } = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    single: vi.fn(async () => resultFactory()),
    maybeSingle: vi.fn(async () => resultFactory()),
    then(onfulfilled, onrejected) {
      return resultFactory().then(onfulfilled, onrejected);
    },
    catch(onrejected) {
      return resultFactory().catch(onrejected);
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/calendar/useCalendarEventActions', () => ({
  usePulseTaskCreate: () => ({
    mutate: createMutate,
    isPending: createHookState.isPending,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props);
  return {
    CheckSquare: Icon,
    Link2: Icon,
    Plus: Icon,
    Search: Icon,
    Loader2: Icon,
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    id,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    id?: string;
    className?: string;
  }) => <input id={id} className={className} value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('@/components/ui/tabs', async () => {
  const ReactModule = await import('react');
  const TabsContext = ReactModule.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({
    value: 'link',
    onValueChange: () => {},
  });

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>,
    TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    TabsTrigger: ({
      value,
      onClick,
      children,
      className,
    }: {
      value: string;
      onClick?: () => void;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = ReactModule.useContext(TabsContext);
      return (
        <button
          type="button"
          className={className}
          onClick={() => {
            ctx.onValueChange(value);
            onClick?.();
          }}
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
      const ctx = ReactModule.useContext(TabsContext);
      if (ctx.value !== value) return null;
      return <div className={className}>{children}</div>;
    },
  };
});

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

function renderModal() {
  return render(
    <TaskLinkerModal
      open
      onOpenChange={onOpenChange}
      message={MESSAGE}
      conversationId="conv-1"
    />,
    { wrapper: createWrapper() },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseState.mode = 'success';
  supabaseState.delayMs = 0;
  extendedState.insertResult = { error: null };

  mockFrom.mockImplementation(() =>
    createThenableBuilder(async () => {
      if (supabaseState.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, supabaseState.delayMs));
      }

      if (supabaseState.mode === 'error') {
        return { data: null, error: { message: 'x' } };
      }

      if (supabaseState.mode === 'loading') {
        await new Promise(() => {});
      }

      return { data: TASKS_ROWS, error: null };
    }),
  );

  mockFromExtended.mockImplementation(() =>
    createThenableBuilder(async () => ({
      data: null,
      error: extendedState.insertResult.error,
    })),
  );

  createMutate.mockImplementation(
    (
      variables: { titre: string; description: string },
      options?: { onSuccess?: (data: { id: string }) => void | Promise<void> },
    ) => {
      void variables;
      if (options?.onSuccess) {
        return options.onSuccess({ id: 'created-task-1' });
      }
      return undefined;
    },
  );
});

describe('TaskLinkerModal', () => {
  it('affiche le chargement puis les tâches récupérées avec leurs valeurs métier', async () => {
    supabaseState.delayMs = 30;

    renderModal();

    expect(screen.getByPlaceholderText('Rechercher une tâche...')).toBeInTheDocument();
    expect(screen.getByText('Message de Alice')).toBeInTheDocument();
    expect(screen.getByText(MESSAGE.content)).toBeInTheDocument();

    expect(screen.getByTestId('dialog-root')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches');
    });

    const taskTitle = await screen.findByText('Préparer dossier patient');
    expect(taskTitle).toBeInTheDocument();
    expect(screen.getByText('a faire')).toBeInTheDocument();
    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Appeler la famille')).toBeInTheDocument();
    expect(screen.getByText('en cours')).toBeInTheDocument();
  });

  it('lie une tâche existante et invalide les messages', async () => {
    const user = userEvent.setup();

    renderModal();

    await screen.findByText('Préparer dossier patient');

    await user.click(screen.getByText('Préparer dossier patient'));
    await user.click(screen.getByRole('button', { name: /Lier la tâche/i }));

    await waitFor(() => {
      expect(mockFromExtended).toHaveBeenCalledWith('pulse_message_task_links');
    });

    const insertBuilder = mockFromExtended.mock.results[0]?.value as {
      insert: ReturnType<typeof vi.fn>;
    };

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      message_id: 'msg-1',
      task_id: 'task-1',
      link_type: 'reference',
      created_by: 'user-1',
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pulse-messages'] });
      expect(toastSuccess).toHaveBeenCalledWith('Tâche liée au message');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('passe en erreur quand la récupération des tâches échoue', async () => {
    supabaseState.mode = 'error';

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Aucune tâche trouvée')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('taches');

    consoleError.mockRestore();
  });

  it('préremplit le titre, crée une tâche puis la lie au message', async () => {
    const user = userEvent.setup();

    renderModal();

    await user.click(screen.getByRole('button', { name: /Créer nouvelle/i }));

    const input = await screen.findByLabelText('Titre de la tâche');
    expect(input).toHaveValue(MESSAGE.content);

    await user.clear(input);
    await user.type(input, 'Nouvelle tâche de suivi');

    await user.click(screen.getByRole('button', { name: /Créer et lier/i }));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        {
          titre: 'Nouvelle tâche de suivi',
          description: `Créée depuis Pulse:\n\n"${MESSAGE.content}"`,
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });

    await waitFor(() => {
      expect(mockFromExtended).toHaveBeenCalledWith('pulse_message_task_links');
    });

    const insertBuilder = mockFromExtended.mock.results[0]?.value as {
      insert: ReturnType<typeof vi.fn>;
    };

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      message_id: 'msg-1',
      task_id: 'created-task-1',
      link_type: 'created_from',
      created_by: 'user-1',
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pulse-messages'] });
      expect(toastSuccess).toHaveBeenCalledWith('Tâche créée et liée');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries,
    }),
  };
});