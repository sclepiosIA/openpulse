import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stable mocks and constants
const { PUBLIC_URL, currentProfileState, authState, updateMutate, updateMutateAsync, archiveMutate, removeMutate, updateRoleMutate, storage, mockFrom } = vi.hoisted(() => {
  const PUBLIC_URL = 'https://cdn.example.test/avatar.png';

  const currentProfileState = {
    data: { id: 'u1', prenom: 'John', nom: 'Doe' },
    isLoading: false,
    error: null,
  };

  const authState = { user: { id: 'u1', email: 'test@example.com' } };

  const updateMutate = vi.fn();
  const updateMutateAsync = vi.fn(async () => ({ data: {}, error: null }));
  const archiveMutate = vi.fn();
  const removeMutate = vi.fn();
  const updateRoleMutate = vi.fn();

  const storage = {
    from: vi.fn((bucket: string) => {
      // Return an object with upload and getPublicUrl methods
      return {
        upload: vi.fn(async (_path: string, _file: File, _opts: unknown) => ({ error: null })),
        getPublicUrl: vi.fn((_path: string) => ({ data: { publicUrl: PUBLIC_URL } })),
      };
    }),
  };

  const mockFrom = vi.fn(() => {
    const builder: Record<string, unknown> = {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: vi.fn((resolve: (val: unknown) => unknown) => Promise.resolve(resolve({ data: [] }))),
      catch: vi.fn(() => builder),
    };
    return builder;
  });

  return { PUBLIC_URL, currentProfileState, authState, updateMutate, updateMutateAsync, archiveMutate, removeMutate, updateRoleMutate, storage, mockFrom };
});

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage,
  },
}));

// Mock pulse conversation hooks
vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  useUpdatePulseConversation: () => ({
    mutate: updateMutate,
    mutateAsync: updateMutateAsync,
    isPending: false,
  }),
  useArchivePulseConversation: () => ({
    mutate: archiveMutate,
  }),
  useRemovePulseConversationMember: () => ({
    mutate: removeMutate,
  }),
  useUpdatePulseConversationMemberRole: () => ({
    mutate: updateRoleMutate,
  }),
}));

// Mock profile hook
vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => currentProfileState,
}));

// Mock auth provider
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock debug
vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
  },
}));

// Mock lucide-react icons as simple spans
vi.mock('lucide-react', () => {
  const MockIcon = (props: unknown) => React.createElement('span', props as Record<string, unknown>);
  return {
    Archive: MockIcon,
    Camera: MockIcon,
    Crown: MockIcon,
    Edit2: MockIcon,
    Eye: MockIcon,
    EyeOff: MockIcon,
    ImagePlus: MockIcon,
    Loader2: MockIcon,
    LogOut: MockIcon,
    MoreHorizontal: MockIcon,
    Save: MockIcon,
    Settings: MockIcon,
    Shield: MockIcon,
    Trash2: MockIcon,
    UserMinus: MockIcon,
    UserPlus: MockIcon,
    Users: MockIcon,
    X: MockIcon,
  };
});

// Mock UI components used in the module to simple passthroughs
vi.mock('@/components/ui/button', () => ({
  Button: (props: unknown) => React.createElement('button', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: unknown) => React.createElement('input', props as Record<string, unknown>),
}));

vi.mock('@/components/ui/label', () => ({
  Label: (props: unknown) => React.createElement('label', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: unknown) => React.createElement('textarea', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: unknown) => React.createElement('input', { type: 'checkbox', ...(props as Record<string, unknown>) }),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: unknown) => React.createElement('hr', props as Record<string, unknown>),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: unknown) => React.createElement('div', { 'data-testid': 'avatar', ...(props as Record<string, unknown>) }, (props as Record<string, unknown>)?.children),
  AvatarFallback: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AvatarImage: (props: unknown) => React.createElement('img', props as Record<string, unknown>),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: unknown) => React.createElement('span', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: (props: unknown) => React.createElement('div', { 'data-testid': 'sheet', ...(props as Record<string, unknown>) }, (props as Record<string, unknown>)?.children),
  SheetContent: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  SheetDescription: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  SheetHeader: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  SheetTitle: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogAction: (props: unknown) => React.createElement('button', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogCancel: (props: unknown) => React.createElement('button', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogContent: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogDescription: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogFooter: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogHeader: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  AlertDialogTitle: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  DropdownMenuContent: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  DropdownMenuItem: (props: unknown) => React.createElement('div', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
  DropdownMenuSeparator: (props: unknown) => React.createElement('hr', props as Record<string, unknown>),
  DropdownMenuTrigger: (props: unknown) => React.createElement('button', props as Record<string, unknown>, (props as Record<string, unknown>)?.children),
}));

// Mock local AddMemberDialog (relative import inside component)
vi.mock('./AddMemberDialog', () => ({
  AddMemberDialog: (props: unknown) => React.createElement('div', { 'data-testid': 'add-member-dialog' }, (props as Record<string, unknown>)?.children),
}));

// Mock react-router hooks defensively
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Ensure global confirm is stable for tests that might call it
const { confirm } = vi.hoisted(() => {
  const confirm = vi.fn(() => true);
  return { confirm };
});
global.confirm = confirm as unknown as (message?: string) => boolean;

// Now import the module under test AFTER mocks so imports are properly mocked
import { ConversationSettingsSheet } from './ConversationSettingsSheet';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useUpdatePulseConversation } from '@/hooks/pulse/usePulseConversations';

// Prepare query client wrapper for renderHook as requested
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = createQueryClient();
  return React.createElement(QueryClientProvider, { client }, children);
};

describe('ConversationSettingsSheet', () => {
  const baseConversation = {
    id: 'conv1',
    name: 'Team Chat',
    description: 'A place to chat',
    visibility: 'public',
    created_by: 'u1',
    members: [
      { user_id: 'u1', role: 'admin', user: { prenom: 'John', nom: 'Doe' } },
      { user_id: 'u2', role: 'guest', user: { prenom: 'Alice', nom: 'Zephyr' } },
    ],
    metadata: {},
  };

  const renderWithClient = (ui: React.ReactElement) => {
    const client = createQueryClient();
    return render(React.createElement(QueryClientProvider, { client }, ui));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // reset mutable currentProfileState to default
    currentProfileState.data = { id: 'u1', prenom: 'John', nom: 'Doe' };
    currentProfileState.isLoading = false;
    currentProfileState.error = null;
    authState.user = { id: 'u1', email: 'test@example.com' };
  });

  it('renders sheet and displays conversation name and initials when avatar missing', () => {
    renderWithClient(
      React.createElement(ConversationSettingsSheet, {
        open: true,
        onOpenChange: vi.fn(),
        conversation: baseConversation,
        onlineUsers: [],
      })
    );

    // The sheet description contains the conversation name
    expect(screen.getByText(/Avatar, membres et paramètres de "Team Chat"/)).toBeTruthy();

    // Initials computed from "Team Chat" => "TC"
    expect(screen.getByText('TC')).toBeTruthy();
  });

  it('uploads avatar: calls supabase.storage.upload, gets public url and calls updateConversation.mutateAsync', async () => {
    renderWithClient(
      React.createElement(ConversationSettingsSheet, {
        open: true,
        onOpenChange: vi.fn(),
        conversation: baseConversation,
        onlineUsers: [],
      })
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });

    await act(async () => {
      // fire change event to simulate file selection
      fireEvent.change(fileInput as Element, { target: { files: [file] } });
      // Wait for async operations inside handler to complete and mutateAsync to be called
      await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    });

    // Ensure storage.from was called with 'avatars'
    expect(storage.from).toHaveBeenCalledWith('avatars');

    // updateConversation.mutateAsync was called with new metadata containing PUBLIC_URL
    expect(updateMutateAsync).toHaveBeenCalled();
    const calledWith = (updateMutateAsync as unknown as { mock: { calls: unknown[] } }).mock.calls[0][0];
    expect(calledWith).toBeTruthy();
    expect((calledWith as Record<string, unknown>).id).toBe('conv1');
    expect((calledWith as Record<string, unknown>).metadata).toBeTruthy();
    expect(((calledWith as Record<string, unknown>).metadata as Record<string, unknown>).avatar_url).toBe(PUBLIC_URL);

    // toast.success called with French success message
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Avatar mis à jour');
  });

  it('removes avatar: calls updateConversation.mutateAsync and shows success toast', async () => {
    const conversationWithAvatar = {
      ...baseConversation,
      metadata: { avatar_url: 'https://old.example/avatar.png' },
    };

    renderWithClient(
      React.createElement(ConversationSettingsSheet, {
        open: true,
        onOpenChange: vi.fn(),
        conversation: conversationWithAvatar,
        onlineUsers: [],
      })
    );

    // There is a button labelled "Supprimer" rendered when avatar exists
    const removeButtons = screen.getAllByText('Supprimer');
    expect(removeButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(removeButtons[0]);
      // wait for mutation to be called
      await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    });

    expect(updateMutateAsync).toHaveBeenCalled();
    const args = (updateMutateAsync as unknown as { mock: { calls: unknown[] } }).mock.calls[0][0];
    expect((args as Record<string, unknown>).id).toBe('conv1');
    expect(((args as Record<string, unknown>).metadata as Record<string, unknown>).avatar_url).toBeNull();

    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Avatar supprimé');
  });

  it('exposes pulse hooks via renderHook and mutate functions can be called (loading and error states simulated)', async () => {
    // Simulate loading state for currentProfile
    currentProfileState.isLoading = true;
    const hookResult = renderHook(() => useCurrentProfile(), { wrapper });
    expect(hookResult.result.current.isLoading).toBe(true);

    // Simulate error state
    currentProfileState.isLoading = false;
    currentProfileState.data = null;
    currentProfileState.error = { message: 'profile fetch failed' };

    hookResult.rerender();
    expect(hookResult.result.current.data).toBeNull();
    expect(hookResult.result.current.error).toEqual({ message: 'profile fetch failed' });

    // Now test we can call mutate on the mocked update hook via renderHook
    const updateHook = renderHook(() => useUpdatePulseConversation(), { wrapper });

    await act(async () => {
      updateHook.result.current.mutate({ id: 'conv1', name: 'New Name' });
    });

    expect(updateMutate).toHaveBeenCalledWith({ id: 'conv1', name: 'New Name' });

    // And test mutateAsync
    await act(async () => {
      await updateHook.result.current.mutateAsync({ id: 'conv1', metadata: { avatar_url: PUBLIC_URL } });
    });
    expect(updateMutateAsync).toHaveBeenCalledWith({ id: 'conv1', metadata: { avatar_url: PUBLIC_URL } });
  });
});