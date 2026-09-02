/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ProductionHealthScorePreview,
  ProductionCohortsPreview,
  ProductionCSMActionsPreview,
  ProductionRenewalAlertsPreview,
} from './ProductionPreviews'

const {
  badgeCalls,
  progressCalls,
  cardProps,
  cardHeaderProps,
  cardContentProps,
  cardTitleProps,
  countUpProps,
} = vi.hoisted(() => ({
  badgeCalls: vi.fn(),
  progressCalls: vi.fn(),
  cardProps: vi.fn(),
  cardHeaderProps: vi.fn(),
  cardContentProps: vi.fn(),
  cardTitleProps: vi.fn(),
  countUpProps: vi.fn(),
}))

vi.mock('framer-motion', () => {
  const ReactModule = React
  const createMotion = (tag: keyof JSX.IntrinsicElements) =>
    ReactModule.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) =>
      ReactModule.createElement(tag, { ref, ...props }, children),
    )

  return {
    motion: {
      div: createMotion('div'),
      tr: createMotion('tr'),
      button: createMotion('button'),
      circle: createMotion('circle'),
    },
  }
})

vi.mock('lucide-react', () => {
  const ReactModule = React
  const icon = (name: string) =>
    ReactModule.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) =>
      ReactModule.createElement('svg', { ref, 'data-icon': name, ...props }),
    )

  return {
    TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'),
    AlertCircle: icon('AlertCircle'),
    CheckCircle2: icon('CheckCircle2'),
    Activity: icon('Activity'),
    Users: icon('Users'),
    Calendar: icon('Calendar'),
    MessageSquare: icon('MessageSquare'),
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) => {
    badgeCalls({ variant, className })
    return (
      <div data-testid="badge" data-variant={variant ?? ''} className={className} {...props}>
        {children}
      </div>
    )
  },
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: number }) => {
    progressCalls({ value, className })
    return <div data-testid="progress" data-value={String(value ?? '')} className={className} {...props} />
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardProps({ className })
    return (
      <section data-testid="card" className={className} {...props}>
        {children}
      </section>
    )
  },
  CardHeader: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardHeaderProps({ className })
    return (
      <div data-testid="card-header" className={className} {...props}>
        {children}
      </div>
    )
  },
  CardContent: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardContentProps({ className })
    return (
      <div data-testid="card-content" className={className} {...props}>
        {children}
      </div>
    )
  },
  CardTitle: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    cardTitleProps({ className })
    return (
      <div data-testid="card-title" className={className} {...props}>
        {children}
      </div>
    )
  },
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: ({ value, duration }: { value: number; duration: number }) => {
    countUpProps({ value, duration })
    return <span data-testid={`countup-${value}`}>{value}</span>
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('ProductionPreviews', () => {
  beforeEach(() => {
    badgeCalls.mockClear()
    progressCalls.mockClear()
    cardProps.mockClear()
    cardHeaderProps.mockClear()
    cardContentProps.mockClear()
    cardTitleProps.mockClear()
    countUpProps.mockClear()
  })

  it('renders ProductionHealthScorePreview with global score, sub-scores, trends and progress values', () => {
    render(<ProductionHealthScorePreview />, { wrapper: createWrapper() })

    expect(screen.getByText('Score de Santé')).toBeInTheDocument()
    expect(screen.getByText('+3pts ce mois')).toBeInTheDocument()
    expect(screen.getByText('Score global')).toBeInTheDocument()

    expect(screen.getByText('Adoption')).toBeInTheDocument()
    expect(screen.getByText('Satisfaction')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
    expect(screen.getByText('Support')).toBeInTheDocument()

    expect(screen.getByTestId('countup-82')).toHaveTextContent('82')
    expect(screen.getByTestId('countup-85')).toHaveTextContent('85')
    expect(screen.getByTestId('countup-78')).toHaveTextContent('78')
    expect(screen.getByTestId('countup-92')).toHaveTextContent('92')
    expect(screen.getByTestId('countup-65')).toHaveTextContent('65')

    const progressBars = screen.getAllByTestId('progress')
    expect(progressBars).toHaveLength(4)
    expect(progressBars.map((node) => node.getAttribute('data-value'))).toEqual(['85', '78', '92', '65'])

    expect(screen.getAllByText('/100')).toHaveLength(4)

    expect(document.querySelectorAll('[data-icon="TrendingUp"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-icon="TrendingDown"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-icon="Activity"]')).toHaveLength(1)

    expect(countUpProps.mock.calls.map((call) => call[0])).toEqual([
      { value: 82, duration: 1500 },
      { value: 85, duration: 1500 },
      { value: 78, duration: 1500 },
      { value: 92, duration: 1500 },
      { value: 65, duration: 1500 },
    ])
  })

  it('renders ProductionCohortsPreview with cohort rows, retention values and legend', () => {
    render(<ProductionCohortsPreview />, { wrapper: createWrapper() })

    expect(screen.getByText('Analyse par Cohortes')).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getByText('Cohorte')).toBeInTheDocument()
    expect(within(table).getByText('Clients')).toBeInTheDocument()
    expect(within(table).getByText('M+1')).toBeInTheDocument()
    expect(within(table).getByText('M+4')).toBeInTheDocument()

    expect(within(table).getByText('Jan 2024')).toBeInTheDocument()
    expect(within(table).getByText('Fév 2024')).toBeInTheDocument()
    expect(within(table).getByText('Mar 2024')).toBeInTheDocument()
    expect(within(table).getByText('Avr 2024')).toBeInTheDocument()
    expect(within(table).getByText('Mai 2024')).toBeInTheDocument()

    expect(within(table).getByText('8')).toBeInTheDocument()
    expect(within(table).getByText('12')).toBeInTheDocument()
    expect(within(table).getByText('6')).toBeInTheDocument()
    expect(within(table).getByText('10')).toBeInTheDocument()
    expect(within(table).getByText('15')).toBeInTheDocument()

    expect(within(table).getAllByText('100%').length).toBeGreaterThanOrEqual(5)
    expect(within(table).getByText('88%')).toBeInTheDocument()
    expect(within(table).getAllByText('75%')).toHaveLength(3)
    expect(within(table).getByText('63%')).toBeInTheDocument()
    expect(within(table).getByText('92%')).toBeInTheDocument()
    expect(within(table).getAllByText('83%')).toHaveLength(2)
    expect(within(table).getByText('90%')).toBeInTheDocument()

    expect(screen.getByText('≥90%')).toBeInTheDocument()
    expect(screen.getByText('75-89%')).toBeInTheDocument()
    expect(screen.getByText('<75%')).toBeInTheDocument()
  })

  it('renders ProductionCSMActionsPreview with 4 action buttons and client summary card', () => {
    render(<ProductionCSMActionsPreview />, { wrapper: createWrapper() })

    expect(screen.getByText('Actions rapides CSM')).toBeInTheDocument()

    const noteButton = screen.getByRole('button', { name: /Ajouter une note/i })
    const rdvButton = screen.getByRole('button', { name: /Planifier un RDV/i })
    const alertButton = screen.getByRole('button', { name: /Créer une alerte/i })
    const renewButton = screen.getByRole('button', { name: /Valider le renouvellement/i })

    expect(noteButton).toBeInTheDocument()
    expect(rdvButton).toBeInTheDocument()
    expect(alertButton).toBeInTheDocument()
    expect(renewButton).toBeInTheDocument()

    expect(document.querySelectorAll('[data-icon="MessageSquare"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-icon="Calendar"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-icon="AlertCircle"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-icon="CheckCircle2"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-icon="Users"]')).toHaveLength(1)

    expect(screen.getByText('Clinique Saint-Jean')).toBeInTheDocument()
    expect(screen.getByText('Santé: 85')).toBeInTheDocument()
    expect(screen.getByText('42 utilisateurs actifs')).toBeInTheDocument()
    expect(screen.getByText('Renouvellement dans 45 jours')).toBeInTheDocument()

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByTestId('card-header')).toBeInTheDocument()
    expect(screen.getByTestId('card-content')).toBeInTheDocument()
    expect(screen.getByTestId('card-title')).toBeInTheDocument()
    expect(cardProps).toHaveBeenCalledWith({ className: 'mt-4' })
  })

  it('renders ProductionRenewalAlertsPreview with urgent, planned and renewed statuses', () => {
    render(<ProductionRenewalAlertsPreview />, { wrapper: createWrapper() })

    expect(screen.getByText('Alertes renouvellement')).toBeInTheDocument()

    expect(screen.getByText('CH de Bordeaux')).toBeInTheDocument()
    expect(screen.getByText('Expire dans 15 jours')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()

    expect(screen.getByText('Agence du Parc')).toBeInTheDocument()
    expect(screen.getByText('Expire dans 45 jours')).toBeInTheDocument()
    expect(screen.getByText('À planifier')).toBeInTheDocument()

    expect(screen.getByText('Groupe Estuaire')).toBeInTheDocument()
    expect(screen.getByText('Renouvelé pour 2 ans')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()

    expect(document.querySelectorAll('[data-icon="AlertCircle"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-icon="Calendar"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-icon="CheckCircle2"]')).toHaveLength(1)

    expect(badgeCalls.mock.calls.map((call) => call[0].variant ?? '')).toContain('destructive')
    expect(badgeCalls.mock.calls.map((call) => call[0].variant ?? '')).toContain('outline')
  })
})