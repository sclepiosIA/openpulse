/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AIContactHoverCard } from './AIContactHoverCard';

const {
  CONTACT_ROW,
  ETAB_ROW,
  CHILD_TEXT,
  mockFrom,
  hoverContentState,
} = vi.hoisted(() => ({
  CONTACT_ROW: {
    id: 'c1',
    nom: 'Dupont',
    prenom: 'Jean',
    email: 'jean@example.fr',
    telephone: '0102030405',
    fonction: 'Directeur',
    niveau_contact: 'Chaud',
    etablissement_id: 'e1',
  },
  ETAB_ROW: {
    id: 'e1',
    nom: 'Lycée Horizon',
    ville: 'Paris',
  },
  CHILD_TEXT: 'Voir contact',
  mockFrom: vi.fn(),
  hoverContentState: {
    open: true,
  },
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode; openDelay?: number }) => (
    <div data-testid="hover-card-root">{children}</div>
  ),
  HoverCardTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="hover-trigger">{children}</div>
  ),
  HoverCardContent: ({ children, className, side, align }: { children: React.ReactNode; className?: string; side?: string; align?: string }) =>
    hoverContentState.open ? (
      <div data-testid="hover-content" data-class={className} data-side={side} data-align={align}>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode; variant?: string; className?: string }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Mail: () => <svg data-testid="icon-mail" />,
  Phone: () => <svg data-testid="icon-phone" />,
  Building2: () => <svg data-testid="icon-building" />,
  MessageSquare: () => <svg data-testid="icon-message" />,
}));

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name, email }: { name: string; email?: string; size?: string }) => (
    <div data-testid="entity-avatar">
      {name}|{email ?? ''}
    </div>
  ),
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {
      staleTime: 120000,
    },
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

type BuilderResult = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

function createSupabaseBuilder(resolvedValue: unknown): BuilderResult {
  const promise = Promise.resolve(resolvedValue);
  const builder = {} as BuilderResult;

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => promise);
  builder.maybeSingle = vi.fn(() => promise);
  builder.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected);
  builder.catch = (onRejected) => promise.catch(onRejected);

  return builder;
}

describe('AIContactHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoverContentState.open = true;
  });

  it('affiche seulement les enfants pendant le chargement initial', () => {
    const pendingBuilder = createSupabaseBuilder(new Promise(() => {}));
    mockFrom.mockReturnValue(pendingBuilder);

    render(
      <AIContactHoverCard contactId="c1">
        <span>{CHILD_TEXT}</span>
      </AIContactHoverCard>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();
    expect(mockFrom).toHaveBeenCalledWith('contacts');
  });

  it('affiche les informations métier du contact et de son établissement après succès', async () => {
    const contactBuilder = createSupabaseBuilder({ data: CONTACT_ROW, error: null });
    const etabBuilder = createSupabaseBuilder({ data: ETAB_ROW, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'contacts') return contactBuilder;
      if (table === 'etablissements') return etabBuilder;
      return createSupabaseBuilder({ data: null, error: null });
    });

    render(
      <AIContactHoverCard contactId="c1">
        <span>{CHILD_TEXT}</span>
      </AIContactHoverCard>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'contacts');
    expect(contactBuilder.select).toHaveBeenCalled();
    expect(contactBuilder.eq).toHaveBeenCalledWith('id', 'c1');
    expect(contactBuilder.maybeSingle).toHaveBeenCalled();

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'etablissements');
    expect(etabBuilder.eq).toHaveBeenCalledWith('id', 'e1');

    expect(screen.getByText('Directeur')).toBeInTheDocument();
    expect(screen.getByText('Chaud')).toBeInTheDocument();
    expect(screen.getByText('jean@example.fr')).toBeInTheDocument();
    expect(screen.getByText('0102030405')).toBeInTheDocument();
    expect(screen.getByText('Établissement:')).toBeInTheDocument();
    expect(screen.getByText('Lycée Horizon')).toBeInTheDocument();
    expect(screen.getByTestId('entity-avatar')).toHaveTextContent('Jean Dupont|jean@example.fr');
    expect(screen.queryByText('Derniers échanges')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /jean@example\.fr/i })).toHaveAttribute('href', 'mailto:jean@example.fr');
    expect(screen.getByRole('link', { name: /0102030405/i })).toHaveAttribute('href', 'tel:0102030405');
    expect(screen.getByRole('button', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /appeler/i })).toBeInTheDocument();
  });

  it('revient aux enfants seuls quand la requête renvoie data null', async () => {
    const nullContactBuilder = createSupabaseBuilder({ data: null, error: { message: 'x' } });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'contacts') return nullContactBuilder;
      return createSupabaseBuilder({ data: null, error: null });
    });

    render(
      <AIContactHoverCard contactId="c1">
        <span>{CHILD_TEXT}</span>
      </AIContactHoverCard>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(nullContactBuilder.maybeSingle).toHaveBeenCalled();
    });

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument();
  });

  it('déclenche les actions rapides email et téléphone', async () => {
    const contactBuilder = createSupabaseBuilder({ data: CONTACT_ROW, error: null });
    const etabBuilder = createSupabaseBuilder({ data: ETAB_ROW, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'contacts') return contactBuilder;
      if (table === 'etablissements') return etabBuilder;
      return createSupabaseBuilder({ data: null, error: null });
    });

    const originalLocation = window.location;
    const locationMock = { href: 'http://local/' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationMock,
    });

    render(
      <AIContactHoverCard contactId="c1">
        <span>{CHILD_TEXT}</span>
      </AIContactHoverCard>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /email/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /email/i }));
    expect(window.location.href).toBe('mailto:jean@example.fr');

    fireEvent.click(screen.getByRole('button', { name: /appeler/i }));
    expect(window.location.href).toBe('tel:0102030405');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});