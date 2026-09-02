import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockUseApporteurContextData } = vi.hoisted(() => {
  const contextData = {
    exchanges: [
      {
        id: 'sw-ex-1',
        date: '2026-07-08',
        canal: 'Visio' as const,
        resume: 'Point hebdo pipe — revue des 3 deals prioritaires',
      },
      {
        id: 'sw-ex-2',
        date: '2026-07-02',
        canal: 'Email' as const,
        resume: 'Envoi proposition co-signée CHU Bordeaux',
      },
      {
        id: 'sw-ex-3',
        date: '2026-06-24',
        canal: 'RDV' as const,
        resume: 'Comité de pilotage trimestriel — roadmap Q3',
      },
      {
        id: 'sw-ex-4',
        date: '2026-06-12',
        canal: 'Téléphone' as const,
        resume: 'Débrief RDV CH Cannes, prochaine étape validée',
      },
    ],
    nextSteps: [
      {
        id: 'sw-ns-1',
        action: 'Relancer CHU Bordeaux — proposition finale',
        echeance: '2026-07-15',
        owner: 'Commercial OpenPulse',
      },
      {
        id: 'sw-ns-2',
        action: 'Organiser atelier co-selling Q3',
        echeance: '2026-07-22',
        owner: 'Softway + OpenPulse',
      },
      {
        id: 'sw-ns-3',
        action: 'Envoyer support marketing personnalisé',
        echeance: '2026-07-30',
        owner: 'Marketing',
      },
    ],
    isLoading: false,
    addExchange: { mutateAsync: vi.fn() },
    updateExchange: { mutateAsync: vi.fn() },
    deleteExchange: { mutateAsync: vi.fn() },
    addNextStep: { mutateAsync: vi.fn() },
    updateNextStep: { mutateAsync: vi.fn() },
    deleteNextStep: { mutateAsync: vi.fn() },
  }

  return { mockUseApporteurContextData: vi.fn(() => contextData) }
})

vi.mock('./useApporteurContextData', () => ({
  useApporteurContextData: mockUseApporteurContextData,
}))

vi.mock('@/components/ui/card', async () => {
  const ReactModule = await import('react')

  type ReactNode = import('react').ReactNode
  type DivProps = import('react').HTMLAttributes<HTMLDivElement> & { children?: ReactNode }
  type HeadingProps = import('react').HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }

  const Card = ({ children, className, ...props }: DivProps) =>
    ReactModule.createElement('section', { 'data-testid': 'card', className, ...props }, children)

  const CardHeader = ({ children, className, ...props }: DivProps) =>
    ReactModule.createElement(
      'div',
      { 'data-testid': 'card-header', className, ...props },
      children
    )

  const CardContent = ({ children, className, ...props }: DivProps) =>
    ReactModule.createElement(
      'div',
      { 'data-testid': 'card-content', className, ...props },
      children
    )

  const CardFooter = ({ children, className, ...props }: DivProps) =>
    ReactModule.createElement(
      'div',
      { 'data-testid': 'card-footer', className, ...props },
      children
    )

  const CardTitle = ({ children, className, ...props }: HeadingProps) =>
    ReactModule.createElement('h3', { 'data-testid': 'card-title', className, ...props }, children)

  const CardDescription = ({ children, className, ...props }: DivProps) =>
    ReactModule.createElement(
      'div',
      { 'data-testid': 'card-description', className, ...props },
      children
    )

  return { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
})

vi.mock('@/components/ui/badge', async () => {
  const ReactModule = await import('react')

  type ReactNode = import('react').ReactNode
  type BadgeProps = import('react').HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode
    variant?: string
  }

  const Badge = ({ children, className, variant, ...props }: BadgeProps) =>
    ReactModule.createElement(
      'span',
      { 'data-testid': 'badge', 'data-variant': variant, className, ...props },
      children
    )

  const badgeVariants = () => ''

  return { Badge, badgeVariants }
})

vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react')
  const ReactModule = await import('react')

  type IconProps = import('react').SVGProps<SVGSVGElement>

  const createIcon = (name: string) => {
    const Icon = ({ className, ...props }: IconProps) =>
      ReactModule.createElement('svg', {
        'data-testid': `icon-${name}`,
        'aria-hidden': 'true',
        className,
        ...props,
      })

    return Icon
  }

  return {
    ...actual,
    ArrowRight: createIcon('ArrowRight'),
    CalendarClock: createIcon('CalendarClock'),
    MessageSquare: createIcon('MessageSquare'),
    Target: createIcon('Target'),
    Compass: createIcon('Compass'),
  }
})

import { ApporteurContextCards } from './ApporteurContextCards'

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ApporteurContextCards
        apporteurId="test-apporteur"
        dateDebut="2024-09-01"
        dateFin={null}
        prospectsCibles={20}
        clientsSignes={4}
        prospectsCiblesTousPartenaires={40}
      />
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ApporteurContextCards', () => {
  it('affiche la carte historique et la carte santé du partenariat', () => {
    renderComponent()

    expect(screen.getByRole('heading', { name: /Historique & prochaines étapes/i })).toBeVisible()
    expect(screen.getByText('Échanges récents')).toBeVisible()
    expect(screen.getByText('Next steps')).toBeVisible()
    expect(screen.getByText(/Durée du contrat/i)).toBeVisible()
    expect(screen.getByText(/Santé du/i)).toBeVisible()
    expect(screen.getAllByTestId('card')).toHaveLength(2)
  })

  it('rend les échanges récents et les prochaines étapes avec les valeurs métier attendues', () => {
    renderComponent()

    expect(screen.getByText('Point hebdo pipe — revue des 3 deals prioritaires')).toBeVisible()
    expect(screen.getByText('Envoi proposition co-signée CHU Bordeaux')).toBeVisible()
    expect(screen.getByText('Comité de pilotage trimestriel — roadmap Q3')).toBeVisible()
    expect(screen.getByText('Débrief RDV CH Cannes, prochaine étape validée')).toBeVisible()

    expect(screen.getByText('Relancer CHU Bordeaux — proposition finale')).toBeVisible()
    expect(screen.getByText('Organiser atelier co-selling Q3')).toBeVisible()
    expect(screen.getByText('Envoyer support marketing personnalisé')).toBeVisible()
  })

  it('rend les quatre critères de santé du partenariat', () => {
    renderComponent()

    expect(screen.getByRole('heading', { name: 'Commercial' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Organisation' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Relation' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Dépendance' })).toBeVisible()
  })
})
