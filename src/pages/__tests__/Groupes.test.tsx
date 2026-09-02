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
vi.mock('@/hooks/crm/useGroupes', () => ({
  useGroupes: () => ({
    data: [
      {
        id: 'g1',
        nom: 'GHT Nord',
        type: 'GHT',
        created_at: '2026-01-01',
        membres_count: 3,
        ca_total: 100000,
        progression_moyenne: 75,
        etablissements_groupes: [],
      },
    ],
    isLoading: false,
  }),
  useDeleteGroupe: () => ({ mutate: vi.fn() }),
  useUpdateGroupe: () => ({ mutate: vi.fn() }),
  useCreateGroupe: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/profile/useProfilesMap', () => ({
  useProfilesMap: () => new Map(),
}))
vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    getPreference: vi.fn().mockReturnValue('grid'),
    updatePreference: vi.fn(),
    isFavoriteGroupe: () => false,
    toggleFavoriteGroupe: vi.fn(),
  }),
}))
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), setOpen: vi.fn() }),
}))
vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useActiveProfilesWithRoles: () => ({ data: [] }),
}))

import Groupes from '../Groupes'

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('Groupes page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Groupes />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
