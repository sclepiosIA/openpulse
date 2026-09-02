import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const {
  USER,
  PROFILE,
  CONV_GROUP,
  CONV_DM,
  MESSAGES_PAGES,
  dmBehavior,
  markAsRead,
  sendMutate,
  createVisioLink,
  archiveMutate,
  fetchNextPage,
  setTyping,
  usePulseConversationMock,
} = vi.hoisted(() => {
  return {
    USER: { id: 'u1', email: 'alice@example.com' },
    PROFILE: { id: 'p1', prenom: 'Alice', nom: 'Durand', email: 'alice@example.com' },
    CONV_GROUP: {
      id: 'c1',
      name: 'Equipe Produit',
      visibility: 'public',
      metadata: { type: 'group' },
      members: [{ user_id: 'p1' }, { user_id: 'p2' }, { user_id: 'p3' }],
    },
    CONV_DM: {
      id: 'c_dm',
      name: 'Alice Durand & Bob Martin',
      visibility: 'private',
      metadata: { type: 'dm' },
      members: [{ user_id: 'p1' }, { user_id: 'p2' }],
    },
    MESSAGES_PAGES: [{ messages: [{ id: 'm1' }, { id: 'm2' }] }],
    dmBehavior: {
      isDM: false,
      counterpart: { id: 'p2', avatar_url: null, nom: 'Martin', prenom: 'Bob', email: 'bob@example.com' },
      displayName: 'Bob Martin',
      otherNameExtracted: 'Bob Martin',
    },
    markAsRead: vi.fn(),
    sendMutate: vi.fn(),
    createVisioLink: vi.fn(async () => ({ link: '/visio/room-xyz' })),
    archiveMutate: vi.fn(),
    fetchNextPage: vi.fn(),
    setTyping: vi.fn(),
    usePulseConversationMock: vi.fn(),
  };
});

vi.mock('lucide-react', () => {
  const Icon = (name: string) => (props: Record<string, unknown>) => <svg data-icon={name} {...props} />;
  return {
    ChevronLeft: Icon('ChevronLeft'),
    Hash: Icon('Hash'),
    Lock: Icon('Lock'),
    MoreVertical: Icon('MoreVertical'),
    Phone: Icon('Phone'),
    Search: Icon('Search'),
    Settings: Icon('Settings'),
    Sparkles: Icon('Sparkles'),
    ListTodo: Icon('ListTodo'),
    MessageCircle: Icon('MessageCircle'),
    Archive: Icon('Archive'),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
  default: (props: Record<string, unknown>) => <button {...props} />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: { children?: React.ReactNode }) => <div role="menuitem" {...props}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: { children?: React.ReactNode }) => <div data-testid="avatar" {...props}>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children?: React.ReactNode }) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: { children?: React.ReactNode }) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: { children?: React.ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock('./UserAvatarWithStatus', () => ({
  UserAvatarWithStatus: (props: { user?: { prenom?: string; nom?: string } }) => (
    <div data-testid="user-avatar-with-status">
      {props?.user?.prenom} {props?.user?.nom}
    </div>
  ),
}));

vi.mock('./MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock('./MessageEditor', () => ({
  MessageEditor: () => <div data-testid="message-editor" />,
}));

vi.mock('./TypingIndicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

vi.mock('./ConversationSettingsSheet', () => ({
  ConversationSettingsSheet: () => <div data-testid="conversation-settings-sheet" />,
}));

vi.mock('./StartVisioButton', () => ({
  StartVisioButton: () => <button data-testid="start-visio-button" />,
}));

vi.mock('@/components/visio/VisioOverlay', () => ({
  VisioOverlay: () => null,
}));

vi.mock('./AudioCallOverlay', () => ({
  AudioCallOverlay: () => null,
}));

vi.mock('@/components/email/SmartTasksDialog', () => ({
  SmartTasksDialog: () => null,
}));

vi.mock('./EtablissementContextBanner', () => ({
  EtablissementContextBanner: () => null,
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversation: (id: string) => usePulseConversationMock(id),
  useArchivePulseConversation: () => ({ mutate: archiveMutate }),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: PROFILE, isLoading: false }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: USER }),
}));

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  usePulseMessages: () => ({
    data: { pages: MESSAGES_PAGES },
    isLoading: false,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useSendPulseMessage: () => ({ mutate: sendMutate }),
}));

vi.mock('@/hooks/pulse/usePulsePresence', () => ({
  usePulsePresence: () => ({ setTyping }),
}));

vi.mock('@/hooks/pulse/usePulseVisio', () => ({
  usePulseVisio: () => ({ isCreating: false, createVisioLink }),
}));

vi.mock('@/hooks/pulse/usePulseMessageReceipts', () => ({
  usePulseMessageReceipts: () => ({ markAsRead }),
}));

vi.mock('@/hooks/pulse/usePulseUnreadCount', () => ({
  pulseUnreadKeys: { total: ['pulse', 'unread', 'total'] },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => (args as string[]).filter(Boolean).join(' '),
}));

vi.mock('@/lib/pulse/dmCounterpart', () => ({
  isDMConversation: () => dmBehavior.isDM,
  getDmCounterpart: () => dmBehavior.counterpart,
  getDmCounterpartDisplayName: () => dmBehavior.displayName,
  extractOtherNameFromConversationName: () => dmBehavior.otherNameExtracted,
}));

vi.stubGlobal('open', vi.fn());

import { ConversationDetail } from './ConversationDetail';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactNode, client?: QueryClient) {
  const qc = client ?? createQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ConversationDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    markAsRead.mockReset();
    sendMutate.mockReset();
    createVisioLink.mockReset();
    archiveMutate.mockReset();
    fetchNextPage.mockReset();
    setTyping.mockReset();
    usePulseConversationMock.mockReset();
    dmBehavior.isDM = false;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('affiche le skeleton de chargement quand la conversation charge', () => {
    usePulseConversationMock.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(
      <ConversationDetail
        conversationId="c1"
        typingUsers={[]}
        onlineUsers={[]}
        onOpenMobileSidebar={() => {}}
      />
    );
    const skels = screen.getAllByTestId('skeleton');
    expect(skels.length).toBeGreaterThan(0);
    expect(screen.queryByText('Conversation introuvable')).toBeNull();
  });

  it('affiche le header avec le nom et le nombre de membres et marque la conversation comme lue après 1s', async () => {
    usePulseConversationMock.mockReturnValue({ data: CONV_GROUP, isLoading: false });

    renderWithProviders(
      <ConversationDetail
        conversationId="c1"
        typingUsers={[]}
        onlineUsers={[{ user_id: 'p2', status: 'active' }]}
        onOpenMobileSidebar={() => {}}
      />
    );

    expect(screen.getByText('Equipe Produit')).toBeInTheDocument();
    expect(screen.getByText(/3 membres/)).toBeInTheDocument();
    expect(screen.getByText(/• 1 en ligne/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(markAsRead).toHaveBeenCalledTimes(1);
  });

  it('affiche un message d’erreur si la conversation est introuvable', () => {
    usePulseConversationMock.mockReturnValue({ data: null, isLoading: false });

    renderWithProviders(
      <ConversationDetail
        conversationId="c404"
        typingUsers={[]}
        onlineUsers={[]}
        onOpenMobileSidebar={() => {}}
      />
    );

    expect(screen.getByText('Conversation introuvable')).toBeInTheDocument();
  });

  it('affiche les infos DM et le statut en ligne quand le correspondant est connecté', () => {
    dmBehavior.isDM = true;
    usePulseConversationMock.mockReturnValue({ data: CONV_DM, isLoading: false });

    const onlineSet = new Set<string>(['p2']);
    renderWithProviders(
      <ConversationDetail
        conversationId="c_dm"
        typingUsers={[]}
        onlineUsers={[]}
        globalOnlineUserIds={onlineSet}
        onOpenMobileSidebar={() => {}}
      />
    );

    expect(screen.getByTestId('user-avatar-with-status')).toHaveTextContent('Bob Martin');
    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });

  it('bouton retour mobile déclenche onOpenMobileSidebar', () => {
    usePulseConversationMock.mockReturnValue({ data: CONV_GROUP, isLoading: false });

    const onOpen = vi.fn();
    renderWithProviders(
      <ConversationDetail
        conversationId="c1"
        typingUsers={[]}
        onlineUsers={[]}
        onOpenMobileSidebar={onOpen}
        isMobileView
      />
    );

    const backBtn = screen.getByLabelText('Retour à la liste');
    fireEvent.click(backBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});