import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';


// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversations: () => ({ data: [], isLoading: false }),
  useCreatePulseConversation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  usePulseMessagesRealtime: () => {},
}));
vi.mock('@/hooks/pulse/usePulsePresence', () => ({
  usePulsePresence: () => ({ typingUsers: [], onlineUsers: [] }),
}));
vi.mock('@/hooks/presence/useGlobalUserPresence', () => ({
  useGlobalUserPresence: () => ({ onlineUserIds: new Set() }),
}));
vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: false }),
}));
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));
vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
  useCurrentProfile: () => ({ data: { id: 'test-user', prenom: 'Test', nom: 'User' } }),
}));
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), setOpen: vi.fn() }),
}));

import Pulse from '../Pulse';



// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}));

describe('Pulse page', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Pulse />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
