import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RapportsAdvancedFilters } from '../RapportsAdvancedFilters'

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({ data: [] }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
}))

vi.mock('@/hooks/system/useReferenceData', () => ({
  useStatutsEtablissement: () => ({ data: [] }),
  useTypesOffre: () => ({ data: [] }),
  usePalliers: () => ({ data: [] }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const defaultProps = {
  selectedEtablissements: [],
  onSelectedEtablissementsChange: vi.fn(),
  selectedResponsables: [],
  onSelectedResponsablesChange: vi.fn(),
  selectedStatuts: [],
  onSelectedStatutsChange: vi.fn(),
  selectedTypesOffre: [],
  onSelectedTypesOffreChange: vi.fn(),
  selectedPalliers: [],
  onSelectedPalliersChange: vi.fn(),
  minValue: 0,
  maxValue: 1000000,
  onValueRangeChange: vi.fn(),
  minPassages: 0,
  maxPassages: 200000,
  onPassagesRangeChange: vi.fn(),
  includeProspects: true,
  onIncludeProspectsChange: vi.fn(),
  productionOnly: false,
  onProductionOnlyChange: vi.fn(),
  compareWithPrevious: false,
  onCompareWithPreviousChange: vi.fn(),
  onResetFilters: vi.fn(),
}

describe('RapportsAdvancedFilters', () => {
  it('renders filter trigger button', () => {
    render(
      <QueryClientProvider client={qc}>
        <RapportsAdvancedFilters {...defaultProps} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Filtres')).toBeInTheDocument()
  })

  it('renders with active filters badge', () => {
    render(
      <QueryClientProvider client={qc}>
        <RapportsAdvancedFilters {...defaultProps} selectedStatuts={['Production']} />
      </QueryClientProvider>
    )
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders container', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <RapportsAdvancedFilters {...defaultProps} />
      </QueryClientProvider>
    )
    expect(container.firstChild).toBeInTheDocument()
  })
})
