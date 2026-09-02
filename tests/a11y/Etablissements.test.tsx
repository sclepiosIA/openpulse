import React, { Suspense } from 'react'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { AuthProvider } from '@/components/AuthProvider'

// Import lazy loaded pour simuler le chargement réel
const Etablissements = React.lazy(() => import('@/pages/Etablissements'))

expect.extend({ toHaveNoViolations })

// Mocks
vi.mock('@/hooks/useEtablissements', () => ({
  useEtablissements: () => ({ 
    data: [
      { 
        id: '1', 
        nom: 'Test Hospital', 
        statut: 'Prospect',
        region: 'Île-de-France',
        ville: 'Paris',
        type: 'CHU',
        progression: 25 
      }
    ], 
    isLoading: false 
  })
}))

vi.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => ({ data: [], isLoading: false })
}))

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com' }
  })
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <Suspense fallback={<FullPageLoader />}>
            {component}
          </Suspense>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('Etablissements Page Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = renderWithProviders(<Etablissements />)
    
    // Attendre que le composant lazy soit chargé
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})