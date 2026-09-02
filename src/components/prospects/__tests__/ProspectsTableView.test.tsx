import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <span>{name}</span>,
}))

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (n: number) => `${n} €`,
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/layout/CRMTableWrapper', () => ({
  CRMTableWrapper: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/layout/CRMEmptyState', () => ({
  CRMEmptyState: () => <div>Aucun prospect</div>,
}))

vi.mock('./ProspectsMobileCard', () => ({
  ProspectsMobileCard: () => <div data-testid="mobile-card" />,
}))

import { ProspectsTableView } from '../ProspectsTableView'

const prospects = [
  { id: '1', nom: 'CHU Alpha', statut: 'Prospect', region: 'IDF' },
  { id: '2', nom: 'Clinique Beta', statut: 'Contacté', region: 'PACA' },
] as any[]

const getProgressInfo = () => ({
  progress: 50,
  totalTasks: 10,
  completedTasks: 5,
  potentialValue: 50000,
})

function renderProspectsTable(prospectRows: any[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProspectsTableView
          prospects={prospectRows}
          selectedIds={new Set()}
          onSelect={vi.fn()}
          onSelectAll={vi.fn()}
          getProgressInfo={getProgressInfo}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProspectsTableView', () => {
  it('renders table with prospects', () => {
    renderProspectsTable(prospects)
    expect(screen.getAllByText('CHU Alpha').length).toBeGreaterThanOrEqual(1)
  })

  it('renders empty state when no prospects', () => {
    renderProspectsTable([])
    expect(screen.getByText('Aucun prospect')).toBeInTheDocument()
  })
})
