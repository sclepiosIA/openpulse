/* @vitest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { DeploymentTimelineView } from './DeploymentTimelineView'

const {
  AUTH_STATE,
  navigateMock,
  healthIndicatorMock,
  SUPABASE_ROWS,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  navigateMock: vi.fn(),
  healthIndicatorMock: vi.fn(),
  SUPABASE_ROWS: [{ id: '1' }],
  mockFrom: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    onClick,
    onKeyDown,
    className,
    role,
    tabIndex,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
    className?: string
    role?: string
    tabIndex?: number
    'aria-label'?: string
  }) => (
    <div
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      className={className}
      onClick={onClick}
      onKeyDown={onKeyDown}
      data-testid="card"
    >
      {children}
    </div>
  ),
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => <span className={className}>{children}</span>,
}))

vi.mock('./DeploymentHealthIndicator', () => ({
  DeploymentHealthIndicator: (props: {
    status: string
    score: number
    reasons: string[]
    size: string
  }) => {
    healthIndicatorMock(props)
    return (
      <div data-testid="health-indicator">
        {props.status}-{props.score}-{props.size}
      </div>
    )
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: SUPABASE_ROWS[0], error: null })),
      maybeSingle: vi.fn(async () => ({ data: SUPABASE_ROWS[0], error: null })),
      then: (onFulfilled?: (value: { data: typeof SUPABASE_ROWS; error: null }) => unknown) =>
        Promise.resolve({ data: SUPABASE_ROWS, error: null }).then(onFulfilled),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: SUPABASE_ROWS, error: null }).catch(onRejected),
    }
    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('DeploymentTimelineView', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    healthIndicatorMock.mockClear()
  })

  it('rend toutes les phases avec les compteurs exacts et les messages vides', () => {
    const etablissements = [
      {
        id: 'e1',
        nom: 'Clinique A',
        statut: 'Contractuel',
        type: 'Clinique',
        ville: 'Paris',
        progression: 49.6,
      },
      {
        id: 'e2',
        nom: 'Hopital B',
        statut: 'Déploiement',
        type: 'Hopital',
        ville: 'Lyon',
        progression: 100,
      },
      {
        id: 'e3',
        nom: 'Cabinet C',
        statut: 'Déploiement',
        type: 'Cabinet',
        ville: 'Lille',
        progression: 12.2,
      },
    ]

    const healthScores = new Map([
      ['e1', { status: 'good', score: 91, reasons: ['stable'] }],
      ['e2', { status: 'warning', score: 63, reasons: ['late'] }],
    ])

    render(
      <DeploymentTimelineView
        etablissements={etablissements}
        healthScores={healthScores}
      />
    )

    expect(screen.getByText('Contractuel')).toBeInTheDocument()
    expect(screen.getByText('Conformité')).toBeInTheDocument()
    expect(screen.getByText('Déploiement')).toBeInTheDocument()
    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getByText('Go-Live')).toBeInTheDocument()

    expect(screen.getByText('1 établissement')).toBeInTheDocument()
    expect(screen.getByText('2 établissements')).toBeInTheDocument()
    expect(screen.getAllByText('0 établissement').length).toBe(3)

    expect(screen.getAllByText('Aucun établissement dans cette phase').length).toBe(3)

    expect(screen.getByText('Clinique A')).toBeInTheDocument()
    expect(screen.getByText('Hopital B')).toBeInTheDocument()
    expect(screen.getByText('Cabinet C')).toBeInTheDocument()

    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()

    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    expect(screen.getByText('Lille')).toBeInTheDocument()

    expect(screen.getAllByTestId('health-indicator').length).toBe(2)
    expect(healthIndicatorMock).toHaveBeenCalledWith({
      status: 'good',
      score: 91,
      reasons: ['stable'],
      size: 'sm',
    })
    expect(healthIndicatorMock).toHaveBeenCalledWith({
      status: 'warning',
      score: 63,
      reasons: ['late'],
      size: 'sm',
    })
  })

  it('navigue au clic et au clavier vers la fiche établissement', () => {
    const etablissements = [
      {
        id: 'e42',
        nom: 'Centre Delta',
        statut: 'Formation',
        type: 'Centre',
        ville: 'Nantes',
        progression: 75,
      },
    ]

    render(
      <DeploymentTimelineView
        etablissements={etablissements}
        healthScores={new Map()}
      />
    )

    const linkCard = screen.getByRole('link', {
      name: "Voir le détail de l'établissement Centre Delta",
    })

    fireEvent.click(linkCard)
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/e42')

    fireEvent.keyDown(linkCard, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/e42')

    fireEvent.keyDown(linkCard, { key: ' ' })
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/e42')

    expect(navigateMock).toHaveBeenCalledTimes(3)
  })

  it('applique la couleur de bordure attendue selon le statut', () => {
    const etablissements = [
      {
        id: 'c1',
        nom: 'A',
        statut: 'Contractuel',
        type: 'T1',
        ville: 'V1',
        progression: 10,
      },
      {
        id: 'c2',
        nom: 'B',
        statut: 'Conformité',
        type: 'T2',
        ville: 'V2',
        progression: 20,
      },
      {
        id: 'c3',
        nom: 'C',
        statut: 'Déploiement',
        type: 'T3',
        ville: 'V3',
        progression: 30,
      },
      {
        id: 'c4',
        nom: 'D',
        statut: 'Formation',
        type: 'T4',
        ville: 'V4',
        progression: 40,
      },
      {
        id: 'c5',
        nom: 'E',
        statut: 'Go-Live',
        type: 'T5',
        ville: 'V5',
        progression: 50,
      },
    ]

    render(
      <DeploymentTimelineView
        etablissements={etablissements}
        healthScores={new Map()}
      />
    )

    expect(
      screen
        .getByRole('link', { name: "Voir le détail de l'établissement A" })
        .className
    ).toContain('border-l-blue-500')
    expect(
      screen
        .getByRole('link', { name: "Voir le détail de l'établissement B" })
        .className
    ).toContain('border-l-yellow-500')
    expect(
      screen
        .getByRole('link', { name: "Voir le détail de l'établissement C" })
        .className
    ).toContain('border-l-purple-500')
    expect(
      screen
        .getByRole('link', { name: "Voir le détail de l'établissement D" })
        .className
    ).toContain('border-l-green-500')
    expect(
      screen
        .getByRole('link', { name: "Voir le détail de l'établissement E" })
        .className
    ).toContain('border-l-emerald-500')
  })

  it('supporte un cycle hook loading -> success -> error avec QueryClientProvider', async () => {
    const wrapper = createWrapper()

    const loadingHook = renderHook(
      ({ mode }: { mode: 'loading' | 'success' | 'error' }) => {
        if (mode === 'loading') {
          return { isLoading: true, isError: false, data: null, error: null }
        }
        if (mode === 'error') {
          return {
            isLoading: false,
            isError: true,
            data: null,
            error: { message: 'x' },
          }
        }
        return {
          isLoading: false,
          isError: false,
          data: {
            phases: ['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live'],
            total: 5,
          },
          error: null,
        }
      },
      {
        initialProps: { mode: 'loading' as const },
        wrapper,
      }
    )

    expect(loadingHook.result.current.isLoading).toBe(true)
    expect(loadingHook.result.current.data).toBeNull()

    loadingHook.rerender({ mode: 'success' })
    expect(loadingHook.result.current.isLoading).toBe(false)
    expect(loadingHook.result.current.isError).toBe(false)
    expect(loadingHook.result.current.data).toEqual({
      phases: ['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live'],
      total: 5,
    })

    loadingHook.rerender({ mode: 'error' })
    expect(loadingHook.result.current.isError).toBe(true)
    expect(loadingHook.result.current.error).toEqual({ message: 'x' })
  })

  it('affiche les données métier exactes dans la carte de phase concernée', () => {
    const etablissements = [
      {
        id: 'm1',
        nom: 'Maison Nord',
        statut: 'Go-Live',
        type: 'Maison',
        ville: 'Rouen',
        progression: 88.4,
      },
      {
        id: 'm2',
        nom: 'Maison Sud',
        statut: 'Go-Live',
        type: 'Maison',
        ville: 'Nice',
        progression: 7.8,
      },
    ]

    render(
      <DeploymentTimelineView
        etablissements={etablissements}
        healthScores={new Map([['m1', { status: 'good', score: 97, reasons: ['ok'] }]])}
      />
    )

    const goLiveHeader = screen.getByText('Go-Live')
    const phaseContainer = goLiveHeader.closest('div')
    expect(phaseContainer).not.toBeNull()

    const firstCard = screen.getByRole('link', {
      name: "Voir le détail de l'établissement Maison Nord",
    })
    const secondCard = screen.getByRole('link', {
      name: "Voir le détail de l'établissement Maison Sud",
    })

    expect(within(firstCard).getByText('Maison')).toBeInTheDocument()
    expect(within(firstCard).getByText('Rouen')).toBeInTheDocument()
    expect(within(firstCard).getByText('88%')).toBeInTheDocument()
    expect(within(secondCard).getByText('Nice')).toBeInTheDocument()
    expect(within(secondCard).getByText('8%')).toBeInTheDocument()
  })
})