import React from 'react'
import { render, screen, within, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapPreview, TableauGeoPreview, RegionDetailPreview } from './AnalyseGeographiquePreviews'

const {
  MotionDiv,
  AnimatePresenceMock,
  IconStub,
  MockBadge,
  MockButton,
  MockCard,
  MockCardContent,
  MockCountUp,
} = vi.hoisted(() => {
  type MotionProps = React.HTMLAttributes<HTMLDivElement> & {
    initial?: Record<string, unknown>
    animate?: Record<string, unknown>
    transition?: Record<string, unknown>
    whileHover?: Record<string, unknown>
  }
  const MotionDivImpl: React.FC<MotionProps> = ({ children, ...rest }) => <div {...rest}>{children}</div>
  const AnimatePresenceImpl: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>
  const IconImpl: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <svg aria-hidden="true" {...props} />
  type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { variant?: string }
  const BadgeImpl: React.FC<BadgeProps> = ({ children, ...rest }) => <span {...rest}>{children}</span>
  type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string }
  const ButtonImpl: React.FC<ButtonProps> = ({ children, ...rest }) => <button {...rest}>{children}</button>
  const CardImpl: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...rest }) => <div {...rest}>{children}</div>
  const CardContentImpl: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...rest }) => <div {...rest}>{children}</div>
  type CountUpProps = { value: number; delay?: number; duration?: number; suffix?: string }
  const CountUpImpl: React.FC<CountUpProps> = ({ value, suffix }) => <span>{`${value}${suffix ?? ''}`}</span>
  return {
    MotionDiv: MotionDivImpl,
    AnimatePresenceMock: AnimatePresenceImpl,
    IconStub: IconImpl,
    MockBadge: BadgeImpl,
    MockButton: ButtonImpl,
    MockCard: CardImpl,
    MockCardContent: CardContentImpl,
    MockCountUp: CountUpImpl,
  }
})

vi.mock('framer-motion', () => ({
  motion: { div: MotionDiv },
  AnimatePresence: AnimatePresenceMock,
}))

vi.mock('lucide-react', () => ({
  MapPin: IconStub,
  Building2: IconStub,
  TrendingUp: IconStub,
  Layers: IconStub,
  ZoomIn: IconStub,
  ZoomOut: IconStub,
  Navigation: IconStub,
  Table: IconStub,
  Download: IconStub,
  ChevronRight: IconStub,
}))

vi.mock('@/components/ui/badge', () => ({ Badge: MockBadge }))
vi.mock('@/components/ui/button', () => ({ Button: MockButton }))
vi.mock('@/components/ui/card', () => ({ Card: MockCard, CardContent: MockCardContent }))
vi.mock('../TutorielCountUpAnimation', () => ({ TutorielCountUpAnimation: MockCountUp }))

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const client = createTestClient()
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(ui, { wrapper: Wrapper })
}

describe('AnalyseGeographiquePreviews', () => {
  it('MapPreview: affiche boutons et légende, puis rend les marqueurs après délai', async () => {
    vi.useFakeTimers()
    renderWithProviders(<MapPreview />)

    expect(screen.getByRole('button', { name: 'Zoomer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dézoomer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calques' })).toBeInTheDocument()

    expect(screen.getByText('Carte des établissements')).toBeInTheDocument()
    expect(screen.getByText('Production')).toBeInTheDocument()
    expect(screen.getByText('Déploiement')).toBeInTheDocument()
    expect(screen.getByText('Prospect')).toBeInTheDocument()

    expect(screen.queryByText('Groupe Vallois')).not.toBeInTheDocument()
    expect(screen.queryByText('Agence Grenoble')).not.toBeInTheDocument()
    expect(screen.queryByText('CH Marseille')).not.toBeInTheDocument()
    expect(screen.queryByText('Groupe Aubier')).not.toBeInTheDocument()
    expect(screen.queryByText('CH Paris')).not.toBeInTheDocument()
    expect(screen.queryByText('CH Toulouse')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(screen.getByText('Groupe Vallois')).toBeInTheDocument()
    expect(screen.getByText('Agence Grenoble')).toBeInTheDocument()
    expect(screen.getByText('CH Marseille')).toBeInTheDocument()
    expect(screen.getByText('Groupe Aubier')).toBeInTheDocument()
    expect(screen.getByText('CH Paris')).toBeInTheDocument()
    expect(screen.getByText('CH Toulouse')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('TableauGeoPreview: rend les lignes avec valeurs et permet export', () => {
    renderWithProviders(<TableauGeoPreview />)

    expect(screen.getByText('Données par région')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exporter/i })).toBeInTheDocument()

    const header = screen.getByText('Région')
    expect(header).toBeInTheDocument()
    expect(screen.getByText('Établissements')).toBeInTheDocument()
    expect(screen.getByText('CA')).toBeInTheDocument()
    expect(screen.getByText('Progression')).toBeInTheDocument()

    const rowRA = screen.getByText('Rhône-Alpes').closest('div')
    expect(rowRA).toBeTruthy()
    const withinRA = within(rowRA as HTMLElement)
    expect(withinRA.getByText('12')).toBeInTheDocument()
    expect(withinRA.getByText('485000 €')).toBeInTheDocument()
    expect(withinRA.getByText('92%')).toBeInTheDocument()

    const rowIDF = screen.getByText('Île-de-France').closest('div')
    const withinIDF = within(rowIDF as HTMLElement)
    expect(withinIDF.getByText('8')).toBeInTheDocument()
    expect(withinIDF.getByText('320000 €')).toBeInTheDocument()
    expect(withinIDF.getByText('78%')).toBeInTheDocument()

    const rowPACA = screen.getByText('PACA').closest('div')
    const withinPACA = within(rowPACA as HTMLElement)
    expect(withinPACA.getByText('6')).toBeInTheDocument()
    expect(withinPACA.getByText('245000 €')).toBeInTheDocument()
    expect(withinPACA.getByText('85%')).toBeInTheDocument()

    const rowNA = screen.getByText('Nouvelle-Aquitaine').closest('div')
    const withinNA = within(rowNA as HTMLElement)
    expect(withinNA.getByText('5')).toBeInTheDocument()
    expect(withinNA.getByText('180000 €')).toBeInTheDocument()
    expect(withinNA.getByText('65%')).toBeInTheDocument()
  })

  it('RegionDetailPreview: affiche les statistiques et le CA total prévu', () => {
    renderWithProviders(<RegionDetailPreview />)

    expect(screen.getByText('Rhône-Alpes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Voir détails/i })).toBeInTheDocument()

    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()

    expect(screen.getByText('Production')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()

    expect(screen.getByText('Déploiement')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    expect(screen.getByText('Prospects')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    expect(screen.getByText('CA Total Prévu')).toBeInTheDocument()
    expect(screen.getByText('485000 €')).toBeInTheDocument()
  })
})