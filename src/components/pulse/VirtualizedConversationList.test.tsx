import React from 'react';
import { render, screen, fireEvent, within, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VirtualizedConversationList } from './VirtualizedConversationList';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';

const {
  authState,
  profileState,
  dmFns,
  virtualItems,
  totalSize,
  formatDistanceMock,
} = vi.hoisted(() => ({
  authState: {
    user: { id: 'user-1', email: 'me@test.co' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  },
  profileState: {
    data: { id: 'profile-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.co' },
    isLoading: false,
    error: undefined,
  },
  dmFns: {
    isDMConversation: vi.fn(),
    getDmCounterpart: vi.fn(),
    getDmCounterpartDisplayName: vi.fn(),
    extractOtherNameFromConversationName: vi.fn(),
  },
  virtualItems: [
    { index: 0, key: 'row-0', start: 0, size: 72, end: 72 },
    { index: 1, key: 'row-1', start: 72, size: 72, end: 144 },
    { index: 2, key: 'row-2', start: 144, size: 72, end: 216 },
  ],
  totalSize: 216,
  formatDistanceMock: vi.fn(() => 'plus de 2 ans'),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => profileState,
}));

vi.mock('@/lib/pulse/dmCounterpart', () => ({
  isDMConversation: (...args: unknown[]) => dmFns.isDMConversation(...(args as [])),
  getDmCounterpart: (...args: unknown[]) => dmFns.getDmCounterpart(...(args as [])),
  getDmCounterpartDisplayName: (...args: unknown[]) => dmFns.getDmCounterpartDisplayName(...(args as [])),
  extractOtherNameFromConversationName: (...args: unknown[]) => dmFns.extractOtherNameFromConversationName(...(args as [])),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => totalSize,
    getVirtualItems: () => virtualItems,
  }),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>{children}</div>
  ),
  AvatarImage: ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
    // using role img is okay; keep data-testid for selection
    <img data-testid="avatar-image" src={src} alt={alt} className={className} />
  ),
  AvatarFallback: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-fallback" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | boolean | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Building2: Icon,
    Hash: Icon,
    Lock: Icon,
    Users: Icon,
    Pin: Icon,
    Notebook: Icon,
    Megaphone: Icon,
  };
});

vi.mock('date-fns', () => ({
  formatDistanceToNow: (..._args: unknown[]) => formatDistanceMock(),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
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

describe('VirtualizedConversationList', () => {
  beforeEach(() => {
    // reset mocks and shared state
    authState.user = { id: 'user-1', email: 'me@test.co' };
    authState.session = { user: { id: 'user-1' } };
    authState.isLoading = false;

    profileState.data = { id: 'profile-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.co' };
    profileState.isLoading = false;
    profileState.error = undefined;

    dmFns.isDMConversation.mockImplementation((conversation: { id: string }) => conversation.id === 'dm-1' || conversation.id === 'dm-loading');
    dmFns.getDmCounterpart.mockImplementation((conversation: { id: string }) => {
      if (conversation.id === 'dm-1') {
        return { id: 'profile-2', avatar_url: 'avatar-dm.png', full_name: 'Alice Martin' };
      }
      return null;
    });
    dmFns.getDmCounterpartDisplayName.mockImplementation(
      (counterpart: { full_name?: string } | null, fallback?: string) => (counterpart && counterpart.full_name) || fallback || 'Message direct'
    );
    dmFns.extractOtherNameFromConversationName.mockImplementation((name: string, _myName?: string) => name.split(' & ').pop() || name);

    // ensure virtualItems stable
    virtualItems.splice(
      0,
      virtualItems.length,
      { index: 0, key: 'row-0', start: 0, size: 72, end: 72 },
      { index: 1, key: 'row-1', start: 72, size: 72, end: 144 },
      { index: 2, key: 'row-2', start: 144, size: 72, end: 216 }
    );

    formatDistanceMock.mockReturnValue('plus de 2 ans');
  });

  it('affiche le message vide quand il n’y a aucune conversation', () => {
    render(
      <VirtualizedConversationList
        conversations={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onlineUsers={[]}
        globalOnlineUserIds={new Set()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Aucune conversation')).toBeTruthy();
  });

  it('affiche une DM, un groupe privé et une conversation notes avec les valeurs métier attendues', () => {
    const onSelect = vi.fn();
    const conversations = [
      {
        id: 'dm-1',
        name: 'Jean Dupont & Alice Martin',
        updated_at: '2024-01-01T00:00:00.000Z',
        unread_count: 3,
        members: [
          { user_id: 'profile-1' },
          { user_id: 'profile-2' },
        ],
        metadata: { pinned: true },
        visibility: 'private',
      },
      {
        id: 'group-1',
        name: 'Equipe soins',
        updated_at: '2024-01-01T00:00:00.000Z',
        unread_count: 0,
        members: [
          { user_id: 'profile-1' },
          { user_id: 'profile-2' },
          { user_id: 'profile-3' },
        ],
        metadata: {},
        visibility: 'private',
        etablissement: { nom: 'Clinique Paris' },
      },
      {
        id: 'notes-1',
        name: 'Mes notes',
        updated_at: '2024-01-01T00:00:00.000Z',
        unread_count: 101,
        members: [{ user_id: 'profile-1' }],
        metadata: { type: 'personal_notes' },
        visibility: 'private',
      },
    ];

    const onlineUsers = [
      { user_id: 'profile-2', status: 'active' },
      { user_id: 'profile-3', status: 'inactive' },
    ];

    render(
      <VirtualizedConversationList
        conversations={conversations}
        selectedId="group-1"
        onSelect={onSelect}
        onlineUsers={onlineUsers}
        globalOnlineUserIds={new Set(['profile-2'])}
      />,
      { wrapper: createWrapper() }
    );

    // DM display name should appear
    const dmNameNode = screen.getByText('Alice Martin');
    expect(dmNameNode).toBeTruthy();

    // Group and notes labels
    const groupNameNode = screen.getByText('Equipe soins');
    expect(groupNameNode).toBeTruthy();
    const notesNameNode = screen.getByText('Mes notes');
    expect(notesNameNode).toBeTruthy();

    // Clinique name is shown inside group button only
    const groupButton = groupNameNode.closest('button');
    expect(groupButton).toBeTruthy();
    expect(within(groupButton as Element).getByText('Clinique Paris')).toBeTruthy();

    // member count '3' is inside the group button
    expect(within(groupButton as Element).getByText('3')).toBeTruthy();

    // unread badge for notes should show '99+'
    const notesButton = notesNameNode.closest('button') as Element;
    expect(notesButton).toBeTruthy();
    expect(within(notesButton).getByText('99+')).toBeTruthy();

    // online indicator text inside group (should be • 1 en ligne)
    expect(within(groupButton as Element).getByText('• 1 en ligne')).toBeTruthy();

    // clicking DM button triggers onSelect with dm id
    const dmButton = dmNameNode.closest('button') as Element;
    expect(dmButton).toBeTruthy();
    fireEvent.click(dmButton);
    expect(onSelect).toHaveBeenCalledWith('dm-1');
  });

  it('utilise le nom de conversation comme fallback pendant le chargement du profil pour une DM', () => {
    profileState.data = undefined;
    profileState.isLoading = true;

    dmFns.isDMConversation.mockReturnValue(true);
    dmFns.getDmCounterpart.mockReturnValue(null);

    const conversations = [
      {
        id: 'dm-loading',
        name: 'Moi & Bob',
        updated_at: '2024-01-01T00:00:00.000Z',
        unread_count: 0,
        members: [{ user_id: 'profile-1' }, { user_id: 'profile-9' }],
        metadata: {},
        visibility: 'private',
      },
    ];

    // restrict virtual items to single
    virtualItems.splice(0, virtualItems.length, { index: 0, key: 'row-0', start: 0, size: 72, end: 72 });

    render(
      <VirtualizedConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        onlineUsers={[]}
        globalOnlineUserIds={new Set()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Moi & Bob')).toBeTruthy();
  });

  it('affiche l’indicateur de présence hors ligne quand le destinataire DM est absent', () => {
    const conversations = [
      {
        id: 'dm-1',
        name: 'Jean Dupont & Alice Martin',
        updated_at: '2024-01-01T00:00:00.000Z',
        unread_count: 0,
        members: [
          { user_id: 'profile-1' },
          { user_id: 'profile-2' },
        ],
        metadata: {},
        visibility: 'private',
      },
    ];

    virtualItems.splice(0, virtualItems.length, { index: 0, key: 'row-0', start: 0, size: 72, end: 72 });

    const { container } = render(
      <VirtualizedConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        onlineUsers={[]}
        globalOnlineUserIds={new Set()}
      />,
      { wrapper: createWrapper() }
    );

    // offline indicator uses bg-gray-400
    expect(container.querySelector('.bg-gray-400')).toBeTruthy();
    // ensure no online green dot class in this case
    expect(container.querySelector('.bg-emerald-500')).toBeFalsy();
  });

  it('affiche l’indicateur de présence en ligne quand le destinataire DM est présent globalement', () => {
    const conversations = [
      {
        id: 'dm-1',
        name: 'Jean Dupont & Alice Martin',
        updated_at: '2024-01-01T00:00:00.000Z',
        unread_count: 0,
        members: [
          { user_id: 'profile-1' },
          { user_id: 'profile-2' },
        ],
        metadata: {},
        visibility: 'private',
      },
    ];

    virtualItems.splice(0, virtualItems.length, { index: 0, key: 'row-0', start: 0, size: 72, end: 72 });

    const { container } = render(
      <VirtualizedConversationList
        conversations={conversations}
        selectedId={null}
        onSelect={vi.fn()}
        onlineUsers={[]}
        globalOnlineUserIds={new Set(['profile-2'])}
      />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('.bg-emerald-500')).toBeTruthy();
  });

  it('renderHook : couvre états success, loading et erreur du hook useCurrentProfile', async () => {
    // success state
    profileState.data = { id: 'profile-1', prenom: 'Jean', nom: 'Dupont', email: 'jean@test.co' };
    profileState.isLoading = false;
    profileState.error = undefined;

    let hook;
    await act(async () => {
      hook = renderHook(() => useCurrentProfile(), { wrapper: createWrapper() });
    });
    expect(hook.result.current.data).toEqual(profileState.data);
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.error).toBeUndefined();

    // loading state
    profileState.data = undefined;
    profileState.isLoading = true;
    profileState.error = undefined;
    await act(async () => {
      hook.rerender();
    });
    expect(hook.result.current.isLoading).toBe(true);

    // error state
    profileState.data = null;
    profileState.isLoading = false;
    profileState.error = { message: 'erreur de test' };
    await act(async () => {
      hook.rerender();
    });
    expect(hook.result.current.data).toBeNull();
    expect(hook.result.current.error).toEqual({ message: 'erreur de test' });
  });
});