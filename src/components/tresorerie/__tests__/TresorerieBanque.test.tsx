import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TresorerieBanque } from '../TresorerieBanque'
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/tresorerie/useQontoTransactions', () => ({
  useQontoTransactions: () => ({
    transactions: [],
    connection: null,
    isLoading: false,
    sync: vi.fn(),
    isSyncing: false,
    reconcile: vi.fn(),
    unreconcile: vi.fn(),
    isReconciling: false,
  }),
}))

vi.mock('@/hooks/tresorerie/useTresorerieRevenus', () => ({
  useTresorerieRevenus: () => ({
    revenus: [],
    isLoading: false,
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('TresorerieBanque', () => {
  it('renders bank section title', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieBanque />
      </QueryClientProvider>
    )
    // Le titre affiché est "Transactions (N)" avec le nombre de transactions filtrées
    const headings = screen.getAllByText(/^Transactions/)
    expect(headings.length).toBeGreaterThanOrEqual(1)
  })

  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieBanque />
      </QueryClientProvider>
    )
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument()
  })
})
