import React from 'react'
import { render, screen } from '@testing-library/react'

const {
  mockUseCustomerActivities,
  mockActivities,
  supabaseMocks,
  authMocks,
  routerMocks,
  sonnerMocks
} = vi.hoisted(() => {
  const stableActivities = [
    {
      id: 'a1',
      activity_type: 'meeting',
      title: 'Réunion de kick-off',
      activity_date: '2024-01-01T10:00:00.000Z',
      description: 'Réunion initiale avec le client',
      metadata: { responsable: 'Alice', duree: '60min' }
    },
    {
      id: 'a2',
      activity_type: 'email',
      title: 'Email de suivi',
      activity_date: '2024-01-02T12:00:00.000Z',
      description: null,
      metadata: {}
    },
    {
      id: 'a3',
      activity_type: 'note',
      title: 'Note interne',
      activity_date: '2024-01-03T09:00:00.000Z',
      description: 'Note générée automatiquement',
      metadata: { generated: true, interne: 'oui' }
    }
  ]

  const mockHook = vi.fn()

  const chain: Record<string, unknown> = {}
  const chainImpl = {
    select: vi.fn(() => chainImpl),
    eq: vi.fn(() => chainImpl),
    gte: vi.fn(() => chainImpl),
    lte: vi.fn(() => chainImpl),
    in: vi.fn(() => chainImpl),
    order: vi.fn(() => chainImpl),
    limit: vi.fn(() => chainImpl),
    insert: vi.fn(() => chainImpl),
    update: vi.fn(() => chainImpl),
    delete: vi.fn(() => chainImpl),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn(),
    catch: vi.fn()
  }
  Object.assign(chain, chainImpl)
  const from = vi.fn(() => chainImpl)

  const user = { id: 'u1', email: 'test@example.com' }
  const session = { user: { id: 'u1' } }
  const nav = vi.fn()

  const toastSuccess = vi.fn()
  const toastError = vi.fn()

  return {
    mockUseCustomerActivities: mockHook,
    mockActivities: stableActivities,
    supabaseMocks: { from, chain: chainImpl },
    authMocks: { user, session },
    routerMocks: { nav },
    sonnerMocks: { toastSuccess, toastError }
  }
})

vi.mock('@/components/ui/card', () => {
  const Card = ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>
  const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  )
  const CardHeader = ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>
  const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  )
  return { Card, CardContent, CardHeader, CardTitle }
})

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>
  return { Badge }
})

vi.mock('@/components/ui/button', () => {
  const Button = ({ children, size }: { children: React.ReactNode; size?: string }) => (
    <button data-testid="button" data-size={size}>
      {children}
    </button>
  )
  return { Button }
})

vi.mock('lucide-react', () => {
  const Icon = (props: React.HTMLAttributes<SVGElement>) => <svg {...props} />
  return {
    Calendar: Icon,
    Plus: Icon,
    Loader2: (props: React.HTMLAttributes<SVGElement>) => <svg data-testid="loader" {...props} />
  }
})

vi.mock('@/hooks/crm/useCustomerActivities', () => ({
  useCustomerActivities: (...args: unknown[]) => mockUseCustomerActivities(...args)
}))

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns')
  return {
    ...actual,
    formatDistanceToNow: (date: Date | number) => {
      const d = date instanceof Date ? date : new Date(date)
      return `mock-distance-${d.toISOString()}`
    }
  }
})

vi.mock('date-fns/locale', () => ({
  fr: {}
}))

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: supabaseMocks.from
    }
  }
})

vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => ({
      user: authMocks.user,
      session: authMocks.session,
      isLoading: false
    })
  }
})

vi.mock('react-router-dom', () => {
  return {
    useNavigate: () => routerMocks.nav
  }
})

vi.mock('sonner', () => {
  return {
    toast: {
      success: sonnerMocks.toastSuccess,
      error: sonnerMocks.toastError
    }
  }
})

import { CustomerActivitiesTimeline } from './CustomerActivitiesTimeline'

describe('CustomerActivitiesTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le loader pendant le chargement', () => {
    mockUseCustomerActivities.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null
    })

    render(<CustomerActivitiesTimeline etablissementId="e1" />)

    expect(screen.getByTestId('loader')).toBeInTheDocument()
    expect(screen.queryByText('Historique client')).not.toBeInTheDocument()
  })

  it('affiche un message quand il n’y a aucune activité', () => {
    mockUseCustomerActivities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null
    })

    render(<CustomerActivitiesTimeline etablissementId="e1" />)

    expect(screen.getByText('Historique client')).toBeInTheDocument()
    expect(screen.getByText('Aucune activité enregistrée')).toBeInTheDocument()
    expect(screen.getByTestId('button')).toHaveTextContent('Ajouter activité')
  })

  it('affiche la liste des activités avec les informations métier clés', () => {
    mockUseCustomerActivities.mockReturnValue({
      data: mockActivities,
      isLoading: false,
      isError: false,
      error: null
    })

    render(<CustomerActivitiesTimeline etablissementId="e1" />)

    expect(screen.getByText('Historique client')).toBeInTheDocument()

    expect(screen.getByText('Réunion de kick-off')).toBeInTheDocument()
    expect(screen.getByText('Email de suivi')).toBeInTheDocument()
    expect(screen.getByText('Note interne')).toBeInTheDocument()

    expect(screen.getByText('Réunion')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()

    const distanceNodes = screen.getAllByText((content, element) =>
      element?.tagName.toLowerCase() === 'div' && content.startsWith('mock-distance-')
    )
    expect(distanceNodes.length).toBeGreaterThan(0)

    expect(screen.getByText('Réunion de kick-off').parentElement?.parentElement?.parentElement).toHaveTextContent('Réunion')
    expect(screen.getByText('Réunion de kick-off').parentElement?.parentElement?.parentElement).toHaveTextContent('Réunion de kick-off')

    expect(screen.getByText('Réunion de kick-off').closest('div')?.parentElement?.parentElement).toHaveTextContent('Réunion de kick-off')
    expect(screen.getByText('Réunion de kick-off').closest('div')?.parentElement?.parentElement).toHaveTextContent('Réunion')

    expect(screen.getByText('responsable:').parentElement).toHaveTextContent('responsable: Alice')
    expect(screen.getByText('duree:').parentElement).toHaveTextContent('duree: 60min')

    expect(screen.queryByText('interne:')).not.toBeInTheDocument()
  })
})