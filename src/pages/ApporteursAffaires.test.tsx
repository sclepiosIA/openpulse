import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'

type ApporteurSeedItem = {
  readonly id: string
  readonly nom: string
  readonly metrics: {
    readonly clientsApportes: number
    readonly arrGenere: number
  }
}

type HeaderStat = {
  label: string
  value: number | string
  highlight?: boolean
}

type HeaderProps = {
  title: string
  subtitle: string
  icon: unknown
  stats: HeaderStat[]
  children?: ReactNode
}

type TabsProps = {
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: ReactNode
}

type TabsContentProps = {
  value: string
  className?: string
  children?: ReactNode
}

type DashboardProps = {
  apporteurs: readonly ApporteurSeedItem[]
}

type DetailProps = {
  apporteur: ApporteurSeedItem
}

type IconProps = {
  className?: string
}

const { APPORTERS, mockHeader, mockTabsValue, mockDashboard, mockDetail, tabsState } = vi.hoisted(
  () => {
    const APPORTERS = [
      {
        id: 'albatros-conseil',
        nom: 'Albatros Conseil',
        metrics: {
          clientsApportes: 4,
          arrGenere: 42000,
        },
      },
      {
        id: 'boreal-partners',
        nom: 'Boréal Partners',
        metrics: {
          clientsApportes: 7,
          arrGenere: 83500,
        },
      },
      {
        id: 'cygnus-growth',
        nom: 'Cygnus Growth',
        metrics: {
          clientsApportes: 2,
          arrGenere: 12000,
        },
      },
    ] as const

    return {
      APPORTERS,
      mockHeader: vi.fn<(props: HeaderProps) => void>(),
      mockTabsValue: vi.fn<(value: string | undefined) => void>(),
      mockDashboard: vi.fn<(apporteurs: readonly ApporteurSeedItem[]) => void>(),
      mockDetail: vi.fn<(apporteur: ApporteurSeedItem) => void>(),
      tabsState: { value: undefined as string | undefined },
    }
  }
)

vi.mock('@/data/apporteursSeed', () => ({
  apporteursSeed: APPORTERS,
}))

vi.mock('@/components/apporteurs/useApporteursArr', () => ({
  useApporteursArr: () => ({ totalArr: 137500, totalClients: 13, isReady: true }),
}))

vi.mock('lucide-react', () => ({
  Handshake: (props: IconProps) => (
    <svg aria-hidden="true" className={props.className} data-testid="icon-handshake" />
  ),
  LayoutDashboard: (props: IconProps) => (
    <svg aria-hidden="true" className={props.className} data-testid="icon-layout-dashboard" />
  ),
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: (props: HeaderProps) => {
    mockHeader(props)

    return (
      <header data-testid="immersive-header">
        <h1>{props.title}</h1>
        <p>{props.subtitle}</p>
        <dl>
          {props.stats.map((stat) => (
            <div key={stat.label} data-highlight={stat.highlight === true ? 'true' : 'false'}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
        {props.children}
      </header>
    )
  },
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: (props: TabsProps) => {
    tabsState.value = props.value
    mockTabsValue(props.value)

    return (
      <div className={props.className} data-active-value={props.value} data-testid="tabs-root">
        {props.children}
      </div>
    )
  },
  TabsContent: (props: TabsContentProps) => {
    if (props.value !== tabsState.value) return null

    return (
      <section className={props.className} data-testid={`tabs-content-${props.value}`}>
        {props.children}
      </section>
    )
  },
  TabsList: (props: { children?: ReactNode }) => <div>{props.children}</div>,
  TabsTrigger: (props: { children?: ReactNode }) => <button type="button">{props.children}</button>,
}))

vi.mock('@/components/apporteurs/ApporteurDashboard', () => ({
  ApporteurDashboard: (props: DashboardProps) => {
    mockDashboard(props.apporteurs)

    return (
      <div data-testid="dashboard-panel">Dashboard mock {props.apporteurs.length} partenaires</div>
    )
  },
}))

vi.mock('@/components/apporteurs/ApporteurDetailTab', () => ({
  ApporteurDetailTab: (props: DetailProps) => {
    mockDetail(props.apporteur)

    return (
      <div data-testid={`detail-panel-${props.apporteur.id}`}>
        Détail mock {props.apporteur.nom}
      </div>
    )
  },
}))

import ApporteursAffaires from './ApporteursAffaires'

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location-search">{location.search}</span>
}

function renderPage(initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ApporteursAffaires />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  tabsState.value = undefined
})

describe('ApporteursAffaires', () => {
  it('rend la page prête, les onglets métier et les statistiques calculées', () => {
    renderPage('/')

    const page = document.querySelector('[data-page="apporteurs-affaires"]')
    expect(page).not.toBeNull()
    expect(page?.getAttribute('data-page-ready')).toBe('true')
    expect(page?.getAttribute('data-page-state')).toBe('ready')

    expect(screen.getByRole('button', { name: /Dashboard/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Albatros Conseil/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Boréal Partners/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Cygnus Growth/i })).not.toBeNull()

    const headerCall = mockHeader.mock.calls.at(-1)
    expect(headerCall).toBeDefined()
    const headerProps = headerCall?.[0]

    expect(headerProps).toEqual(
      expect.objectContaining({
        title: "Apporteurs d'Affaires",
        subtitle: 'Suivi des partenariats commerciaux',
      })
    )
    expect(headerProps?.stats).toEqual([
      { label: 'Partenaires', value: 3 },
      { label: 'Clients apportés', value: 13 },
      { label: 'ARR cumulé', value: '138k€', highlight: true },
    ])

    expect(screen.getByTestId('tabs-root').getAttribute('data-active-value')).toBe('dashboard')
    expect(mockTabsValue).toHaveBeenLastCalledWith('dashboard')
    expect(mockDashboard).toHaveBeenCalledWith(APPORTERS)
    expect(mockDetail).not.toHaveBeenCalled()
    expect(screen.getByTestId('dashboard-panel').textContent).toBe('Dashboard mock 3 partenaires')
    expect(screen.queryByTestId('detail-panel-albatros-conseil')).toBeNull()
  })

  it('active un onglet apporteur valide depuis le paramètre tab', () => {
    renderPage('/?tab=boreal-partners')

    const activeButton = screen.getByRole('button', { name: /Boréal Partners/i })
    const dashboardButton = screen.getByRole('button', { name: /Dashboard/i })

    expect(mockTabsValue).toHaveBeenLastCalledWith('boreal-partners')
    expect(screen.getByTestId('tabs-root').getAttribute('data-active-value')).toBe(
      'boreal-partners'
    )
    expect(activeButton.className).toContain('bg-card/20')
    expect(dashboardButton.className).toContain('text-white/70')
    expect(dashboardButton.className).not.toContain('bg-card/20')
    expect(mockDashboard).not.toHaveBeenCalled()
    expect(mockDetail).toHaveBeenCalledWith(APPORTERS[1])
    expect(screen.getByTestId('detail-panel-boreal-partners').textContent).toBe(
      'Détail mock Boréal Partners'
    )
    expect(screen.queryByTestId('dashboard-panel')).toBeNull()
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=boreal-partners')
  })

  it('revient au dashboard quand le paramètre tab ne correspond à aucun apporteur', () => {
    renderPage('/?tab=onglet-inconnu')

    const dashboardButton = screen.getByRole('button', { name: /Dashboard/i })
    const partnerButton = screen.getByRole('button', { name: /Albatros Conseil/i })

    expect(mockTabsValue).toHaveBeenLastCalledWith('dashboard')
    expect(screen.getByTestId('tabs-root').getAttribute('data-active-value')).toBe('dashboard')
    expect(dashboardButton.className).toContain('bg-card/20')
    expect(partnerButton.className).toContain('text-white/70')
    expect(partnerButton.className).not.toContain('bg-card/20')
    expect(screen.getByTestId('dashboard-panel').textContent).toBe('Dashboard mock 3 partenaires')
    expect(screen.queryByTestId('detail-panel-albatros-conseil')).toBeNull()
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=onglet-inconnu')
  })

  it('met à jour les paramètres de recherche lors du changement manuel d’onglet', async () => {
    renderPage('/?tab=boreal-partners')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cygnus Growth/i }))
    })

    expect(screen.getByTestId('location-search').textContent).toBe('?tab=cygnus-growth')
    expect(mockTabsValue).toHaveBeenLastCalledWith('cygnus-growth')
    expect(screen.getByRole('button', { name: /Cygnus Growth/i }).className).toContain('bg-card/20')
    expect(screen.getByTestId('detail-panel-cygnus-growth').textContent).toBe(
      'Détail mock Cygnus Growth'
    )
    expect(mockDetail).toHaveBeenCalledWith(APPORTERS[2])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dashboard/i }))
    })

    expect(screen.getByTestId('location-search').textContent).toBe('')
    expect(mockTabsValue).toHaveBeenLastCalledWith('dashboard')
    expect(screen.getByRole('button', { name: /Dashboard/i }).className).toContain('bg-card/20')
    expect(screen.getByTestId('dashboard-panel').textContent).toBe('Dashboard mock 3 partenaires')
    expect(screen.queryByTestId('detail-panel-cygnus-growth')).toBeNull()
  })
})
