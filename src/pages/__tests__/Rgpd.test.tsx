import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory'

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule())
vi.mock('@/hooks/auth/useRgpd', () => ({
  useRgpdTraitements: () => ({ data: [], isLoading: false }),
  useRgpdDemandes: () => ({ data: [], isLoading: false }),
  useRgpdViolations: () => ({ data: [], isLoading: false }),
  useRgpdDpas: () => ({ data: [], isLoading: false }),
  useRgpdCertifications: () => ({ data: [], isLoading: false }),
  useRgpdConsentements: () => ({ data: [], isLoading: false }),
  useRgpdAuditLogs: () => ({ data: [], isLoading: false }),
  useRgpdKPIs: () => ({
    totalTraitements: 5,
    demandesEnCours: 2,
    violationsOuvertes: 0,
    dpasActifs: 3,
    tauxConformite: 92,
  }),
  useCreateRgpdTraitement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRgpdDemande: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRgpdViolation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRgpdDpa: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRgpdCertification: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRgpdDemande: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

import Rgpd from '../Rgpd'

describe('Rgpd page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <Rgpd />
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
