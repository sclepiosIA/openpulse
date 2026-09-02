import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory'

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule())
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
vi.mock('@/hooks/useDeploiement', () => ({
  useDeploiement: () => ({ data: [], isLoading: false }),
  useAllEtablissements: () => ({ data: [] }),
}))
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
vi.mock('@/hooks/production/useDeploymentHealth', () => ({
  useDeploymentHealth: () => new Map(),
}))
vi.mock('@/hooks/production/useDeploymentFilters', () => ({
  useDeploymentFilters: (data: any[]) => data,
}))
vi.mock('@/hooks/profile/useProfiles', () => ({
  useActiveProfiles: () => ({ data: [] }),
}))
vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    getPreference: vi.fn().mockReturnValue('list'),
    updatePreference: vi.fn(),
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

import Deploiement from '../Deploiement'

describe('Deploiement page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Deploiement />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
