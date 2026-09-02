import { render } from '@testing-library/react'
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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

describe('Card Accessibility', () => {
  it('should not have any accessibility violations for basic card', async () => {
    const { container } = renderWithProviders(
      <Card>
        <CardHeader>
          <CardTitle>Titre de la carte</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Contenu de la carte avec du texte.</p>
        </CardContent>
      </Card>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have any accessibility violations for interactive card', async () => {
    const { container } = renderWithProviders(
      <Card 
        className="cursor-pointer" 
        role="button" 
        tabIndex={0}
        aria-label="Carte interactive - Cliquer pour plus de détails"
      >
        <CardHeader>
          <CardTitle>Carte Interactive</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Cette carte est interactive.</p>
        </CardContent>
      </Card>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})