import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MarketingStatistiques from './MarketingStatistiques'

vi.mock('lucide-react', () => ({
  BarChart3: (props: { className?: string; 'aria-hidden'?: string }) => (
    <svg data-testid="bar-chart-icon" {...props} />
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="card">{children}</section>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardFooter: ({ children }: { children: React.ReactNode }) => (
    <footer data-testid="card-footer">{children}</footer>
  ),
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('MarketingStatistiques', () => {
  it('affiche le titre principal, la description et l’icône marketing', () => {
    renderWithProviders(<MarketingStatistiques />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Statistiques marketing' })
    ).toBeInTheDocument()
    expect(screen.getByText('Suivi des performances des actions marketing.')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart-icon')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('bar-chart-icon')).toHaveClass('h-6', 'w-6')
  })

  it('affiche la carte de contenu bientôt disponible avec le message attendu', () => {
    renderWithProviders(<MarketingStatistiques />)

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Bientôt disponible' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Cette page accueillera prochainement les indicateurs et graphiques de suivi marketing. Indique-moi quels KPIs et visualisations tu souhaites y voir apparaître.'
      )
    ).toBeInTheDocument()
  })

  it('applique les classes de présentation attendues au contenu de la carte', () => {
    renderWithProviders(<MarketingStatistiques />)

    expect(screen.getByTestId('card-content')).toHaveClass('text-sm', 'text-muted-foreground')
  })
})
