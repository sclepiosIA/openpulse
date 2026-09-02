import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Polyfill for maplibre-gl which calls window.URL.createObjectURL at module load.
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  ;(window.URL as any).createObjectURL = () => 'blob:mock'
}

// Stub maplibre-gl entirely so its top-level setWorkerUrl call doesn't run.
vi.mock('maplibre-gl', () => ({
  default: { Map: class {}, setWorkerUrl: vi.fn() },
  Map: class {},
  setWorkerUrl: vi.fn(),
}))

// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/components/Map', () => ({
  default: () => <div data-testid="map" />,
}))
vi.mock('@/components/analyse/GeographicStatsHeader', () => ({
  GeographicStatsHeader: () => <div />,
}))
vi.mock('@/components/analyse/GeographicCharts', () => ({
  GeographicCharts: () => <div />,
}))
vi.mock('@/components/analyse/GeographicFilters', () => ({
  GeographicFilters: () => <div />,
}))
vi.mock('@/components/analyse/GeographicTableView', () => ({
  GeographicTableView: () => <div />,
}))
vi.mock('@/components/analyse/FranceRegionMap', () => ({
  FranceRegionMap: () => <div />,
}))
vi.mock('@/components/analyse/ExpansionTimeline', () => ({
  ExpansionTimeline: () => <div />,
}))
vi.mock('@/components/analyse/MobileFiltersSheet', () => ({
  MobileFiltersSheet: () => null,
}))
vi.mock('@/components/analyse/AnalyseGeoMobileHeader', () => ({
  AnalyseGeoMobileHeader: () => null,
}))
vi.mock('@/components/analyse/PhaseFiltersCompact', () => ({
  PhaseFiltersCompact: () => null,
}))
vi.mock('@/components/analyse/TabsCompact', () => ({
  TabsCompact: () => null,
}))
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: () => null,
}))
vi.mock('@/config/phases', () => ({
  getGeoPhaseFromStatus: () => 'prospects',
}))

import AnalyseGeographique from '../AnalyseGeographique'

// JarvisUnifiedContext mock — many pages include GlobalSearchDialog which uses it.
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JarvisUnifiedProvider: ({ children }: any) => children,
  useJarvisUnified: () => ({
    setIsPanelOpen: () => {},
    isPanelOpen: false,
    sendMessage: () => {},
  }),
}))

describe('AnalyseGeographique page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AnalyseGeographique />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
