import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
vi.mock('@/hooks/useFeedbacks', () => ({
  useFeedbacks: () => ({ data: [], isLoading: false }),
  useUpdateFeedbackStatus: () => ({ mutateAsync: vi.fn() }),
  useDeleteFeedback: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))

import ParametresFeedbacks from '../ParametresFeedbacks'

describe('ParametresFeedbacks page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ParametresFeedbacks />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
