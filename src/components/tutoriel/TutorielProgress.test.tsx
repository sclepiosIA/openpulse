import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorielProgress } from './TutorielProgress'

const { mockBadge } = vi.hoisted(() => {
  return {
    mockBadge: vi.fn(({ children }) => <div data-testid="badge-mock">{children}</div>)
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: { children: React.ReactNode }) => mockBadge(props)
}))

vi.mock('lucide-react', () => ({
  Clock: (props: { className?: string }) => <svg data-testid="clock-icon" {...props} />,
  BookOpen: (props: { className?: string }) => <svg data-testid="bookopen-icon" {...props} />
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('TutorielProgress', () => {
  it('affiche le badge avec le label de niveau correct pour débutant', () => {
    renderWithClient(
      <TutorielProgress estimatedTime="10 min" level="debutant" sectionsCount={1} />
    )

    const badge = screen.getByTestId('badge-mock')
    expect(badge).toHaveTextContent('Débutant')
    expect(mockBadge).toHaveBeenCalled()
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
    expect(screen.getByTestId('bookopen-icon')).toBeInTheDocument()
    expect(screen.getByText('10 min')).toBeInTheDocument()
    expect(screen.getByText('1 section')).toBeInTheDocument()
  })

  it("affiche le label 'Intermédiaire' et le pluriel des sections", () => {
    renderWithClient(
      <TutorielProgress estimatedTime="25 min" level="intermediaire" sectionsCount={3} />
    )

    expect(screen.getByTestId('badge-mock')).toHaveTextContent('Intermédiaire')
    expect(screen.getByText('25 min')).toBeInTheDocument()
    expect(screen.getByText('3 sections')).toBeInTheDocument()
  })

  it("affiche le label 'Avancé' pour le niveau avance", () => {
    renderWithClient(
      <TutorielProgress estimatedTime="45 min" level="avance" sectionsCount={2} />
    )

    expect(screen.getByTestId('badge-mock')).toHaveTextContent('Avancé')
    expect(screen.getByText('2 sections')).toBeInTheDocument()
  })

  it('gère le singulier/pluriel des sections correctement', () => {
    renderWithClient(
      <TutorielProgress estimatedTime="5 min" level="debutant" sectionsCount={1} />
    )

    expect(screen.getByText('1 section')).toBeInTheDocument()
    expect(screen.queryByText('1 sections')).not.toBeInTheDocument()
  })
})