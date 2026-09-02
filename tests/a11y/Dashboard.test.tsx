import { render } from '@testing-library/react'
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from '@/pages/Dashboard'
import { AuthProvider } from '@/components/AuthProvider'

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

vi.mock('@/hooks/useTaches', () => ({
  useTaches: () => ({ 
    data: [
      { 
        id: '1', 
        titre: 'Tâche test', 
        statut: 'A faire', 
        priorite: 'high',
        etablissement_id: '1' 
      }
    ], 
    isLoading: false 
  })
}))

vi.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => ({ data: [], isLoading: false })
}))

vi.mock('@/hooks/useProspects', () => ({
  useAllEtablissements: () => ({ data: [], isLoading: false })
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
          {component}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('Dashboard Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = renderWithProviders(<Dashboard />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})