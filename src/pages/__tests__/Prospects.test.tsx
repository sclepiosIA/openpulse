import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

vi.mock('@/hooks/crm/useProspects', () => ({
  useProspects: () => ({ data: [], isLoading: false }),
  useProspectStats: () => ({
    data: { total: 0, highPotential: 0, recentlyAdded: 0, withTasks: 0 },
    isLoading: false,
  }),
  useAllEtablissements: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/crm/useEtablissements', () => ({
  useDeleteEtablissement: () => ({ mutateAsync: vi.fn() }),
  useCreateEtablissement: () => ({ mutateAsync: vi.fn() }),
  useUpdateEtablissement: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: {},
    updatePreference: vi.fn(),
    getPreference: vi.fn(),
  }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))

import Prospects from '../Prospects'

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('Prospects page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Prospects />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
