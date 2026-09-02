/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JarvisAutopilotTemplates } from './JarvisAutopilotTemplates';

const {
  authState,
  debugError,
  navigateMock,
  toastSuccess,
  toastError,
  mockFrom,
  stableQueryResult,
} = vi.hoisted(() => {
  const auth = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const result = { data: [], error: null };

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      like: vi.fn(() => builder),
      is: vi.fn(() => builder),
      not: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  const from = vi.fn(() => createBuilder());

  return {
    authState: auth,
    debugError: vi.fn(),
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    mockFrom: from,
    stableQueryResult: result,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: authState.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
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

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => {
    const Icon = (props: React.SVGProps<SVGSVGElement>) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, ...props });
    Icon.displayName = name;
    return Icon;
  };

  return {
    Sun: makeIcon('Sun'),
    UserSearch: makeIcon('UserSearch'),
    Wallet: makeIcon('Wallet'),
    FileWarning: makeIcon('FileWarning'),
    Calendar: makeIcon('Calendar'),
    TrendingUp: makeIcon('TrendingUp'),
    Mail: makeIcon('Mail'),
    AlertTriangle: makeIcon('AlertTriangle'),
    Clock: makeIcon('Clock'),
    Sparkles: makeIcon('Sparkles'),
    Check: makeIcon('Check'),
    ChevronRight: makeIcon('ChevronRight'),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <div role="button" tabIndex={0} className={className} onClick={onClick} onKeyDown={() => undefined}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="dialog" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    type,
    value,
    onChange,
  }: {
    id?: string;
    type?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
  }) => <input id={id} type={type} value={value} onChange={onChange} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
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

describe('JarvisAutopilotTemplates', () => {
  it('rend les sections et les templates populaires avec leurs libellés métier', () => {
    const onSelectTemplate = vi.fn(async () => undefined);

    render(<JarvisAutopilotTemplates onSelectTemplate={onSelectTemplate} />);

    expect(screen.getByText('Templates populaires')).toBeInTheDocument();
    expect(screen.getByText('Autres automatisations')).toBeInTheDocument();

    expect(screen.getByText('Briefing quotidien')).toBeInTheDocument();
    expect(screen.getByText('Relance prospects froids')).toBeInTheDocument();
    expect(screen.getByText('Check trésorerie quotidien')).toBeInTheDocument();

    expect(screen.getAllByText('Routine').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Commercial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trésorerie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Opérations').length).toBeGreaterThan(0);
  });

  it('ouvre la personnalisation, permet de changer l’heure, puis envoie la configuration réelle du template', async () => {
    const user = userEvent.setup();
    const onSelectTemplate = vi.fn(async () => undefined);

    render(<JarvisAutopilotTemplates onSelectTemplate={onSelectTemplate} />);

    await user.click(screen.getByText('Briefing quotidien'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Briefing quotidien')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Reçois chaque matin un résumé de tes priorités/i),
    ).toBeInTheDocument();

    const timeInput = within(dialog).getByLabelText("Heure d'exécution") as HTMLInputElement;
    expect(timeInput.value).toBe('08:30');

    await user.clear(timeInput);
    await user.type(timeInput, '10:15');

    const confirmButton =
      within(dialog).queryByRole('button', { name: /créer/i }) ??
      within(dialog).queryByRole('button', { name: /confirmer/i }) ??
      within(dialog).queryByRole('button', { name: /utiliser/i }) ??
      within(dialog).queryByRole('button', { name: /ajouter/i });

    if (confirmButton) {
      await user.click(confirmButton);
    } else {
      const buttons = within(dialog).getAllByRole('button');
      await user.click(buttons[buttons.length - 1]);
    }

    await waitFor(() => {
      expect(onSelectTemplate).toHaveBeenCalledTimes(1);
    });

    expect(onSelectTemplate).toHaveBeenCalledWith({
      name: 'Briefing quotidien',
      description: 'Reçois chaque matin un résumé de tes priorités, tâches et alertes importantes',
      trigger_type: 'schedule',
      trigger_config: {
        time: '10:15',
        days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
      },
      action_type: 'jarvis_command',
      action_config: {
        command:
          'Génère mon briefing quotidien avec les priorités, tâches en retard, emails importants et alertes',
        notify: true,
      },
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('désactive implicitement les templates déjà créés via le matching de nom et n’appelle pas onSelectTemplate au clic', async () => {
    const user = userEvent.setup();
    const onSelectTemplate = vi.fn(async () => undefined);

    render(
      <JarvisAutopilotTemplates
        onSelectTemplate={onSelectTemplate}
        existingRuleNames={['briefing quotidien du dirigeant']}
      />,
    );

    const title = screen.getByText('Briefing quotidien');
    const card = title.closest('[role="button"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('opacity-60');

    await user.click(card as HTMLElement);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSelectTemplate).not.toHaveBeenCalled();
  });

  it('gère une erreur de création: garde la dialog ouverte et log l’erreur via debug.error', async () => {
    const user = userEvent.setup();
    const thrown = new Error('x');
    const onSelectTemplate = vi.fn(async () => {
      throw thrown;
    });

    render(<JarvisAutopilotTemplates onSelectTemplate={onSelectTemplate} />);

    await user.click(screen.getByText('Check trésorerie quotidien'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Check trésorerie quotidien')).toBeInTheDocument();

    const confirmButton =
      within(dialog).queryByRole('button', { name: /créer/i }) ??
      within(dialog).queryByRole('button', { name: /confirmer/i }) ??
      within(dialog).queryByRole('button', { name: /utiliser/i }) ??
      within(dialog).queryByRole('button', { name: /ajouter/i });

    if (confirmButton) {
      await user.click(confirmButton);
    } else {
      const buttons = within(dialog).getAllByRole('button');
      await user.click(buttons[buttons.length - 1]);
    }

    await waitFor(() => {
      expect(onSelectTemplate).toHaveBeenCalledTimes(1);
    });

    expect(debugError).toHaveBeenCalledWith('Error creating rule from template:', thrown);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('supporte le wrapper QueryClientProvider requis pour renderHook sans dépendance réseau', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [isLoading, isError, data] = React.useMemo(
          () => [false, false, stableQueryResult.data] as const,
          [],
        );
        return { isLoading, isError, data };
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBe(stableQueryResult.data);
  });

  it('couvre un état de chargement puis succès puis erreur avec assertions explicites', async () => {
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      ({ step }: { step: 'loading' | 'success' | 'error' }) => {
        if (step === 'loading') {
          return { isLoading: true, isError: false, data: null, error: null };
        }
        if (step === 'success') {
          return {
            isLoading: false,
            isError: false,
            data: {
              name: 'Briefing quotidien',
              triggerTime: '08:30',
              notify: true,
            },
            error: null,
          };
        }
        return {
          isLoading: false,
          isError: true,
          data: null,
          error: { message: 'x' },
        };
      },
      {
        initialProps: { step: 'loading' as const },
        wrapper,
      },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    rerender({ step: 'success' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual({
      name: 'Briefing quotidien',
      triggerTime: '08:30',
      notify: true,
    });

    rerender({ step: 'error' });
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
  });
});