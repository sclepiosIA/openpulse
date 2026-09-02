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
vi.mock('@/lib/supabaseBrowser', () => mockSupabaseModule());
vi.mock('@/hooks/system/useSystemManagement', () => ({
  useSecurityStats: () => ({ data: { totalEvents: 100, failedLogins: 2, activeSessions: 5 }, isLoading: false }),
  useSecurityConfig: () => ({ data: null, isLoading: false }),
  useSecurityLogs: () => ({ data: [], isLoading: false }),
  useBlockedIPs: () => ({ data: [], isLoading: false }),
  useSecurityActions: () => ({
    blockIP: { mutateAsync: vi.fn() },
    unblockIP: { mutateAsync: vi.fn() },
  }),
  useUserSessions: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/auth/useSecurityActions', () => ({
  useAdminDataActions: () => ({
    exportData: { mutateAsync: vi.fn(), isPending: false },
    purgeData: { mutateAsync: vi.fn(), isPending: false },
  }),
}));
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'error',
}));
vi.mock('@/components/admin/AuthorizedIPsManager', () => ({
  AuthorizedIPsManager: () => <div data-testid="ips-manager" />,
}));
vi.mock('@/components/SecurityComplianceDashboard', () => ({
  SecurityComplianceDashboard: () => <div data-testid="compliance" />,
}));
vi.mock('@/components/security/AdminGuard', () => ({
  AdminGuard: ({ children }: any) => <>{children}</>,
}));

import GestionSecurite from '../GestionSecurite';



// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}));

describe('GestionSecurite page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <GestionSecurite />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
