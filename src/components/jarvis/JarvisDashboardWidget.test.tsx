// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisDashboardWidget } from './JarvisDashboardWidget';

const {
  ALERTS,
  EMPTY_ALERTS,
  AUTH_STATE,
  mockNavigate,
  mockChat,
  mockMarkAsRead,
  mockDismissAlert,
  mockOnOpenModal,
  mockUseJarvis,
  mockUseJarvisProactiveAlerts,
  mockFrom,
} = vi.hoisted(() => ({
  ALERTS: [
    {
      id: 'a1',
      type: 'overdue_task',
      priority: 'critical',
      title: 'Tâche en retard',
      message: 'Relancer le dossier Martin',
      read: false,
      action_type: 'navigate',
      action_data: { path: '/tasks/t1' },
    },
    {
      id: 'a2',
      type: 'pending_emails',
      priority: 'high',
      title: 'Emails en attente',
      message: '3 emails clients non lus',
      read: false,
      action_type: 'open_jarvis',
      action_data: { command: 'Résume mes emails en attente' },
    },
    {
      id: 'a3',
      type: 'cold_prospect',
      priority: 'medium',
      title: 'Prospect froid',
      message: 'Aucune interaction depuis 14 jours',
      read: true,
      action_type: 'navigate',
      action_data: { path: '/crm/prospects/p1' },
    },
    {
      id: 'a4',
      type: 'pending_ticket',
      priority: 'low',
      title: 'Ticket en attente',
      message: 'Répondre au ticket #24',
      read: false,
      action_type: 'navigate',
      action_data: { path: '/support/24' },
    },
  ],
  EMPTY_ALERTS: [],
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockChat: vi.fn().mockResolvedValue({ ok: true }),
  mockMarkAsRead: vi.fn().mockResolvedValue(undefined),
  mockDismissAlert: vi.fn(),
  mockOnOpenModal: vi.fn(),
  mockUseJarvis: vi.fn(),
  mockUseJarvisProactiveAlerts: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: mockUseJarvis,
}));

vi.mock('@/hooks/jarvis/useJarvisProactiveAlerts', () => ({
  useJarvisProactiveAlerts: mockUseJarvisProactiveAlerts,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
    className,
    'aria-label': ariaLabel,
    title,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
    title?: string;
  }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    disabled,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/assets/marque/logo.png', () => ({
  default: 'mock-image.png',
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Send: Icon,
    Maximize2: Icon,
    ChevronRight: Icon,
    Bot: Icon,
    AlertTriangle: Icon,
    Mail: Icon,
    ListTodo: Icon,
    TrendingDown: Icon,
    Ticket: Icon,
    Sparkles: Icon,
    Loader2: Icon,
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
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };
  mockFrom.mockReturnValue(builder);
  return {
    supabase: {
      from: mockFrom,
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

describe('JarvisDashboardWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJarvis.mockReturnValue({
      chat: mockChat,
      isTyping: false,
    });
    mockUseJarvisProactiveAlerts.mockReturnValue({
      alerts: ALERTS,
      unreadCount: 3,
      markAsRead: mockMarkAsRead,
      dismissAlert: mockDismissAlert,
    });
  });

  it('affiche les suggestions, le badge unread et limite selon maxSuggestions', () => {
    render(<JarvisDashboardWidget maxSuggestions={3} onOpenModal={mockOnOpenModal} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('JARVIS')).toBeInTheDocument();
    expect(screen.getByText('4 suggestions')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Tâche en retard')).toBeInTheDocument();
    expect(screen.getByText('Emails en attente')).toBeInTheDocument();
    expect(screen.getByText('Prospect froid')).toBeInTheDocument();
    expect(screen.queryByText('Ticket en attente')).not.toBeInTheDocument();

    expect(screen.getByText('Voir 1 autres suggestions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Demander à Jarvis...')).toBeInTheDocument();
  });

  it('affiche létat de chargement quand Jarvis réfléchit', () => {
    mockUseJarvis.mockReturnValue({
      chat: mockChat,
      isTyping: true,
    });

    render(<JarvisDashboardWidget />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Réfléchit...')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Demander à Jarvis...');
    expect(input).toBeDisabled();

    const submitButton = screen.getByRole('button', { name: 'Chargement' });
    expect(submitButton).toBeDisabled();
  });

  it('affiche létat vide quand il ny a aucune alerte', () => {
    mockUseJarvisProactiveAlerts.mockReturnValue({
      alerts: EMPTY_ALERTS,
      unreadCount: 0,
      markAsRead: mockMarkAsRead,
      dismissAlert: mockDismissAlert,
    });

    render(<JarvisDashboardWidget />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Tout est en ordre ✨')).toBeInTheDocument();
    expect(screen.getByText('Aucune action urgente')).toBeInTheDocument();
    expect(screen.queryByText('Voir 1 autres suggestions')).not.toBeInTheDocument();
  });

  it('soumet le quick input, appelle chat avec le vrai message puis onOpenModal', async () => {
    render(<JarvisDashboardWidget onOpenModal={mockOnOpenModal} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByPlaceholderText('Demander à Jarvis...');
    fireEvent.change(input, { target: { value: 'Prépare un résumé du jour' } });

    const submitButton = screen.getByRole('button', { name: 'Chargement' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockChat).toHaveBeenCalledWith('Prépare un résumé du jour');
    });

    await waitFor(() => {
      expect(mockOnOpenModal).toHaveBeenCalledTimes(1);
    });

    expect((input as HTMLInputElement).value).toBe('');
  });

  it('ignore la soumission si le message est vide', () => {
    render(<JarvisDashboardWidget onOpenModal={mockOnOpenModal} />, {
      wrapper: createWrapper(),
    });

    const submitButton = screen.getByRole('button', { name: 'Chargement' });
    expect(submitButton).toBeDisabled();
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('clique sur une alerte navigate, marque comme lue puis navigue vers le bon chemin', async () => {
    render(<JarvisDashboardWidget />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText('Tâche en retard'));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('a1');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tasks/t1');
    });
  });

  it('clique sur une alerte open_jarvis, remplit le quick input et ouvre le modal', async () => {
    render(<JarvisDashboardWidget onOpenModal={mockOnOpenModal} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText('Emails en attente'));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('a2');
    });

    await waitFor(() => {
      expect(mockOnOpenModal).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByDisplayValue('Résume mes emails en attente')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignore une alerte sans déclencher son action parent', async () => {
    render(<JarvisDashboardWidget />, {
      wrapper: createWrapper(),
    });

    const dismissButtons = screen.getAllByRole('button', { name: "Ignorer l'alerte" });
    fireEvent.click(dismissButtons[0]);

    expect(mockDismissAlert).toHaveBeenCalledWith('a1');
    expect(mockMarkAsRead).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ouvre le modal Jarvis complet via le bouton agrandir et dispatch lévénement custom', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<JarvisDashboardWidget onOpenModal={mockOnOpenModal} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Agrandir' }));

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const eventArg = (dispatchSpy as unknown as { mock: { calls: Array<[Event]> } }).mock.calls[0][0];
    expect(eventArg).toBeInstanceOf(CustomEvent);
    expect(eventArg.type).toBe('open-jarvis');
    expect(mockOnOpenModal).toHaveBeenCalledTimes(1);
  });

  it('masque le quick input en mode compact ou showQuickInput=false', () => {
    const { rerender } = render(<JarvisDashboardWidget compact />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByPlaceholderText('Demander à Jarvis...')).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })}>
        <JarvisDashboardWidget showQuickInput={false} />
      </QueryClientProvider>
    );

    expect(screen.queryByPlaceholderText('Demander à Jarvis...')).not.toBeInTheDocument();
  });
});