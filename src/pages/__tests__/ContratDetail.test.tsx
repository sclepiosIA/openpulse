import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/contracts/useContrats', () => ({
  useContrat: () => ({ data: null, isLoading: true }),
  useContratAvenants: () => ({ data: [], isLoading: false }),
  useContratAlertes: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }))

import ContratDetail from '../ContratDetail'

describe('ContratDetail page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders loading state', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/contrats/c1']}>
          <Routes>
            <Route path="/contrats/:contratId" element={<ContratDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    // Loading skeletons should be present
    expect(container.firstElementChild).toBeTruthy()
  })
})
