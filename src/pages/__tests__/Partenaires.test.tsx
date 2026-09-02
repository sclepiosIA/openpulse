import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory'

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule())
vi.mock('@/hooks/crm/usePartenaires', () => ({
  usePartenaires: () => ({
    data: [
      {
        id: 'p1',
        nom: 'Partner Corp',
        type: 'Intégrateur',
        statut: 'actif',
        statut_relation: 'actif',
        created_at: '2026-01-01',
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDeletePartenaire: () => ({ mutate: vi.fn() }),
  useCreatePartenaire: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePartenaire: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    getPreference: vi.fn().mockReturnValue('grid'),
    updatePreference: vi.fn(),
    isFavoritePartenaire: () => false,
    toggleFavoritePartenaire: vi.fn(),
  }),
}))
vi.mock('@/hooks/shared/useMediaQuery', () => ({
  useMediaQuery: () => true,
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/hooks/crm/usePendingContactsCount', () => ({
  useAllPendingContactsCounts: () => ({ data: {} }),
}))
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), setOpen: vi.fn() }),
}))

import Partenaires from '../Partenaires'

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('Partenaires page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Partenaires />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
