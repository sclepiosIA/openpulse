// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBadge } from './NotificationBadge';
import { useInAppNotifications } from '@/hooks/dashboard/useInAppNotifications';

const {
  STABLE_NOTIFICATIONS,
  AUTH_STATE,
  navigateMock,
  markAsReadMock,
  markAllAsReadMock,
  deleteNotificationMock,
  createTestNotificationMock,
  mockFrom,
} = vi.hoisted(() => {
  const now = Date.now();

  return {
    STABLE_NOTIFICATIONS: [
      {
        id: 'n1',
        title: 'Nouvelle tâche',
        message: 'Une tâche vous a été assignée',
        type: 'task_assignment',
        is_read: false,
        created_at: new Date(now - 60 * 60 * 1000).toISOString(),
        related_type: 'tache',
        related_id: 'task-1',
      },
      {
        id: 'n2',
        title: 'Mention équipe',
        message: 'Vous avez été mentionné dans un commentaire',
        type: 'mention',
        is_read: true,
        created_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        related_type: null,
        related_id: null,
      },
      {
        id: 'n3',
        title: 'Mise à jour établissement',
        message: 'Un établissement a été mis à jour',
        type: 'establishment_update',
        is_read: false,
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        related_type: 'etablissement',
        related_id: 'eta-1',
      },
    ],
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    navigateMock: vi.fn(),
    markAsReadMock: vi.fn(),
    markAllAsReadMock: vi.fn(),
    deleteNotificationMock: vi.fn(),
    createTestNotificationMock: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(reject),
  };

  mockFrom.mockImplementation(() => builder);

  return {
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
  };
});

vi.mock('@/hooks/dashboard/useInAppNotifications', () => ({
  useInAppNotifications: vi.fn(() => ({
    notifications: STABLE_NOTIFICATIONS,
    unreadCount: 2,
    isLoading: false,
    markAsRead: markAsReadMock,
    markAllAsRead: markAllAsReadMock,
    deleteNotification: deleteNotificationMock,
  })),
}));

vi.mock('@/hooks/notifications/useNotificationTest', () => ({
  useNotificationTest: vi.fn(() => ({
    createTestNotification: createTestNotificationMock,
    isCreating: false,
  })),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => navigateMock),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => 'il y a un moment'),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props);
  return {
    Bell: Icon,
    Check: Icon,
    Trash2: Icon,
    CheckCheck: Icon,
    Search: Icon,
    X: Icon,
    Filter: Icon,
    Plus: Icon,
    Bug: Icon,
    Loader2: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) =>
    React.createElement('button', props, children),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement>) => React.createElement('span', props, children),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) =>
    React.createElement(React.Fragment, {}, children),
  PopoverContent: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement('div', props, children),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement('input', props),
}));

vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) =>
      React.createElement(SelectContext.Provider, { value: { value, onValueChange } }, children),
    SelectTrigger: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement('button', props, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React.createElement('span', {}, placeholder),
    SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => {
      const ctx = React.useContext(SelectContext);
      return React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => ctx.onValueChange?.(value),
        },
        children
      );
    },
  };
});

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) =>
    React.createElement(React.Fragment, {}, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
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

describe('NotificationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInAppNotifications).mockReturnValue({
      notifications: STABLE_NOTIFICATIONS,
      unreadCount: 2,
      isLoading: false,
      markAsRead: markAsReadMock,
      markAllAsRead: markAllAsReadMock,
      deleteNotification: deleteNotificationMock,
    });
  });

  it('affiche le badge avec le nombre non lu, les notifications réelles et les actions', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    expect(screen.getByLabelText('Notifications (2 non lues)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument();
    expect(screen.getByText('Mention équipe')).toBeInTheDocument();
    expect(screen.getByText('Mise à jour établissement')).toBeInTheDocument();
    expect(screen.getByText('Une tâche vous a été assignée')).toBeInTheDocument();
    expect(screen.getByText('Vous avez été mentionné dans un commentaire')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /tout lu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diagnostic des notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^test$/i })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Supprimer la notification')).toHaveLength(3);
    expect(screen.getAllByLabelText('Marquer comme lu')).toHaveLength(2);
  });

  it('ouvre le panneau diagnostic avec les valeurs utilisateur et statut chargées', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /diagnostic des notifications/i }));

    expect(screen.getByText('User ID:')).toBeInTheDocument();
    expect(screen.getByText('u1')).toBeInTheDocument();
    expect(screen.getByText('Notifications:')).toBeInTheDocument();
    expect(screen.getByText('3 total, 2 non lues')).toBeInTheDocument();
    expect(screen.getByText('Statut:')).toBeInTheDocument();
    expect(screen.getByText('Chargé')).toBeInTheDocument();
  });

  it('filtre par recherche et permet de réinitialiser les filtres', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(input, { target: { value: 'mention' } });

    expect(screen.getByText('Mention équipe')).toBeInTheDocument();
    expect(screen.queryByText('Nouvelle tâche')).not.toBeInTheDocument();
    expect(screen.queryByText('Mise à jour établissement')).not.toBeInTheDocument();

    const resetButtons = screen.getAllByRole('button', { name: /réinitialiser les filtres/i });
    fireEvent.click(resetButtons[0]);

    expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument();
    expect(screen.getByText('Mention équipe')).toBeInTheDocument();
    expect(screen.getByText('Mise à jour établissement')).toBeInTheDocument();
  });

  it('filtre par type puis par statut avec des assertions métier', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    fireEvent.click(screen.getByRole('button', { name: /🏢 Établissements/i }));

    expect(screen.getByText('Mise à jour établissement')).toBeInTheDocument();
    expect(screen.queryByText('Nouvelle tâche')).not.toBeInTheDocument();
    expect(screen.queryByText('Mention équipe')).not.toBeInTheDocument();

    let resetButtons = screen.getAllByRole('button', { name: /réinitialiser les filtres/i });
    fireEvent.click(resetButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Statut' }));
    const statusButtons = screen.getAllByRole('button', { name: 'Lues' });
    fireEvent.click(statusButtons[0]);

    expect(screen.getByText('Mention équipe')).toBeInTheDocument();
    expect(screen.queryByText('Nouvelle tâche')).not.toBeInTheDocument();
    expect(screen.queryByText('Mise à jour établissement')).not.toBeInTheDocument();
  });

  it('appelle la création de notification de test et le marquage global en lu', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
    expect(createTestNotificationMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /tout lu/i }));
    expect(markAllAsReadMock).toHaveBeenCalledTimes(1);
  });

  it('marque une notification comme lue et la supprime via les actions dédiées', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    const markReadButtons = screen.getAllByLabelText('Marquer comme lu');
    fireEvent.click(markReadButtons[0]);
    expect(markAsReadMock).toHaveBeenCalledWith('n1');

    const deleteButtons = screen.getAllByLabelText('Supprimer la notification');
    fireEvent.click(deleteButtons[2]);
    expect(deleteNotificationMock).toHaveBeenCalledWith('n3');
  });

  it('marque comme lue et navigue lors du clic sur une notification liée à une tâche', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    const row = screen.getByText('Nouvelle tâche').closest('.group');
    if (!row) {
      throw new Error('Notification row not found');
    }

    fireEvent.click(row);

    expect(markAsReadMock).toHaveBeenCalledWith('n1');
    expect(navigateMock).toHaveBeenCalledWith('/projets');
  });

  it('navigue vers un établissement lié', () => {
    render(<NotificationBadge />, { wrapper: createWrapper() });

    const row = screen.getByText('Mise à jour établissement').closest('.group');
    if (!row) {
      throw new Error('Notification row not found');
    }

    fireEvent.click(row);

    expect(markAsReadMock).toHaveBeenCalledWith('n3');
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/eta-1');
  });

  it('affiche le chargement quand les notifications sont en cours de récupération', () => {
    vi.mocked(useInAppNotifications).mockReturnValue({
      notifications: STABLE_NOTIFICATIONS,
      unreadCount: 2,
      isLoading: true,
      markAsRead: markAsReadMock,
      markAllAsRead: markAllAsReadMock,
      deleteNotification: deleteNotificationMock,
    });

    render(<NotificationBadge />, { wrapper: createWrapper() });

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('gère un état d erreur métier du hook en affichant une liste vide exploitable', () => {
    vi.mocked(useInAppNotifications).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
      markAsRead: markAsReadMock,
      markAllAsRead: markAllAsReadMock,
      deleteNotification: deleteNotificationMock,
    } as {
      notifications: typeof STABLE_NOTIFICATIONS | [];
      unreadCount: number;
      isLoading: boolean;
      isError: boolean;
      error: { message: string };
      markAsRead: typeof markAsReadMock;
      markAllAsRead: typeof markAllAsReadMock;
      deleteNotification: typeof deleteNotificationMock;
    });

    render(<NotificationBadge />, { wrapper: createWrapper() });

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tout lu/i })).not.toBeInTheDocument();
  });
});