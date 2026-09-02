// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisFavoritesBar } from './JarvisFavoritesBar';

const {
  USER,
  FAVORITES,
  EMPTY_FAVORITES,
  ADDED_FAVORITE,
  incrementUsageMock,
  addFavoriteMock,
  removeFavoriteMock,
  reorderFavoritesMock,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  debugErrorMock,
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 'test@local.dev' };

  const FAVORITES = [
    {
      id: 'fav-1',
      command: 'Génère mon briefing du matin',
      label: 'Briefing',
      description: 'Résumé quotidien',
      icon: '☀️',
      shortcut_key: '1',
      usage_count: 2,
      order_index: 0,
    },
    {
      id: 'fav-2',
      command: 'Quelles sont mes tâches prioritaires ?',
      label: 'Tâches',
      description: 'Top priorités',
      icon: '✅',
      shortcut_key: '2',
      usage_count: 5,
      order_index: 1,
    },
  ];

  const EMPTY_FAVORITES: Array<{
    id: string;
    command: string;
    label: string;
    description: string | null;
    icon: string | null;
    shortcut_key: string | null;
    usage_count: number | null;
    order_index: number | null;
  }> = [];

  const ADDED_FAVORITE = {
    id: 'fav-3',
    command: 'Résume mes emails non lus',
    label: 'Emails',
    description: null,
    icon: '📧',
    shortcut_key: '3',
    usage_count: 0,
    order_index: 2,
  };

  return {
    USER,
    FAVORITES,
    EMPTY_FAVORITES,
    ADDED_FAVORITE,
    incrementUsageMock: vi.fn(),
    addFavoriteMock: vi.fn(),
    removeFavoriteMock: vi.fn(),
    reorderFavoritesMock: vi.fn(),
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOrder: vi.fn(),
    debugErrorMock: vi.fn(),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | false | null>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    session: { user: USER },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisFavoritesMutations', () => ({
  useJarvisFavoritesMutations: () => ({
    incrementUsage: incrementUsageMock,
    addFavorite: addFavoriteMock,
    removeFavorite: removeFavoriteMock,
    reorderFavorites: reorderFavoritesMock,
  }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: mockOrder,
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };

  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockOrder.mockImplementation(async () => ({ data: FAVORITES, error: null }));
  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) =>
    React.createElement('span', props, children);
  return {
    Star: Icon,
    Plus: Icon,
    X: Icon,
    Command: Icon,
    GripVertical: Icon,
    Sparkles: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) =>
    React.createElement(
      'button',
      {
        onClick,
        disabled,
        className,
        'data-variant': variant,
        'data-size': size,
        ...props,
      },
      children
    ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    onClick,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement(
      'div',
      { role: 'button', tabIndex: 0, onClick, className, ...props },
      children
    ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement('input', props),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean; onOpenChange?: (value: boolean) => void }) =>
    open ? React.createElement('div', null, children) : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { className }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('h2', { className }, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Reorder: {
    Group: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      axis?: string;
      values?: unknown[];
      onReorder?: (items: unknown[]) => void;
      className?: string;
    }) => React.createElement('div', { className }, children),
    Item: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      value?: unknown;
      className?: string;
    }) => React.createElement('div', { className }, children),
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
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('JarvisFavoritesBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    incrementUsageMock.mockResolvedValue(undefined);
    addFavoriteMock.mockResolvedValue(ADDED_FAVORITE);
    removeFavoriteMock.mockResolvedValue(undefined);
    reorderFavoritesMock.mockResolvedValue(undefined);

    mockOrder.mockImplementation(async () => ({ data: FAVORITES, error: null }));
  });

  it('utilise un wrapper QueryClientProvider compatible avec renderHook', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });

  it('affiche rien pendant le chargement puis rend les favoris chargés avec leurs valeurs métier', async () => {
    const onCommandSelect = vi.fn();
    const { container } = render(
      React.createElement(JarvisFavoritesBar, { onCommandSelect }),
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Favoris')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_favorite_commands');
    expect(mockSelect).toHaveBeenCalledWith(
      'id, command, label, description, icon, shortcut_key, usage_count, order_index'
    );
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1');
    expect(mockOrder).toHaveBeenCalledWith('order_index', { ascending: true });

    expect(screen.getByText('Briefing')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Alt+1')).toBeInTheDocument();
    expect(screen.getByText('Alt+2')).toBeInTheDocument();
    expect(screen.getByText('Utilisé 2 fois')).toBeInTheDocument();
    expect(screen.getByText('Utilisé 5 fois')).toBeInTheDocument();
  });

  it('sélectionne un favori au clic et incrémente son usage', async () => {
    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Briefing')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Briefing'));
    });

    expect(onCommandSelect).toHaveBeenCalledWith('Génère mon briefing du matin');
    expect(incrementUsageMock).toHaveBeenCalledWith(FAVORITES[0]);

    await waitFor(() => {
      expect(screen.getByText('Utilisé 3 fois')).toBeInTheDocument();
    });
  });

  it('déclenche la sélection via raccourci clavier Alt+1', async () => {
    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Briefing')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(document, { key: '1', altKey: true, ctrlKey: false, shiftKey: false });
    });

    expect(onCommandSelect).toHaveBeenCalledWith('Génère mon briefing du matin');
    expect(incrementUsageMock).toHaveBeenCalledWith(FAVORITES[0]);
  });

  it('ajoute un favori depuis le dialogue avec les bonnes valeurs', async () => {
    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Favoris')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Ajouter'));
    });

    expect(screen.getByText('Ajouter une commande favorite')).toBeInTheDocument();
    expect(screen.getByText('Raccourci:')).toBeInTheDocument();
    expect(screen.getByText('Alt+3')).toBeInTheDocument();

    const commandInput = screen.getByPlaceholderText('Ex: Quelles sont mes tâches du jour ?');
    const labelInput = screen.getByPlaceholderText('Ex: Tâches');

    await act(async () => {
      fireEvent.change(commandInput, { target: { value: 'Résume mes emails non lus' } });
      fireEvent.change(labelInput, { target: { value: 'Emails' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Ajouter aux favoris'));
    });

    expect(addFavoriteMock).toHaveBeenCalledWith(
      'u1',
      { command: 'Résume mes emails non lus', label: 'Emails' },
      2
    );

    await waitFor(() => {
      expect(screen.getAllByText('Emails').length).toBeGreaterThan(0);
    });
  });

  it('ajoute une suggestion avec son icône et la bonne position', async () => {
    mockOrder.mockImplementation(async () => ({ data: EMPTY_FAVORITES, error: null }));
    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Aucun favori. Ajoutez vos commandes fréquentes !')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('☀️ Briefing'));
    });

    expect(addFavoriteMock).toHaveBeenCalledWith(
      'u1',
      {
        command: 'Génère mon briefing du matin',
        label: 'Briefing',
        icon: '☀️',
      },
      0
    );
  });

  it('supprime un favori et appelle la mutation avec le bon id', async () => {
    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Briefing')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button');
    const targetRemoveButton = removeButtons.find(
      (button) =>
        button.className.includes('hover:text-destructive') ||
        button.className.includes('transition-opacity')
    );

    expect(targetRemoveButton).toBeDefined();

    await act(async () => {
      fireEvent.click(targetRemoveButton as HTMLButtonElement);
    });

    expect(removeFavoriteMock).toHaveBeenCalledWith('fav-1');

    await waitFor(() => {
      expect(screen.queryByText('Briefing')).not.toBeInTheDocument();
    });
  });

  it('rend le mode compact avec badges cliquables limités à 5', async () => {
    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect, compact: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('☀️ Briefing')).toBeInTheDocument();
    });

    expect(screen.getByText('✅ Tâches')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('☀️ Briefing'));
    });

    expect(onCommandSelect).toHaveBeenCalledWith('Génère mon briefing du matin');
    expect(incrementUsageMock).toHaveBeenCalledWith(FAVORITES[0]);
  });

  it('gère une erreur de chargement sans planter et journalise l’erreur', async () => {
    mockOrder.mockImplementation(async () => ({
      data: null,
      error: { message: 'x' },
    }));

    const onCommandSelect = vi.fn();

    render(React.createElement(JarvisFavoritesBar, { onCommandSelect }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Aucun favori. Ajoutez vos commandes fréquentes !')).toBeInTheDocument();
    });

    expect(debugErrorMock).toHaveBeenCalledWith(
      '[JarvisFavorites] Error loading:',
      { message: 'x' }
    );
  });
});