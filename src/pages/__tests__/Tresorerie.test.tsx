import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/tresorerie/TresorerieDashboard', () => ({
  TresorerieDashboard: () => <div data-testid="tresorerie-dashboard">Dashboard</div>,
}))
vi.mock('@/components/tresorerie/TresorerieRevenus', () => ({ TresorerieRevenus: () => null }))
vi.mock('@/components/tresorerie/TresorerieDepenses', () => ({ TresorerieDepenses: () => null }))
vi.mock('@/components/tresorerie/TresorerieBanque', () => ({ TresorerieBanque: () => null }))
vi.mock('@/components/tresorerie/TresorerieCategories', () => ({
  TresorerieCategories: () => null,
}))
vi.mock('@/components/tresorerie/TresoreriePrevisionnelTab', () => ({
  TresoreriePrevisionnelTab: () => null,
}))
vi.mock('@/components/tresorerie/TresorerieBudgets', () => ({ TresorerieBudgets: () => null }))
vi.mock('@/components/tresorerie/TresorerieExportButtons', () => ({
  TresorerieExportButtons: () => null,
}))
vi.mock('@/components/tresorerie/TresorerieMobileHeader', () => ({
  TresorerieMobileHeader: () => null,
}))
vi.mock('@/components/tresorerie/TresorerieTabsCompact', () => ({
  TresorerieTabsCompact: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title }: any) => <h1>{title}</h1>,
}))
vi.mock('@/components/search/GlobalSearchDialog', () => ({ GlobalSearchDialog: () => null }))
vi.mock('@/hooks/tresorerie/useTresorerieDepenses', () => ({
  useTresorerieDepenses: () => ({ depenses: [], isLoading: false }),
}))
vi.mock('@/hooks/tresorerie/useTresorerieRevenus', () => ({
  useTresorerieRevenus: () => ({ revenus: [], isLoading: false }),
}))
vi.mock('@/hooks/tresorerie/useTresorerieBudgets', () => ({
  useTresorerieBudgets: () => ({
    budgets: [],
    isLoading: false,
    totaux: { nbDepasse: 0, nbAlerte: 0, nbOk: 0 },
  }),
}))
vi.mock('@/hooks/tresorerie/useQontoTransactions', () => ({
  useQontoTransactions: () => ({ transactions: [], connection: null, isLoading: false }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))

import Tresorerie from '../Tresorerie'

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Tresorerie Page', () => {
  it('renders the dashboard tab by default', () => {
    render(<Tresorerie />, { wrapper: createWrapper() })
    expect(screen.getByTestId('tresorerie-dashboard')).toBeInTheDocument()
  })

  it('renders the page title', () => {
    render(<Tresorerie />, { wrapper: createWrapper() })
    expect(screen.getByText('Trésorerie')).toBeInTheDocument()
  })
})
