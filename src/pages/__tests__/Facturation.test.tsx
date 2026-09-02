import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
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
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => ({ pathname: '/facturation', search: '', hash: '' }),
  }
})
vi.mock('@/hooks/billing/useFactures', () => ({
  useFactures: () => ({
    factures: [],
    isLoading: false,
    kpis: {
      nbFacturesEnRetard: 0,
      montantEnRetard: 0,
      nbFacturesEnAttente: 0,
      montantEnAttente: 0,
      caMois: 0,
      caAnnee: 0,
      tauxEncaissement: 100,
      delaiMoyenPaiement: 0,
    },
  }),
  useCreateFacture: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/contracts/useDevis', () => ({
  useDevis: () => ({ devis: [], isLoading: false }),
}))
vi.mock('@/hooks/useEcheancesFacturation', () => ({
  useEcheancesFacturation: () => ({ echeances: [] }),
}))
vi.mock('@/hooks/useAvoirs', () => ({
  useAvoirs: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({ data: [] }),
}))
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), setOpen: vi.fn() }),
}))

import Facturation from '../Facturation'

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('Facturation page', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Facturation />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
