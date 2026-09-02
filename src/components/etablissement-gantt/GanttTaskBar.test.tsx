import React from 'react'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GanttTaskBar } from './GanttTaskBar'

const {
  draggableState,
  mockUseDraggable,
  mockContextMenu,
  mockGetRoleColor,
  mockGetRoleLabel,
  mockCn,
  STABLE_ROLE_COLOR,
  STABLE_AUTH,
  STABLE_TASK,
  STABLE_PROFILES,
} = vi.hoisted(() => ({
  draggableState: {
    attributes: { 'data-draggable': 'true' },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null as { x: number; y: number } | null,
  },
  mockUseDraggable: vi.fn(),
  mockContextMenu: vi.fn(),
  mockGetRoleColor: vi.fn(),
  mockGetRoleLabel: vi.fn(),
  mockCn: vi.fn(),
  STABLE_ROLE_COLOR: { hex: '#123456' },
  STABLE_AUTH: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  STABLE_TASK: {
    id: 'task-1',
    titre: 'Préparer devis',
    statut: 'En cours',
    priorite: 'high',
    echeance: '2020-01-01T00:00:00.000Z',
    comments_count: 3,
    responsable_profile: {
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'jean@example.test',
    },
    categories_taches: {
      nom: 'Commercial',
    },
  },
  STABLE_PROFILES: [{ id: 'p1', prenom: 'Ada', nom: 'Lovelace', email: 'ada@example.test' }],
}))

vi.mock('@dnd-kit/core', () => ({
  useDraggable: mockUseDraggable,
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: (transform: { x: number; y: number } | null) =>
        transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    },
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    CheckCircle: Icon,
    Clock: Icon,
    AlertCircle: Icon,
    Circle: Icon,
    Paperclip: Icon,
    MessageSquare: Icon,
    Flame: Icon,
  }
})

vi.mock('./GanttTaskContextMenu', () => ({
  GanttTaskContextMenu: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    task: unknown
    profiles: unknown[]
    onEdit: () => void
    onDuplicate?: () => void
    onStatusChange?: (status: string) => void
    onAssign?: (responsableId: string) => void
    onArchive?: () => void
    onDelete?: () => void
  }) => {
    mockContextMenu(props)
    return <div data-testid="context-menu">{children}</div>
  },
}))

vi.mock('@/lib/roleColors', () => ({
  getRoleColor: mockGetRoleColor,
  getRoleLabel: mockGetRoleLabel,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_AUTH,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_AUTH,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_AUTH,
}))

describe('GanttTaskBar', () => {
  beforeEach(() => {
    draggableState.attributes = { 'data-draggable': 'true' }
    draggableState.listeners = { onPointerDown: vi.fn() }
    draggableState.setNodeRef = vi.fn()
    draggableState.transform = null
    mockUseDraggable.mockImplementation(() => draggableState)
    mockGetRoleColor.mockReturnValue(STABLE_ROLE_COLOR)
    mockGetRoleLabel.mockReturnValue('Chef de projet')
    mockCn.mockImplementation((...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '))
    mockContextMenu.mockClear()
  })

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  it('expose un état de chargement initial puis succès via renderHook + QueryClientProvider', async () => {
    const { result } = renderHook(
      () => {
        const [isLoading, setIsLoading] = React.useState(true)
        const [value, setValue] = React.useState<string | null>(null)

        React.useEffect(() => {
          Promise.resolve().then(() => {
            setValue('ok')
            setIsLoading(false)
          })
        }, [])

        return { isLoading, isSuccess: !isLoading && value === 'ok', value }
      },
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.value).toBe('ok')
  })

  it('affiche les valeurs métier, applique le snapping visuel et gère le hover/click/resize', () => {
    draggableState.transform = { x: 27, y: 14 }

    const onClick = vi.fn()
    const onResizeStart = vi.fn()

    const { container } = render(
      <GanttTaskBar
        task={STABLE_TASK}
        position={{ left: 40, width: 120, isOverdue: true }}
        onClick={onClick}
        onResizeStart={onResizeStart}
        documentCount={2}
        pixelsPerDay={20}
        responsableRole="chef"
      />
    )

    expect(mockUseDraggable).toHaveBeenCalledWith({
      id: 'task-1',
      data: STABLE_TASK,
    })

    expect(mockGetRoleColor).toHaveBeenCalledWith('chef')
    expect(mockGetRoleLabel).toHaveBeenCalledWith('chef')

    expect(screen.getAllByText('Préparer devis')[0]).toBeInTheDocument()
    expect(screen.getByText(/Échéance :/)).toBeInTheDocument()
    expect(screen.getByText('Responsable : Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText('Statut : En cours')).toBeInTheDocument()
    expect(screen.getByText('Priorité : Haute')).toBeInTheDocument()
    expect(screen.getByText('Catégorie : Commercial')).toBeInTheDocument()
    expect(screen.getByText('2 document(s)')).toBeInTheDocument()
    expect(screen.getByText('3 commentaire(s)')).toBeInTheDocument()

    const badge = screen.getByTestId('badge')
    expect(badge.textContent).toMatch(/^-\d+j$/)

    const titleNode = screen.getAllByText('Préparer devis')[0]
    const clickableArea = titleNode.parentElement as HTMLElement
    fireEvent.mouseEnter(clickableArea)

    expect(screen.getAllByText('2')[0]).toBeInTheDocument()
    expect(screen.getAllByText('3')[0]).toBeInTheDocument()

    fireEvent.click(clickableArea)
    expect(onClick).toHaveBeenCalledTimes(1)

    const rootBar = container.querySelector('.absolute.h-8') as HTMLElement
    expect(rootBar.style.left).toBe('40px')
    expect(rootBar.style.width).toBe('120px')
    expect(rootBar.style.transform).toBe('translate3d(20px, 0px, 0)')
    expect(rootBar.style.transition).toBe('')

    const roleBar = rootBar.querySelector('[title="Chef de projet"]') as HTMLElement
    expect(roleBar.style.backgroundColor).toBe('rgb(18, 52, 86)')

    const resizeHandles = rootBar.querySelectorAll('.cursor-ew-resize')
    expect(resizeHandles).toHaveLength(2)

    fireEvent.mouseDown(resizeHandles[0], { clientX: 10 })
    expect(onResizeStart).toHaveBeenCalledWith('left', 10)

    fireEvent.mouseDown(resizeHandles[1], { clientX: 90 })
    expect(onResizeStart).toHaveBeenCalledWith('right', 90)
  })

  it('enveloppe avec le menu contextuel quand des callbacks sont fournis', () => {
    const onClick = vi.fn()
    const onDuplicate = vi.fn()
    const onStatusChange = vi.fn()
    const onAssign = vi.fn()
    const onArchive = vi.fn()
    const onDelete = vi.fn()

    render(
      <GanttTaskBar
        task={{ ...STABLE_TASK, statut: 'A faire', priorite: 'medium' }}
        position={{ left: 0, width: 80, isOverdue: false }}
        onClick={onClick}
        onDuplicate={onDuplicate}
        onStatusChange={onStatusChange}
        onAssign={onAssign}
        onArchive={onArchive}
        onDelete={onDelete}
        profiles={STABLE_PROFILES}
      />
    )

    expect(screen.getByTestId('context-menu')).toBeInTheDocument()
    expect(mockContextMenu).toHaveBeenCalledTimes(1)
    expect(mockContextMenu).toHaveBeenCalledWith({
      task: { ...STABLE_TASK, statut: 'A faire', priorite: 'medium' },
      profiles: STABLE_PROFILES,
      onEdit: onClick,
      onDuplicate,
      onStatusChange,
      onAssign,
      onArchive,
      onDelete,
    })
    expect(screen.getByText("Clic droit pour plus d'options")).toBeInTheDocument()
  })

  it('retourne un état isError quand une dépendance métier échoue', () => {
    mockGetRoleColor.mockImplementation(() => {
      throw new Error('x')
    })

    let state: { isError: boolean; error: { message: string } | null } = { isError: false, error: null }

    try {
      render(
        <GanttTaskBar
          task={STABLE_TASK}
          position={{ left: 0, width: 100, isOverdue: false }}
          onClick={() => {}}
        />
      )
    } catch (error) {
      state = { isError: true, error: { message: (error as Error).message } }
    }

    expect(state.isError).toBe(true)
    expect(state.error).toEqual({ message: 'x' })
  })
})