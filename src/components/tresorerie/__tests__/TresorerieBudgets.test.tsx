import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TresorerieBudgets } from '../TresorerieBudgets'

vi.mock('@/hooks/tresorerie/useTresorerieBudgets', () => ({
  useTresorerieBudgets: () => ({
    budgets: [],
    categories: [],
    totaux: { prevu: 0, reel: 0, ecart: 0 },
    isLoading: false,
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
    duplicateBudgets: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDuplicating: false,
  }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('TresorerieBudgets', () => {
  it('renders month navigation buttons', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieBudgets />
      </QueryClientProvider>
    )
    // Boutons précédent et suivant + Dupliquer + Nouveau budget
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('renders add budget button', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieBudgets />
      </QueryClientProvider>
    )
    expect(screen.getByText(/Nouveau budget/i)).toBeInTheDocument()
  })

  it('renders kpi labels', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresorerieBudgets />
      </QueryClientProvider>
    )
    expect(screen.getByText(/Budget total/i)).toBeInTheDocument()
  })
})
