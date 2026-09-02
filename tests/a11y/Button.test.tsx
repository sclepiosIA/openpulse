import { render } from '@testing-library/react'
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'

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

describe('Button Accessibility', () => {
  it('should not have any accessibility violations for primary button', async () => {
    const { container } = renderWithProviders(
      <Button variant="default">Bouton Principal</Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have any accessibility violations for secondary button', async () => {
    const { container } = renderWithProviders(
      <Button variant="secondary">Bouton Secondaire</Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have any accessibility violations for button with aria-label', async () => {
    const { container } = renderWithProviders(
      <Button variant="outline" aria-label="Fermer la fenêtre">
        ×
      </Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})