import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}))

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (n: number) => `${n} €`,
}))

import { ProspectsKanbanView } from '../ProspectsKanbanView'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

const prospects = [
  { id: '1', nom: 'CHU Alpha', statut: 'Prospect', region: 'IDF' },
  { id: '2', nom: 'Clinique Beta', statut: 'Contacté', region: 'PACA' },
] as Etablissement[]

const getProgressInfo = () => ({
  progress: 40,
  totalTasks: 10,
  completedTasks: 4,
  potentialValue: 50000,
})

describe('ProspectsKanbanView', () => {
  it('renders kanban columns', () => {
    render(
      <MemoryRouter>
        <ProspectsKanbanView
          prospects={prospects}
          getProgressInfo={getProgressInfo}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Prospects')).toBeInTheDocument()
    expect(screen.getByText('Contactés')).toBeInTheDocument()
    expect(screen.getByText('Attente RDV')).toBeInTheDocument()
  })

  it('renders prospect cards in columns', () => {
    render(
      <MemoryRouter>
        <ProspectsKanbanView
          prospects={prospects}
          getProgressInfo={getProgressInfo}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getAllByText('CHU Alpha').length).toBeGreaterThanOrEqual(1)
  })
})
