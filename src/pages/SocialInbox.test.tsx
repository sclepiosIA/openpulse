import React, { PropsWithChildren } from 'react';
import { afterEach, beforeEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  BRANDS,
  COMMENTS,
  COMMENTS_EMPTY,
  permissionsState,
  brandsState,
  commentsState,
  toast,
  mockFrom,
  mockInvoke,
} = vi.hoisted(() => {
  const BRANDS = [
    { id: 'b1', name: 'Marque A', color_hex: '#111111' },
    { id: 'b2', name: 'Marque B', color_hex: '#222222' },
  ];

  const COMMENTS = [
    {
      id: 'c1',
      brand_id: 'b1',
      platform: 'facebook',
      author_name: 'Alice',
      message: 'Bonjour',
      is_hidden: false,
      is_handled: false,
      created_time: '2025-01-01T10:00:00.000Z',
      post: { permalink: 'https://example.com/post/1', message: 'Post message 1' },
    },
    {
      id: 'c2',
      brand_id: 'b2',
      platform: 'instagram',
      author_name: '',
      message: '',
      is_hidden: false,
      is_handled: true,
      created_time: '2025-01-02T10:00:00.000Z',
      post: { permalink: '', message: 'Post message 2' },
    },
  ];

  const COMMENTS_EMPTY: typeof COMMENTS = [];

  const permissionsState: { current: { role: string | null; isLoading: boolean } } = {
    current: { role: 'marketing', isLoading: false },
  };

  const brandsState: {
    current: {
      isLoading: boolean;
      isError: boolean;
      error: Error | null;
      data: typeof BRANDS | undefined;
      refetch: ReturnType<typeof vi.fn>;
    };
  } = {
    current: {
      isLoading: false,
      isError: false,
      error: null,
      data: BRANDS,
      refetch: vi.fn(),
    },
  };

  const commentsState: {
    current: {
      isLoading: boolean;
      isError: boolean;
      error: Error | null;
      data: typeof COMMENTS | undefined;
      refetch: ReturnType<typeof vi.fn>;
      lastArgs: { activeBrand?: string; filter?: 'pending' | 'all' } | null;
    };
  } = {
    current: {
      isLoading: false,
      isError: false,
      error: null,
      data: COMMENTS,
      refetch: vi.fn(),
      lastArgs: null,
    },
  };

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  type SupabaseThenableResult = { data: unknown; error: unknown };

  const mockFrom = vi.fn(() => {
    const result: SupabaseThenableResult = { data: null, error: null };
    const builder: Record<string, unknown> = {};

    const chainMethods = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'order',
      'limit',
      'range',
      'insert',
      'update',
      'upsert',
      'delete',
      'match',
      'ilike',
      'like',
      'contains',
      'or',
      'filter',
      'throwOnError',
    ] as const;

    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder);
    }

    builder.single = vi.fn(async () => result);
    builder.maybeSingle = vi.fn(async () => result);
    builder.then = (onFulfilled?: (v: SupabaseThenableResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) => Promise.resolve(result).catch(onRejected);

    return builder;
  });

  const mockInvoke = vi.fn(async () => ({ data: { ok: true }, error: null }));

  return {
    BRANDS,
    COMMENTS,
    COMMENTS_EMPTY,
    permissionsState,
    brandsState,
    commentsState,
    toast,
    mockFrom,
    mockInvoke,
  };
});

vi.mock('sonner', () => ({ toast }));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => 'il y a un moment',
}));
vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react');
  const mk = (name: string) =>
    function Icon(props: ReactMod.SVGProps<SVGSVGElement>) {
      return ReactMod.createElement('svg', { ...props, 'data-icon': name });
    };
  return {
    Inbox: mk('Inbox'),
    MessageCircle: mk('MessageCircle'),
    EyeOff: mk('EyeOff'),
    CheckCircle2: mk('CheckCircle2'),
    RotateCcw: mk('RotateCcw'),
    Send: mk('Send'),
    ExternalLink: mk('ExternalLink'),
    Loader2: mk('Loader2'),
  };
});

vi.mock('@/components/ui/button', async () => {
  const ReactMod = await import('react');
  return {
    Button: ({ children, ...props }: ReactMod.ButtonHTMLAttributes<HTMLButtonElement>) =>
      ReactMod.createElement('button', props, children),
  };
});

vi.mock('@/components/ui/card', async () => {
  const ReactMod = await import('react');
  return {
    Card: ({ children, ...props }: ReactMod.HTMLAttributes<HTMLDivElement>) =>
      ReactMod.createElement('div', props, children),
    CardContent: ({ children, ...props }: ReactMod.HTMLAttributes<HTMLDivElement>) =>
      ReactMod.createElement('div', props, children),
  };
});

vi.mock('@/components/ui/badge', async () => {
  const ReactMod = await import('react');
  return {
    Badge: ({ children, ...props }: ReactMod.HTMLAttributes<HTMLSpanElement>) =>
      ReactMod.createElement('span', props, children),
  };
});

vi.mock('@/components/ui/textarea', async () => {
  const ReactMod = await import('react');
  return {
    Textarea: (props: ReactMod.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
      ReactMod.createElement('textarea', props),
  };
});

vi.mock('@/components/ui/tabs', async () => {
  const ReactMod = await import('react');
  type TabsCtxValue = { value: string; onValueChange: (v: string) => void };
  const TabsCtx = ReactMod.createContext<TabsCtxValue | null>(null);

  const Tabs = ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactMod.ReactNode;
  }) => ReactMod.createElement(TabsCtx.Provider, { value: { value, onValueChange } }, children);

  const TabsList = ({ children, ...props }: ReactMod.HTMLAttributes<HTMLDivElement>) =>
    ReactMod.createElement('div', props, children);

  const TabsTrigger = ({
    value,
    children,
    ...props
  }: ReactMod.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
    const ctx = ReactMod.useContext(TabsCtx);
    const onClick: ReactMod.MouseEventHandler<HTMLButtonElement> = (e) => {
      props.onClick?.(e);
      ctx?.onValueChange(value);
    };
    const ariaSelected = ctx?.value === value ? 'true' : 'false';
    return ReactMod.createElement(
      'button',
      { ...props, type: 'button', role: 'tab', 'aria-selected': ariaSelected, onClick, 'data-value': value },
      children,
    );
  };

  return { Tabs, TabsList, TabsTrigger };
});

vi.mock('@/components/shared/PageDataState', async () => {
  const ReactMod = await import('react');
  return {
    PageDataState: ({
      isLoading,
      isError,
      error,
      isEmpty,
      emptyTitle,
      emptyDescription,
      loadingLabel,
      onRetry,
      children,
    }: {
      isLoading: boolean;
      isError: boolean;
      error?: Error | null;
      isEmpty: boolean;
      emptyTitle: string;
      emptyDescription: string;
      loadingLabel: string;
      onRetry: () => void;
      children: ReactMod.ReactNode;
    }) => {
      if (isLoading) return ReactMod.createElement('div', {}, loadingLabel);
      if (isError) return ReactMod.createElement('div', {}, error?.message ?? 'Erreur');
      if (isEmpty)
        return ReactMod.createElement(
          'div',
          {},
          ReactMod.createElement('div', {}, emptyTitle),
          ReactMod.createElement('div', {}, emptyDescription),
          ReactMod.createElement('button', { onClick: onRetry, type: 'button' }, 'Réessayer'),
        );
      return ReactMod.createElement(ReactMod.Fragment, {}, children);
    },
  };
});

vi.mock('@/hooks/shared/usePageTitle', () => ({ usePageTitle: vi.fn() }));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => permissionsState.current,
}));

vi.mock('@/hooks/social/useSocialBrands', () => ({
  useSocialBrands: () => brandsState.current,
}));

vi.mock('@/hooks/social/useSocialComments', () => ({
  useSocialComments: (activeBrand?: string, filter?: 'pending' | 'all') => {
    commentsState.current.lastArgs = { activeBrand, filter };
    return commentsState.current;
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient();
  const Wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { ...render(ui, { wrapper: Wrapper }), client };
}

beforeEach(() => {
  permissionsState.current = { role: 'marketing', isLoading: false };
  brandsState.current = {
    isLoading: false,
    isError: false,
    error: null,
    data: BRANDS,
    refetch: vi.fn(),
  };
  commentsState.current = {
    isLoading: false,
    isError: false,
    error: null,
    data: COMMENTS,
    refetch: vi.fn(),
    lastArgs: null,
  };
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SocialInbox', () => {
  it('affiche le chargement quand les marques sont en cours de chargement', async () => {
    brandsState.current = {
      isLoading: true,
      isError: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    };

    const SocialInbox = (await import('./SocialInbox')).default;
    renderWithClient(React.createElement(SocialInbox));

    expect(screen.getByText('Chargement…')).toBeTruthy();
  });

  it('affiche les commentaires (succès) et permet de répondre avec invalidation du cache', async () => {
    const SocialInbox = (await import('./SocialInbox')).default;
    const { client } = renderWithClient(React.createElement(SocialInbox));
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    expect(screen.getByText('Inbox social')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Toutes les marques' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Marque A' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Marque B' })).toBeTruthy();

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bonjour')).toBeTruthy();

    const textareas = screen.getAllByPlaceholderText('Votre réponse…') as HTMLTextAreaElement[];
    expect(textareas).toHaveLength(1);
    const textarea = textareas[0];

    const user = userEvent.setup();
    await user.type(textarea, 'Merci');

    const replyBtn = screen.getByRole('button', { name: 'Répondre' });
    await act(async () => {
      await user.click(replyBtn);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    expect(mockInvoke).toHaveBeenCalledWith('social-comment-reply', {
      body: { comment_id: 'c1', action: 'reply', message: 'Merci' },
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Réponse publiée');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['social', 'comments'] });
    });

    await waitFor(() => {
      const updated = screen.getAllByPlaceholderText('Votre réponse…') as HTMLTextAreaElement[];
      expect(updated[0].value).toBe('');
    });
  });

  it("affiche une erreur toast quand l'action supabase retourne une erreur", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } });

    const SocialInbox = (await import('./SocialInbox')).default;
    renderWithClient(React.createElement(SocialInbox));

    const user = userEvent.setup();
    const textarea = (screen.getAllByPlaceholderText('Votre réponse…') as HTMLTextAreaElement[])[0];
    await user.type(textarea, 'Test');

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Répondre' }));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('x');
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("affiche l'état vide quand aucun commentaire n'est à traiter", async () => {
    commentsState.current = {
      isLoading: false,
      isError: false,
      error: null,
      data: COMMENTS_EMPTY,
      refetch: vi.fn(),
      lastArgs: null,
    };

    const SocialInbox = (await import('./SocialInbox')).default;
    renderWithClient(React.createElement(SocialInbox));

    expect(screen.getByText('Aucun commentaire à traiter')).toBeTruthy();
    expect(screen.getByText('Les commentaires arrivent via la synchronisation périodique.')).toBeTruthy();
  });

  it("affiche une erreur d'accès quand le rôle n'est pas autorisé", async () => {
    permissionsState.current = { role: 'support', isLoading: false };

    const SocialInbox = (await import('./SocialInbox')).default;
    renderWithClient(React.createElement(SocialInbox));

    expect(screen.getByText('Accès réservé.')).toBeTruthy();
  });

  it('passe le bon filter aux hooks (pending → all) via les tabs', async () => {
    const SocialInbox = (await import('./SocialInbox')).default;
    renderWithClient(React.createElement(SocialInbox));

    await waitFor(() => {
      expect(commentsState.current.lastArgs?.filter).toBe('pending');
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Tous' }));

    await waitFor(() => {
      expect(commentsState.current.lastArgs?.filter).toBe('all');
    });
  });
});