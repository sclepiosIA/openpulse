import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './ConversationMembersSheet';

const { MOCK_FROM, mockFrom, AUTH, MOCK_REMOVE, MOCK_UPDATE, BASE_CONVERSATION, ONLINE_USERS } = vi.hoisted(() => {
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
    rpc: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn(),
    catch: vi.fn(),
  };
  const mockFrom = vi.fn(() => builder);

  const AUTH = { user: { id: 'u1', email: 'u1@example.com' }, session: { user: { id: 'u1' } }, isLoading: false };

  const MOCK_REMOVE = vi.fn();
  const MOCK_UPDATE = vi.fn();

  const BASE_CONVERSATION = {
    id: 'c1',
    members: [
      {
        id: 'm1',
        user_id: 'u1',
        role: 'admin',
        user: { prenom: 'Pierre', nom: 'Durand', email: 'pierre@example.com', avatar_url: null },
      },
      {
        id: 'm2',
        user_id: 'u2',
        role: 'member',
        user: { prenom: 'Alice', nom: 'Martin', email: 'alice@example.com', avatar_url: null },
      },
      {
        id: 'm3',
        user_id: 'u3',
        role: 'guest',
        user: { prenom: 'Bob', nom: 'Zola', email: 'bob@example.com', avatar_url: null },
      },
    ],
  };

  const ONLINE_USERS = [
    { user_id: 'u2', status: 'active' },
    { user_id: 'u3', status: 'away' },
  ];

  return { MOCK_FROM: builder, mockFrom, AUTH, MOCK_REMOVE, MOCK_UPDATE, BASE_CONVERSATION, ONLINE_USERS };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: AUTH.user }),
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  useRemovePulseConversationMember: () => ({ mutate: MOCK_REMOVE }),
  useUpdatePulseConversationMemberRole: () => ({ mutate: MOCK_UPDATE }),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  Crown: (props: any) => <span data-icon="Crown" {...props} />,
  MoreHorizontal: (props: any) => <span data-icon="MoreHorizontal" {...props} />,
  Shield: (props: any) => <span data-icon="Shield" {...props} />,
  UserMinus: (props: any) => <span data-icon="UserMinus" {...props} />,
  UserPlus: (props: any) => <span data-icon="UserPlus" {...props} />,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div data-testid="avatar" {...props}>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: (props: any) => <img alt="" {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ asChild, children }: any) => (asChild ? children : <button>{children}</button>),
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('./AddMemberDialog', () => ({
  AddMemberDialog: ({ open, conversationId, existingMemberIds }: any) =>
    open ? (
      <div data-testid="add-member-dialog">
        DIALOG: conversationId={conversationId} existing={existingMemberIds.join(',')}
      </div>
    ) : null,
}));

import { ConversationMembersSheet } from './ConversationMembersSheet';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('ConversationMembersSheet', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders members sorted (admin first), shows badges and online indicator, allows opening add dialog, promoting and removing a member', async () => {
    const onOpenChange = vi.fn();
    const conversation = JSON.parse(JSON.stringify(BASE_CONVERSATION));
    const onlineUsers = ONLINE_USERS;

    render(
      <ConversationMembersSheet
        open={true}
        onOpenChange={onOpenChange}
        conversation={conversation as any}
        onlineUsers={onlineUsers as any}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Membres')).toBeInTheDocument();
    expect(screen.getByText('3 membres dans cette conversation')).toBeInTheDocument();

    // Admin sees "Ajouter des membres" and can open dialog
    const addBtn = screen.getByRole('button', { name: /ajouter des membres/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);
    expect(screen.getByTestId('add-member-dialog')).toHaveTextContent('DIALOG: conversationId=c1');

    // Admin badge and "(vous)"
    expect(screen.getByText(/Pierre Durand \(vous\)/)).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();

    // Guest badge
    expect(screen.getByText('Invité')).toBeInTheDocument();

    // Online indicator for u2 (Alice)
    const onlineDots = document.querySelectorAll('.bg-green-500');
    expect(onlineDots.length).toBe(1);

    // Order: admin (Pierre) appears before Alice
    const bodyText = document.body.textContent || '';
    expect(bodyText.indexOf('Pierre Durand (vous)')).toBeLessThan(bodyText.indexOf('Alice Martin'));

    // Promote Alice to admin
    // Scope to Alice's row
    let node: HTMLElement | null = screen.getByText('Alice Martin');
    while (node && !within(node).queryByLabelText("Plus d'options")) {
      node = node.parentElement;
    }
    // Fallback: if not found by ascending, just use the nearest ancestor with a button labeled "Plus d'options"
    const aliceRow = node || screen.getAllByLabelText("Plus d'options")[0].closest('div')!;
    const moreBtn = within(aliceRow).getByLabelText("Plus d'options");
    fireEvent.click(moreBtn);

    const promoteItem = within(aliceRow).getByText('Promouvoir admin');
    fireEvent.click(promoteItem);

    expect(MOCK_UPDATE).toHaveBeenCalledTimes(1);
    expect(MOCK_UPDATE).toHaveBeenCalledWith({
      conversationId: 'c1',
      userId: 'u2',
      role: 'admin',
    });

    // Remove Alice from conversation
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const removeItem = within(aliceRow).getByText('Retirer de la conversation');
    await act(async () => {
      fireEvent.click(removeItem);
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(MOCK_REMOVE).toHaveBeenCalledTimes(1);
    expect(MOCK_REMOVE).toHaveBeenCalledWith({
      conversationId: 'c1',
      userId: 'u2',
    });
  });

  it('does not remove a member when confirm is canceled', async () => {
    const onOpenChange = vi.fn();
    const conversation = JSON.parse(JSON.stringify(BASE_CONVERSATION));
    const onlineUsers = ONLINE_USERS;

    render(
      <ConversationMembersSheet
        open={true}
        onOpenChange={onOpenChange}
        conversation={conversation as any}
        onlineUsers={onlineUsers as any}
      />,
      { wrapper: createWrapper() }
    );

    // Use the first non-current member's row (Alice)
    let node: HTMLElement | null = screen.getByText('Alice Martin');
    while (node && !within(node).queryByLabelText("Plus d'options")) {
      node = node.parentElement;
    }
    const aliceRow = node || screen.getAllByLabelText("Plus d'options")[0].closest('div')!;
    const moreBtn = within(aliceRow).getByLabelText("Plus d'options");
    fireEvent.click(moreBtn);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const removeItem = within(aliceRow).getByText('Retirer de la conversation');
    await act(async () => {
      fireEvent.click(removeItem);
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(MOCK_REMOVE).not.toHaveBeenCalled();
  });

  it('non-admin current user sees "Quitter" and can leave the conversation', async () => {
    const onOpenChange = vi.fn();
    const conversation = {
      id: 'c2',
      members: [
        {
          id: 'mx1',
          user_id: 'u1',
          role: 'member',
          user: { prenom: 'Pierre', nom: 'Durand', email: 'pierre@example.com', avatar_url: null },
        },
        {
          id: 'mx2',
          user_id: 'u2',
          role: 'admin',
          user: { prenom: 'Admin', nom: 'Two', email: 'admin2@example.com', avatar_url: null },
        },
      ],
    };

    render(
      <ConversationMembersSheet
        open={true}
        onOpenChange={onOpenChange}
        conversation={conversation as any}
        onlineUsers={[] as any}
      />,
      { wrapper: createWrapper() }
    );

    // No "Ajouter des membres" for non-admin current user
    expect(screen.queryByRole('button', { name: /ajouter des membres/i })).not.toBeInTheDocument();

    // "Quitter" button visible for current user
    const quitBtn = screen.getByRole('button', { name: /quitter/i });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => {
      fireEvent.click(quitBtn);
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(MOCK_REMOVE).toHaveBeenCalledTimes(1);
    expect(MOCK_REMOVE).toHaveBeenCalledWith({
      conversationId: 'c2',
      userId: 'u1',
    });
  });

  it('allows downgrading another admin to member', async () => {
    const onOpenChange = vi.fn();
    const conversation = {
      id: 'c3',
      members: [
        {
          id: 'ma1',
          user_id: 'u1',
          role: 'admin',
          user: { prenom: 'Pierre', nom: 'Durand', email: 'pierre@example.com', avatar_url: null },
        },
        {
          id: 'ma2',
          user_id: 'u4',
          role: 'admin',
          user: { prenom: 'Zoé', nom: 'Alpha', email: 'zoe@example.com', avatar_url: null },
        },
        {
          id: 'ma3',
          user_id: 'u5',
          role: 'member',
          user: { prenom: 'Alice', nom: 'Beta', email: 'aliceb@example.com', avatar_url: null },
        },
      ],
    };

    render(
      <ConversationMembersSheet
        open={true}
        onOpenChange={onOpenChange}
        conversation={conversation as any}
        onlineUsers={[] as any}
      />,
      { wrapper: createWrapper() }
    );

    // Find the row for the other admin (Zoé Alpha)
    let node: HTMLElement | null = screen.getByText('Zoé Alpha');
    while (node && !within(node).queryByLabelText("Plus d'options")) {
      node = node.parentElement;
    }
    const otherAdminRow = node || screen.getAllByLabelText("Plus d'options")[0].closest('div')!;
    const moreBtn = within(otherAdminRow).getByLabelText("Plus d'options");
    fireEvent.click(moreBtn);

    const downgradeItem = within(otherAdminRow).getByText('Rétrograder en membre');
    fireEvent.click(downgradeItem);

    expect(MOCK_UPDATE).toHaveBeenCalledTimes(1);
    expect(MOCK_UPDATE).toHaveBeenCalledWith({
      conversationId: 'c3',
      userId: 'u4',
      role: 'member',
    });
  });
});