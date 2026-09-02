import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/hooks/analytics/useRapportsFilters', () => ({
  useRapportsFilters: () => ({
    view: 'dashboard',
    setView: vi.fn(),
    period: '30d',
    setPeriod: vi.fn(),
    filters: {},
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  }),
}))
vi.mock('@/hooks/analytics/useRapportsData', () => ({
  useRapportsData: () => ({
    data: null,
    stats: {
      totalEtablissements: 0,
      prospects: 0,
      enProduction: 0,
      enDeploiement: 0,
      totalTaches: 0,
      tachesTerminees: 0,
      progressionMoyenne: 0,
      totalPassages: 0,
      totalValeur: 0,
      caRealise: 0,
      caPrevisionnel: 0,
      tauxConversion: 0,
      pipelineValue: 0,
      passagesProduction: 0,
      partMarcheActuelle: 0,
      partMarchePotentielle: 0,
      passagesRestants: 0,
      potentielMarcheRestant: 0,
      passagesNationaux: 0,
    },
    etablissements: [],
    isLoading: false,
  }),
}))
vi.mock('@/contexts/RapportsDrilldownContext', () => ({
  RapportsDrilldownProvider: ({ children }: any) => <>{children}</>,
}))
vi.mock('@/components/rapports/RapportsPeriodSelector', () => ({
  RapportsPeriodSelector: () => null,
}))
vi.mock('@/components/rapports/RapportsAdvancedFilters', () => ({
  RapportsAdvancedFilters: () => null,
}))
vi.mock('@/components/rapports/RapportsHeroMetrics', () => ({
  RapportsHeroMetrics: () => <div data-testid="hero" />,
}))
vi.mock('@/components/rapports/RapportsChartsSection', () => ({
  RapportsChartsSection: () => null,
}))
vi.mock('@/components/rapports/RapportsTableView', () => ({
  RapportsTableView: () => null,
}))
vi.mock('@/components/rapports/RapportsTimelineView', () => ({
  RapportsTimelineView: () => null,
}))
vi.mock('@/components/rapports/RapportsGoalsView', () => ({
  RapportsGoalsView: () => null,
}))
vi.mock('@/components/rapports/RapportsComparativeView', () => ({
  RapportsComparativeView: () => null,
}))
vi.mock('@/components/rapports/RapportsAIInsights', () => ({
  RapportsAIInsights: () => null,
}))
vi.mock('@/components/rapports/RapportsBreadcrumbs', () => ({
  RapportsBreadcrumbs: () => null,
}))
vi.mock('@/components/rapports/RapportsViewSelectorCompact', () => ({
  RapportsViewSelectorCompact: () => null,
}))
vi.mock('@/components/rapports/RapportsMobileHeader', () => ({
  RapportsMobileHeader: () => null,
}))
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: () => null,
}))
vi.mock('@/lib/rapportExportUtils', () => ({
  exportToCSV: vi.fn(),
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
  prepareEtablissementsForExport: vi.fn(() => []),
}))

import Rapports from '../Rapports'

describe('Rapports page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Rapports />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
