import { render } from '@testing-library/react'
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'

expect.extend({ toHaveNoViolations })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Badge Accessibility', () => {
  it('should not have any accessibility violations for default badge', async () => {
    const { container } = renderWithProviders(
      <Badge>Statut</Badge>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have any accessibility violations for badge with aria-label', async () => {
    const { container } = renderWithProviders(
      <Badge variant="destructive" aria-label="Statut critique: Erreur">
        Erreur
      </Badge>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have any accessibility violations for secondary badge', async () => {
    const { container } = renderWithProviders(
      <Badge variant="secondary" aria-label="Statut d'information">
        Info
      </Badge>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})