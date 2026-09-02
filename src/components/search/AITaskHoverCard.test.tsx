/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AITaskHoverCard } from './AITaskHoverCard'

const {
  TASK_ROW,
  ETAB_ROW,
  PROFILE_ROW,
  NULL_ROW,
  CHILD_TEXT,
  mockFrom,
  hoverCardContentProps,
  badgeProps,
  userAvatarProps,
} = vi.hoisted(() => ({
  TASK_ROW: {
    id: 'task-1',
    titre: 'Préparer le dossier',
    description: 'Vérifier les pièces et compléter le dossier',
    statut: 'En cours',
    priorite: 'high',
    echeance: '2099-12-31T12:00:00.000Z',
    etablissement_id: 'etab-1',
    responsable_id: 'user-1',
  },
  ETAB_ROW: {
    id: 'etab-1',
    nom: 'Clinique du Centre',
  },
  PROFILE_ROW: {
    id: 'user-1',
    nom: 'Dupont',
    prenom: 'Marie',
    avatar_url: 'avatar.png',
  },
  NULL_ROW: null,
  CHILD_TEXT: 'ouvrir la tâche',
  mockFrom: vi.fn(),
  hoverCardContentProps: vi.fn(),
  badgeProps: vi.fn(),
  userAvatarProps: vi.fn(),
}))

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode; openDelay?: number }) => (
    <div data-testid="hover-card">{children}</div>
  ),
  HoverCardTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div data-testid={asChild ? 'hover-trigger-child' : 'hover-trigger'}>{children}</div>,
  HoverCardContent: ({
    children,
    className,
    side,
    align,
  }: {
    children: React.ReactNode
    className?: string
    side?: string
    align?: string
  }) => {
    hoverCardContentProps({ className, side, align })
    return <div data-testid="hover-content">{children}</div>
  },
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => {
    badgeProps({ variant, className, text: String(children) })
    return <span data-testid="badge">{children}</span>
  },
}))

vi.mock('lucide-react', () => ({
  CheckSquare: (props: Record<string, unknown>) => <svg data-testid="icon-checksquare" {...props} />,
  Building2: (props: Record<string, unknown>) => <svg data-testid="icon-building2" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alerttriangle" {...props} />,
  Clock: (props: Record<string, unknown>) => <svg data-testid="icon-clock" {...props} />,
}))

vi.mock('@/components/ui/UserAvatar', () => ({
  UserAvatar: (props: {
    avatarUrl?: string
    email: string
    name: string
    size?: string
  }) => {
    userAvatarProps(props)
    return <div data-testid="user-avatar">{props.name}</div>
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type QueryResult = { data: unknown; error: { message: string } | null }

function createBuilder(resolvers: Record<string, () => Promise<QueryResult> | QueryResult>) {
  let currentTable = ''
  const builder = {
    select: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation(() => builder),
    gte: vi.fn().mockImplementation(() => builder),
    lte: vi.fn().mockImplementation(() => builder),
    in: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => builder),
    limit: vi.fn().mockImplementation(() => builder),
    insert: vi.fn().mockImplementation(() => builder),
    update: vi.fn().mockImplementation(() => builder),
    delete: vi.fn().mockImplementation(() => builder),
    single: vi.fn().mockImplementation(async () => {
      const resolver = resolvers[currentTable]
      return resolver ? await resolver() : { data: null, error: null }
    }),
    maybeSingle: vi.fn().mockImplementation(async () => {
      const resolver = resolvers[currentTable]
      return resolver ? await resolver() : { data: null, error: null }
    }),
    then: vi.fn().mockImplementation((resolve: (value: QueryResult) => unknown) => {
      const resolver = resolvers[currentTable]
      return Promise.resolve(resolver ? resolver() : { data: null, error: null }).then((value) => resolve(value))
    }),
    catch: vi.fn().mockImplementation((reject: (reason: unknown) => unknown) => {
      const resolver = resolvers[currentTable]
      return Promise.resolve(resolver ? resolver() : { data: null, error: null }).catch(reject)
    }),
    __setTable(table: string) {
      currentTable = table
      return builder
    },
  }
  return builder
}

function setupSupabase(resolvers: Record<string, () => Promise<QueryResult> | QueryResult>) {
  const builder = createBuilder(resolvers)
  mockFrom.mockImplementation((table: string) => builder.__setTable(table))
  return builder
}

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

describe('AITaskHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche les children pendant le chargement puis rend les informations métier de la tâche', async () => {
    let resolveTask: ((value: QueryResult) => void) | undefined
    const delayedTask = new Promise<QueryResult>((resolve) => {
      resolveTask = resolve
    })

    setupSupabase({
      taches: () => delayedTask,
      etablissements: () => ({ data: ETAB_ROW, error: null }),
      profiles: () => ({ data: PROFILE_ROW, error: null }),
    })

    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <AITaskHoverCard taskId="task-1">
          <button>{CHILD_TEXT}</button>
        </AITaskHoverCard>
      </Wrapper>,
    )

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument()

    resolveTask?.({ data: TASK_ROW, error: null })

    await waitFor(() => {
      expect(screen.getByTestId('hover-content')).toBeInTheDocument()
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mockFrom).toHaveBeenCalledWith('profiles')

    expect(screen.getByText('Préparer le dossier')).toBeInTheDocument()
    expect(screen.getAllByText('En cours')).toHaveLength(1)
    expect(screen.getAllByText('Haute')).toHaveLength(1)
    expect(screen.getByText('Assigné à')).toBeInTheDocument()
    expect(screen.getAllByText('Marie Dupont')).toHaveLength(2)
    expect(screen.getByText('Établissement:')).toBeInTheDocument()
    expect(screen.getByText('Clinique du Centre')).toBeInTheDocument()
    expect(screen.getByText('Vérifier les pièces et compléter le dossier')).toBeInTheDocument()

    expect(hoverCardContentProps).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'w-80',
        side: 'right',
        align: 'start',
      }),
    )

    expect(badgeProps).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'secondary',
        text: 'En cours',
      }),
    )
    expect(badgeProps).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'secondary',
        text: 'Haute',
      }),
    )

    expect(userAvatarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: 'avatar.png',
        email: '',
        name: 'Marie Dupont',
        size: 'xs',
      }),
    )
  })

  it('ne rend pas la hover card quand aucune tâche n’est trouvée', async () => {
    setupSupabase({
      taches: () => ({ data: NULL_ROW, error: null }),
      etablissements: () => ({ data: NULL_ROW, error: null }),
      profiles: () => ({ data: NULL_ROW, error: null }),
    })

    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <AITaskHoverCard taskId="missing-task">
          <span>{CHILD_TEXT}</span>
        </AITaskHoverCard>
      </Wrapper>,
    )

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches')
    })

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(screen.queryByTestId('hover-content')).not.toBeInTheDocument()
    expect(mockFrom).not.toHaveBeenCalledWith('etablissements')
    expect(mockFrom).not.toHaveBeenCalledWith('profiles')
  })

  it('met le hook React Query en erreur quand la requête retourne une erreur', async () => {
    setupSupabase({
      taches: () => ({ data: null, error: { message: 'x' } }),
    })

    const Wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['task-hover', 'task-err'],
          queryFn: async () => {
            const { data, error } = await (await import('@/integrations/supabase/client')).supabase
              .from('taches')
              .select('id')
              .eq('id', 'task-err')
              .maybeSingle()

            if (error) {
              throw new Error(error.message)
            }

            return data
          },
          retry: 0,
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('x')
    expect(mockFrom).toHaveBeenCalledWith('taches')
  })
})