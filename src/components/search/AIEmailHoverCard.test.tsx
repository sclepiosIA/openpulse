/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AIEmailHoverCard } from './AIEmailHoverCard';

const {
  THREAD_DATA,
  LAST_MESSAGE_DATA,
  LONG_BODY_TEXT,
  navigateMock,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockLimit,
  mockMaybeSingle,
  builder,
} = vi.hoisted(() => {
  const LONG_BODY_TEXT =
    'Bonjour, ceci est un aperçu du dernier message envoyé concernant le dossier. '.repeat(4);

  const THREAD_DATA = {
    id: 'thread-1',
    subject: 'Sujet original',
    ai_generated_title: 'Titre IA du fil',
    ai_summary: 'Résumé IA à afficher si aucun aperçu du message',
    category: 'commercial',
    last_message_date: '2024-05-10T14:30:00.000Z',
    message_count: 3,
    participants: [
      { email: 'notify@openpulse.app', name: 'OpenPulse' },
      { email: 'client@example.test', name: 'Client Principal' },
    ],
    tags: ['urgent', 'client', 'devis', 'vip', 'relance'],
    etablissement: { id: 'eta-1', nom: 'Établissement Démo' },
  };

  const LAST_MESSAGE_DATA = {
    from_name: 'Client Principal',
    from_address: 'client@example.test',
    body_text: LONG_BODY_TEXT,
    sent_date: '2024-05-10T14:30:00.000Z',
  };

  const navigateMock = vi.fn();

  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  } = {} as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  };

  const mockSelect = vi.fn(() => builder);
  const mockEq = vi.fn(() => builder);
  const mockOrder = vi.fn(() => builder);
  const mockLimit = vi.fn(() => builder);
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn(() => builder);

  builder.select = mockSelect;
  builder.eq = mockEq;
  builder.order = mockOrder;
  builder.limit = mockLimit;
  builder.maybeSingle = mockMaybeSingle;
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  builder.catch = (onRejected) => Promise.resolve({ data: null, error: null }).catch(onRejected);

  return {
    THREAD_DATA,
    LAST_MESSAGE_DATA,
    LONG_BODY_TEXT,
    navigateMock,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockLimit,
    mockMaybeSingle,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode; openDelay?: number }) => <div data-testid="hover-card">{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div data-testid="hover-trigger">{children}</div>,
  HoverCardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="hover-content" className={className}>
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
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name, email }: { name: string; email?: string; size?: string }) => (
    <div data-testid="entity-avatar">
      {name}
      {email ? `|${email}` : ''}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Mail: () => <svg data-testid="icon-mail" />,
  Calendar: () => <svg data-testid="icon-calendar" />,
  User: () => <svg data-testid="icon-user" />,
  MessageSquare: () => <svg data-testid="icon-message-square" />,
  Building2: () => <svg data-testid="icon-building2" />,
  ExternalLink: () => <svg data-testid="icon-external-link" />,
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

describe('AIEmailHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockMaybeSingle.mockImplementation(() => {
      const table = mockFrom.mock.calls[mockFrom.mock.calls.length - 1]?.[0];
      if (table === 'email_threads') {
        return Promise.resolve({ data: THREAD_DATA, error: null });
      }
      if (table === 'email_messages') {
        return Promise.resolve({ data: LAST_MESSAGE_DATA, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('affiche uniquement les enfants tant que le thread n’est pas chargé puis rend les données métier du hover card', async () => {
    let resolveThread: ((value: { data: typeof THREAD_DATA | null; error: null }) => void) | undefined;
    let resolveMessage:
      | ((value: { data: typeof LAST_MESSAGE_DATA | null; error: null }) => void)
      | undefined;

    mockMaybeSingle.mockImplementation(() => {
      const table = mockFrom.mock.calls[mockFrom.mock.calls.length - 1]?.[0];
      if (table === 'email_threads') {
        return new Promise((resolve) => {
          resolveThread = resolve;
        });
      }
      if (table === 'email_messages') {
        return new Promise((resolve) => {
          resolveMessage = resolve;
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <AIEmailHoverCard threadId="thread-1">Déclencheur enfant</AIEmailHoverCard>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Déclencheur enfant')).toBeInTheDocument();
    expect(screen.queryByText('Titre IA du fil')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();

    resolveThread?.({ data: THREAD_DATA, error: null });
    resolveMessage?.({ data: LAST_MESSAGE_DATA, error: null });

    await waitFor(() => {
      expect(screen.getByText('Titre IA du fil')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).toHaveBeenCalledWith('email_messages');
    expect(mockEq).toHaveBeenCalledWith('id', 'thread-1');
    expect(mockEq).toHaveBeenCalledWith('thread_id', 'thread-1');
    expect(mockOrder).toHaveBeenCalledWith('sent_date', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(1);

    expect(screen.getByText('Client Principal')).toBeInTheDocument();
    expect(screen.getByText('commercial')).toBeInTheDocument();
    expect(screen.getByText('3 messages')).toBeInTheDocument();
    expect(screen.getByText('Établissement Démo')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('client')).toBeInTheDocument();
    expect(screen.getByText('devis')).toBeInTheDocument();
    expect(screen.getByText('vip')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();

    const expectedPreview = `${LONG_BODY_TEXT.slice(0, 150).trim()}...`;
    expect(screen.getByText(expectedPreview)).toBeInTheDocument();
    expect(screen.queryByText('Résumé IA à afficher si aucun aperçu du message')).not.toBeInTheDocument();
  });

  it('ouvre la conversation au clic sur le bouton', async () => {
    render(
      <AIEmailHoverCard threadId="thread-1">Voir</AIEmailHoverCard>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Ouvrir la conversation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /ouvrir la conversation/i }));

    expect(navigateMock).toHaveBeenCalledWith('/emails?thread=thread-1');
  });

  it('reste sur les enfants seuls si la requête thread retourne null', async () => {
    mockMaybeSingle.mockImplementation(() => {
      const table = mockFrom.mock.calls[mockFrom.mock.calls.length - 1]?.[0];
      if (table === 'email_threads') {
        return Promise.resolve({ data: null, error: { message: 'x' } });
      }
      if (table === 'email_messages') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <AIEmailHoverCard threadId="thread-1">Fallback enfant</AIEmailHoverCard>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('email_threads');
    });

    expect(screen.getByText('Fallback enfant')).toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();
    expect(screen.queryByText('Ouvrir la conversation')).not.toBeInTheDocument();
  });
});