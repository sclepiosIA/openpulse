import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  useAIUsageStats: () => ({ data: null, isLoading: false }),
  formatTokens: (n: number) => `${n}`,
  formatCost: (n: number) => `${n}€`,
  formatDuration: (n: number) => `${n}ms`,
  getProcessingTypeLabel: (t: string) => t,
}))
vi.mock('@/hooks/ai/useAIEndpointsHealth', () => ({
  useAIEndpointsHealth: () => ({ endpoints: [], isLoading: false, overallStatus: 'healthy' }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))

import AIUsageDashboard from '../AIUsageDashboard'

describe('AIUsageDashboard page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AIUsageDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
