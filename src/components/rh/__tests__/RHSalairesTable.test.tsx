import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/integrations/supabase/client', () => {
  const p: any = new Proxy(
    {},
    {
      get:
        () =>
        (..._a: any[]) =>
          p,
    }
  )
  return { supabase: p }
})

vi.mock('@/hooks/hr/useRHSalaires', () => ({
  useRHSalaires: () => ({
    salaires: [],
    isLoading: false,
    updateSalaire: vi.fn(),
    deleteSalaire: vi.fn(),
  }),
  groupSalairesByMonth: () => [],
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/auth/useSecurityLog', () => ({
  useSecurityLog: () => ({ logAction: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }))

import { RHSalairesTable } from '../RHSalairesTable'
import { supabase } from '@/integrations/supabase/client'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('RHSalairesTable', () => {
  it('renders salaires section title', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHSalairesTable />
      </QueryClientProvider>
    )
    expect(screen.getByText('Salaires Mensuels')).toBeInTheDocument()
  })

  it('renders empty state with upload action', () => {
    render(
      <QueryClientProvider client={qc}>
        <RHSalairesTable />
      </QueryClientProvider>
    )
    expect(screen.getAllByText(/Uploader plusieurs bulletins/i).length).toBeGreaterThan(0)
  })
})
