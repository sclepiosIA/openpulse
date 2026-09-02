import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory'

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
}))

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule())
vi.mock('@/hooks/system/useSystemConfig', () => ({
  useSystemStats: () => ({ data: { totalUsers: 10, activeUsers: 8 }, isLoading: false }),
  useSystemMaintenanceActions: () => ({
    clearCache: { mutateAsync: vi.fn(), isPending: false },
    runMigrations: { mutateAsync: vi.fn(), isPending: false },
    runBackup: { mutateAsync: vi.fn(), isPending: false },
    syncEmails: { mutateAsync: vi.fn(), isPending: false },
  }),
}))
vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: true, role: 'admin' }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/components/settings/CronEmailMonitoringCard', () => ({
  CronEmailMonitoringCard: () => <div data-testid="cron-card" />,
}))
vi.mock('@/components/settings/EmailNotificationCard', () => ({
  EmailNotificationCard: () => <div data-testid="email-notif-card" />,
}))
vi.mock('@/components/settings/ParametresMobileHeader', () => ({
  ParametresMobileHeader: () => null,
}))
vi.mock('@/components/settings/ParametresTabsCompact', () => ({
  ParametresTabsCompact: () => null,
}))
vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: () => null,
}))

import Parametres from '../Parametres'

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('Parametres page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Parametres />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
