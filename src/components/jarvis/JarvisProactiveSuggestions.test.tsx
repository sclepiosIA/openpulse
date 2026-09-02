import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  SUGGESTIONS,
  ALERTS,
  feedbackSubmit,
  dismissSuggestion,
  dismissAlert,
  markAsRead,
  navigateMock,
  onAskJarvisMock,
} = vi.hoisted(() => {
  const SUGGESTIONS = [
    {
      id: 's1',
      type: 'tip',
      title: 'Optimiser le pipeline',
      description: 'Identifie les opportunités les plus proches de la signature.',
      priority: 'low',
      dismissable: true,
      actionLabel: 'Demander à JARVIS',
    },
    {
      id: 's2',
      type: 'warning',
      title: 'Risque de churn',
      description: 'Un client montre des signaux de désengagement.',
      priority: 'high',
      dismissable: true,
      actionLabel: 'Analyser',
    },
    {
      id: 's3',
      type: 'insight',
      title: 'Hausse du CA',
      description: 'Les revenus ont augmenté sur les 7 derniers jours.',
      priority: 'medium',
      dismissable: true,
      actionLabel: 'Voir détail',
    },
    {
      id: 's4',
      type: 'action',
      title: 'Relancer prospect',
      description: 'Planifie une relance pour un prospect froid.',
      priority: 'medium',
      dismissable: true,
      actionLabel: 'Relancer',
    },
  ] as const

  const ALERTS = [
    {
      id: 'a1',
      type: 'pending_emails',
      title: 'Emails en attente',
      message: '3 emails nécessitent une réponse.',
      priority: 'critical',
      read: false,
      action_data: { command: 'Traite les emails en attente', executable: true },
    },
    {
      id: 'a2',
      type: 'upcoming_event',
      title: 'Événement à venir',
      message: 'Rendez-vous dans 30 minutes.',
      priority: 'medium',
      read: true,
      action_data: { path: '/agenda' },
    },
    {
      id: 'a3',
      type: 'unpaid_invoices',
      title: 'Factures impayées',
      message: '1 facture est en retard.',
      priority: 'high',
      read: false,
      action_data: null,
    },
  ] as const

  return {
    SUGGESTIONS,
    ALERTS,
    feedbackSubmit: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    dismissSuggestion: vi.fn(),
    dismissAlert: vi.fn(),
    markAsRead: vi.fn(),
    navigateMock: vi.fn(),
    onAskJarvisMock: vi.fn(),
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react')
  const passthrough = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactMod.createElement('div', props, children)

  return {
    motion: new Proxy(
      {},
      {
        get: () => passthrough,
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => ReactMod.createElement(ReactMod.Fragment, null, children),
  }
})

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react')
  const Icon = ({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) =>
    ReactMod.createElement('span', { 'data-icon': ariaLabel ?? 'icon' })
  return {
    Lightbulb: Icon,
    AlertTriangle: Icon,
    Bell: Icon,
    TrendingUp: Icon,
    X: Icon,
    ChevronRight: Icon,
    Zap: Icon,
    Play: Icon,
    Flame: Icon,
    Target: Icon,
    Mail: Icon,
    Calendar: Icon,
  }
})

vi.mock('@/components/ui/button', async () => {
  const ReactMod = await import('react')
  return {
    Button: ({
      children,
      onClick,
      disabled,
      type,
      ...props
    }: React.PropsWithChildren<{
      onClick?: React.MouseEventHandler<HTMLButtonElement>
      disabled?: boolean
      type?: 'button' | 'submit' | 'reset'
    }>) =>
      ReactMod.createElement(
        'button',
        { onClick, disabled, type: type ?? 'button', ...props },
        children
      ),
  }
})

vi.mock('@/components/ui/badge', async () => {
  const ReactMod = await import('react')
  return {
    Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactMod.createElement('span', props, children),
  }
})

vi.mock('@/components/ui/scroll-area', async () => {
  const ReactMod = await import('react')
  return {
    ScrollArea: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactMod.createElement('div', props, children),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
}))

type JarvisProactiveState = {
  suggestions: readonly typeof SUGGESTIONS[number][]
  dismissSuggestion: (id: string) => void
  isAnalyzing: boolean
  hasSuggestions: boolean
}
type JarvisAlertsState = {
  alerts: readonly typeof ALERTS[number][]
  unreadCount: number
  dismissAlert: (id: string) => void
  markAsRead: (id: string) => void
}

const jarvisState = vi.hoisted(() => {
  const proactive: JarvisProactiveState = {
    suggestions: [],
    dismissSuggestion,
    isAnalyzing: false,
    hasSuggestions: false,
  }
  const alerts: JarvisAlertsState = {
    alerts: [],
    unreadCount: 0,
    dismissAlert,
    markAsRead,
  }
  return { proactive, alerts }
})

vi.mock('@/hooks/jarvis/useJarvisFeedback', () => ({
  useJarvisFeedback: () => ({
    submitSuggestionFeedback: feedbackSubmit,
  }),
}))

vi.mock('@/hooks/jarvis/useJarvisProactive', () => ({
  useJarvisProactive: () => jarvisState.proactive,
}))

vi.mock('@/hooks/jarvis/useJarvisProactiveAlerts', () => ({
  useJarvisProactiveAlerts: () => jarvisState.alerts,
}))

import { JarvisProactiveSuggestions } from './JarvisProactiveSuggestions'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  cleanup()
  feedbackSubmit.mockClear()
  dismissSuggestion.mockClear()
  dismissAlert.mockClear()
  markAsRead.mockClear()
  navigateMock.mockClear()
  onAskJarvisMock.mockClear()
  jarvisState.proactive.suggestions = []
  jarvisState.proactive.isAnalyzing = false
  jarvisState.proactive.hasSuggestions = false
  jarvisState.alerts.alerts = []
  jarvisState.alerts.unreadCount = 0
})

describe('JarvisProactiveSuggestions', () => {
  it('affiche l’état de chargement quand isAnalyzing=true et aucun item', () => {
    jarvisState.proactive.suggestions = []
    jarvisState.proactive.isAnalyzing = true
    jarvisState.proactive.hasSuggestions = false
    jarvisState.alerts.alerts = []
    jarvisState.alerts.unreadCount = 0

    const Wrapper = createWrapper()
    render(
      <JarvisProactiveSuggestions onAskJarvis={onAskJarvisMock} maxSuggestions={5} compact={false} showAlerts={true} />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Analyse du contexte...')).toBeTruthy()
    expect(screen.getByText('Suggestions proactives')).toBeTruthy()
  })

  it('rendu succès: combine alertes + suggestions, badge unread et show more', async () => {
    jarvisState.proactive.suggestions = SUGGESTIONS
    jarvisState.proactive.isAnalyzing = false
    jarvisState.proactive.hasSuggestions = true
    jarvisState.alerts.alerts = ALERTS
    jarvisState.alerts.unreadCount = 2

    const Wrapper = createWrapper()
    render(
      <JarvisProactiveSuggestions onAskJarvis={onAskJarvisMock} maxSuggestions={2} compact={false} showAlerts={true} />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Suggestions proactives')).toBeTruthy()
    expect(screen.getByText('2 nouveaux')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()

    expect(screen.getByText('Emails en attente')).toBeTruthy()
    expect(screen.getByText('Événement à venir')).toBeTruthy()

    expect(screen.getByText('+5 autres')).toBeTruthy()

    fireEvent.click(screen.getByText('Voir'))
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/agenda')

    const alertContainer = screen.getByText('Emails en attente').closest('div')
    if (!alertContainer) throw new Error('alert container not found')
    fireEvent.click(alertContainer)
    expect(markAsRead).toHaveBeenCalledTimes(1)
    expect(markAsRead).toHaveBeenCalledWith('a1')
  })

  it('exécute une alerte: envoie feedback exécuté, appelle onAskJarvis, puis dismissAlert', async () => {
    jarvisState.proactive.suggestions = []
    jarvisState.proactive.isAnalyzing = false
    jarvisState.proactive.hasSuggestions = false
    jarvisState.alerts.alerts = [ALERTS[0]]
    jarvisState.alerts.unreadCount = 1

    const Wrapper = createWrapper()
    render(
      <JarvisProactiveSuggestions onAskJarvis={onAskJarvisMock} maxSuggestions={5} compact={true} showAlerts={true} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByText('Exécuter'))

    await waitFor(() => {
      expect(feedbackSubmit).toHaveBeenCalledTimes(1)
    })

    expect(feedbackSubmit).toHaveBeenCalledWith(
      'pending_emails',
      'a1',
      'executed',
      { command: 'Traite les emails en attente' }
    )
    expect(onAskJarvisMock).toHaveBeenCalledTimes(1)
    expect(onAskJarvisMock).toHaveBeenCalledWith('Traite les emails en attente')
    expect(dismissAlert).toHaveBeenCalledTimes(1)
    expect(dismissAlert).toHaveBeenCalledWith('a1')
  })

  it('dismiss suggestion: envoie feedback dismissed puis dismissSuggestion', async () => {
    jarvisState.proactive.suggestions = [SUGGESTIONS[0]]
    jarvisState.proactive.isAnalyzing = false
    jarvisState.proactive.hasSuggestions = true
    jarvisState.alerts.alerts = []
    jarvisState.alerts.unreadCount = 0

    const Wrapper = createWrapper()
    render(
      <JarvisProactiveSuggestions onAskJarvis={onAskJarvisMock} maxSuggestions={5} compact={true} showAlerts={true} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByLabelText('Ignorer cette suggestion'))

    await waitFor(() => {
      expect(feedbackSubmit).toHaveBeenCalledTimes(1)
    })

    expect(feedbackSubmit).toHaveBeenCalledWith('tip', 's1', 'dismissed', undefined)
    expect(dismissSuggestion).toHaveBeenCalledTimes(1)
    expect(dismissSuggestion).toHaveBeenCalledWith('s1')
  })

  it('cas erreur (hook alerte): quand le hook jette, le rendu lève une erreur', async () => {
    const original = jarvisState.alerts
    const throwingAlerts = vi.hoisted(() => ({
      get alerts() {
        throw new Error('x')
      },
    }))

    jarvisState.proactive.suggestions = [SUGGESTIONS[0]]
    jarvisState.proactive.isAnalyzing = false
    jarvisState.proactive.hasSuggestions = true
    jarvisState.alerts = throwingAlerts as unknown as JarvisAlertsState

    const Wrapper = createWrapper()

    expect(() => {
      render(
        <JarvisProactiveSuggestions onAskJarvis={onAskJarvisMock} maxSuggestions={5} compact={true} showAlerts={true} />,
        { wrapper: Wrapper }
      )
    }).toThrowError('x')

    jarvisState.alerts = original
  })
})