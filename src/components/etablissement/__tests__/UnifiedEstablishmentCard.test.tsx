import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { renderWithProviders } from '@/test-utils/renderWithProviders'
import { UnifiedEstablishmentCard } from '../UnifiedEstablishmentCard'

vi.mock('@/config/statusConfig', () => ({
  getStatusBorderColor: () => 'border-blue-500',
  getStatusBadgeVariant: () => 'default',
  getPhaseFromStatus: () => 'prospect',
}))

vi.mock('@/config/cardConfig', () => ({
  getCardConfig: () => ({
    showMetrics: ['value'],
    showBadges: ['statut'],
    actions: [],
    quickActions: [],
  }),
}))

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: () => 0,
}))

vi.mock('@/lib/productionUtils', () => ({
  formatCurrency: (v: number) => `${v}€`,
  getMonthsInProduction: () => 6,
  getRenewalInfo: () => null,
}))

const etab = {
  id: 'e1',
  nom: 'CHU Lyon',
  ville: 'Lyon',
  statut: 'Prospect',
  logo_url: null,
  nombre_passages: 50000,
  created_at: '2025-01-01',
} as any

describe('UnifiedEstablishmentCard', () => {
  it('renders etablissement name', () => {
    renderWithProviders(
      <TooltipProvider>
        <UnifiedEstablishmentCard etablissement={etab} />
      </TooltipProvider>
    )
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument()
  })

  it('renders city', () => {
    renderWithProviders(
      <TooltipProvider>
        <UnifiedEstablishmentCard etablissement={etab} />
      </TooltipProvider>
    )
    expect(screen.getByText(/Lyon,/)).toBeInTheDocument()
  })
})
