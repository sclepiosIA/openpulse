import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useAllAppConfigs: () => ({ data: [], isLoading: false }),
  useUpdateAppConfig: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/system/useReferenceData', () => ({
  useAllReferenceData: () => ({ data: [], isLoading: false }),
  useUpdateReferenceData: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))

import ParametresConfiguration from '../ParametresConfiguration'

describe('ParametresConfiguration page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ParametresConfiguration />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
