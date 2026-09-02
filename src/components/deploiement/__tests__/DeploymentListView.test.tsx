import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/shared/useSmartNavigation', () => ({
  useSmartNavigation: () => ({ smartNavigate: vi.fn(), navigate: vi.fn() }),
}))

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <span>{name}</span>,
}))

vi.mock('../DeploymentHealthIndicator', () => ({
  DeploymentHealthIndicator: () => <span data-testid="health" />,
}))

vi.mock('../DeploymentMobileCard', () => ({
  DeploymentMobileCard: () => <div data-testid="mobile-card" />,
}))

import { DeploymentListView } from '../DeploymentListView'

const etabs = [
  { id: '1', nom: 'CHU Alpha', statut: 'Déploiement', region: 'IDF', date_signature: '2025-06-01' },
  {
    id: '2',
    nom: 'Clinique Beta',
    statut: 'Formation',
    region: 'PACA',
    date_signature: '2025-08-01',
  },
] as any[]

const healthScores = new Map()

describe('DeploymentListView', () => {
  it('renders table with etablissement names', () => {
    render(
      <MemoryRouter>
        <DeploymentListView etablissements={etabs} healthScores={healthScores} />
      </MemoryRouter>
    )
    expect(screen.getAllByText('CHU Alpha').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Clinique Beta').length).toBeGreaterThanOrEqual(1)
  })

  it('renders table headers', () => {
    render(
      <MemoryRouter>
        <DeploymentListView etablissements={etabs} healthScores={healthScores} />
      </MemoryRouter>
    )
    expect(screen.getByText('Établissement')).toBeInTheDocument()
    expect(screen.getByText('Statut')).toBeInTheDocument()
  })
})
