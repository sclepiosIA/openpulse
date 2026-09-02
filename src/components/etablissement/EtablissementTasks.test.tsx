import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { EtablissementTasks } from './EtablissementTasks'

const hoisted = vi.hoisted(() => {
  const TASKS = [
    {
      id: 't1',
      titre: 'Configurer le compte',
      description: 'Configurer accès et paramètres',
      statut: 'A faire',
      priorite: 'high',
      archive: false,
      categorie_id: 'cat-config',
      ordre: 2,
      echeance: '2025-01-20',
      responsable_id: 'resp-1',
    },
    {
      id: 't2',
      titre: 'Former équipe',
      description: 'Session de formation',
      statut: 'En cours',
      priorite: 'medium',
      archive: false,
      categorie_id: 'cat-formation',
      ordre: 1,
      echeance: '2025-01-10',
      responsable_id: 'resp-2',
    },
    {
      id: 't3',
      titre: 'Contrat signé',
      description: 'Document contractuel',
      statut: 'Bloqué',
      priorite: 'low',
      archive: false,
      categorie_id: 'cat-contractuel',
      ordre: 3,
      echeance: null,
      responsable_id: null,
    },
    {
      id: 't4',
      titre: 'Tâche archivée',
      description: 'Ancienne tâche',
      statut: 'Terminé',
      priorite: 'low',
      archive: true,
      categorie_id: 'cat-config',
      ordre: 4,
      echeance: null,
      responsable_id: null,
    },
  ]

  const CATEGORIES = [
    { id: 'cat-config', nom: 'Configuration' },
    { id: 'cat-formation', nom: 'Formation' },
    { id: 'cat-contractuel', nom: 'Contractuel' },
  ]

  const ETABLISSEMENT = { id: 'eta-1', statut: 'en_cours' }

  const AUTH = {
    user: { id: 'u1', email: 'test@local.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const updateMutateAsync = vi.fn()
  const archiveMutateAsync = vi.fn()
  const toast = vi.fn()
  const invalidateQueries = vi.fn()

  const mockFrom = vi.fn()

  return {
    TASKS,
    CATEGORIES,
    ETABLISSEMENT,
    AUTH,
    updateMutateAsync,
    archiveMutateAsync,
    toast,
    invalidateQueries,
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => void) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  hoisted.mockFrom.mockImplementation(() => builder)
  return { supabase: { from: hoisted.mockFrom } }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean
    onCheckedChange?: (v: boolean) => void
    id?: string
  }) => (
    <button
      type="button"
      aria-label={id}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children?: React.ReactNode
  }) => (
    <div>
      <select
        aria-label={`select-${value ?? 'empty'}`}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="order">order</option>
        <option value="priority">priority</option>
        <option value="date">date</option>
        <option value="status">status</option>
        <option value="A faire">A faire</option>
        <option value="En cours">En cours</option>
        <option value="Bloqué">Bloqué</option>
        <option value="Terminé">Terminé</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <svg />
  return {
    CheckCircle2: Icon,
    Clock: Icon,
    AlertTriangle: Icon,
    Circle: Icon,
    Plus: Icon,
    Calendar: Icon,
    User: Icon,
    Search: Icon,
    FileText: Icon,
    Archive: Icon,
    ArchiveRestore: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
  }
})

vi.mock('@/components/tasks/TaskEditDialog', () => ({
  TaskEditDialog: () => <div>TaskEditDialog</div>,
}))

vi.mock('@/components/tasks/TacheDocuments', () => ({
  TacheDocuments: () => <div>TacheDocuments</div>,
}))

vi.mock('@/components/etablissement/SyncTaskModelsButton', () => ({
  SyncTaskModelsButton: ({
    onTasksUpdated,
  }: {
    etablissementId: string
    onTasksUpdated?: () => void
  }) => (
    <button type="button" onClick={onTasksUpdated}>
      Sync
    </button>
  ),
}))

vi.mock('@/components/tasks/CreateTaskDialog', () => ({
  CreateTaskDialog: ({
    triggerButton,
  }: {
    etablissementId: string
    triggerButton?: React.ReactNode
  }) => <div>{triggerButton}</div>,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: hoisted.toast }),
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: vi.fn(() => ({ data: hoisted.CATEGORIES })),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissement: vi.fn(() => ({ data: hoisted.ETABLISSEMENT })),
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTachesByEtablissement: vi.fn(() => ({ data: hoisted.TASKS })),
  useUpdateTache: vi.fn(() => ({
    mutateAsync: hoisted.updateMutateAsync,
    isPending: false,
  })),
  useArchiveTache: vi.fn(() => ({
    mutateAsync: hoisted.archiveMutateAsync,
    isPending: false,
  })),
}))

vi.mock('@/config/phases', () => {
  const PhaseIcon = () => <svg />
  return {
    PHASE_GROUPS: {
      phase1: { label: 'Phase 1', icon: PhaseIcon, categories: ['configuration'] },
      phase2: { label: 'Phase 2', icon: PhaseIcon, categories: ['formation'] },
    },
    getPhaseByStatus: vi.fn(() => 'phase2'),
    getCumulativeCategoriesUpToPhase: vi.fn(() => ['Configuration', 'Formation']),
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => hoisted.AUTH,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => hoisted.AUTH,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => hoisted.AUTH,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { Wrapper, queryClient }
}

describe('EtablissementTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend le composant dans un wrapper react-query compatible renderHook', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => React.useContext(React.createContext('ok')), {
      wrapper: Wrapper,
    })
    expect(result.current).toBe('ok')
  })

  it('affiche les tâches autorisées par phase, masque les archivées par défaut et trie par ordre initial', async () => {
    const { Wrapper } = createWrapper()

    render(
      <Wrapper>
        <EtablissementTasks etablissementId="eta-1" />
      </Wrapper>,
    )

    expect(screen.getByText('Tâches du projet')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Former équipe')).toBeInTheDocument()
      expect(screen.getByText('Configurer le compte')).toBeInTheDocument()
    })

    expect(screen.queryByText('Contrat signé')).not.toBeInTheDocument()
    expect(screen.queryByText('Tâche archivée')).not.toBeInTheDocument()

    const titles = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent)
    expect(titles).toEqual(['Former équipe', 'Configurer le compte'])

    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getByText('Configuration')).toBeInTheDocument()
    expect(screen.getByText('20/01/2025')).toBeInTheDocument()
    expect(screen.getByText('10/01/2025')).toBeInTheDocument()
  })

  it('filtre par recherche et par phase initiale', async () => {
    const { Wrapper } = createWrapper()

    const { rerender } = render(
      <Wrapper>
        <EtablissementTasks etablissementId="eta-1" initialPhaseFilter="phase2" />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText('Former équipe')).toBeInTheDocument()
    })

    expect(screen.queryByText('Configurer le compte')).not.toBeInTheDocument()

    const search = screen.getByPlaceholderText('Rechercher une tâche...')
    fireEvent.change(search, { target: { value: 'configurer' } })
    expect(screen.queryByText('Former équipe')).not.toBeInTheDocument()

    rerender(
      <Wrapper>
        <EtablissementTasks etablissementId="eta-1" initialPhaseFilter="phase1" />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText('Configurer le compte')).toBeInTheDocument()
    })
  })

  it('affiche les archivées quand on aktive le switch', async () => {
    const { Wrapper } = createWrapper()

    render(
      <Wrapper>
        <EtablissementTasks etablissementId="eta-1" />
      </Wrapper>,
    )

    expect(screen.queryByText('Tâche archivée')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'show-archived' }))

    await waitFor(() => {
      expect(screen.getByText('Tâche archivée')).toBeInTheDocument()
      expect(screen.getAllByText('Archivé').length).toBeGreaterThan(0)
    })
  })

  it('met à jour le statut en Terminé, archive automatiquement et affiche un toast métier', async () => {
    const { Wrapper } = createWrapper()
    hoisted.updateMutateAsync.mockResolvedValueOnce({})

    render(
      <Wrapper>
        <EtablissementTasks etablissementId="eta-1" />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText('Configurer le compte')).toBeInTheDocument()
    })

    const selects = screen.getAllByRole('combobox')
    // selects[0] = top sort select, selects[1] = first task (Former équipe), selects[2] = second task (Configurer le compte)
    // We want to change status for 'Former équipe' which has id 't2' (ordre 1)
    fireEvent.change(selects[1], { target: { value: 'Terminé' } })

    await waitFor(() => {
      expect(hoisted.updateMutateAsync).toHaveBeenCalledTimes(1)
    })

    const payload = hoisted.updateMutateAsync.mock.calls[0][0] as {
      id: string
      data: { statut: string; archive?: boolean; date_realisation?: string }
    }

    expect(payload.id).toBe('t2')
    expect(payload.data.statut).toBe('Terminé')
    expect(payload.data.archive).toBe(true)
    expect(payload.data.date_realisation).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(hoisted.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tâche mise à jour',
        description: 'Tâche terminée et archivée automatiquement',
      }),
    )
  })

  it('gère une erreur de mutation de statut avec un toast destructif', async () => {
    const { Wrapper } = createWrapper()
    hoisted.updateMutateAsync.mockRejectedValueOnce(new Error('x'))

    render(
      <Wrapper>
        <EtablissementTasks etablissementId="eta-1" />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText('Former équipe')).toBeInTheDocument()
    })

    const selects = screen.getAllByRole('combobox')
    // change the first task status to trigger mutation error
    fireEvent.change(selects[1], { target: { value: 'Bloqué' } })

    await waitFor(() => {
      expect(hoisted.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erreur',
          description: 'Impossible de mettre à jour',
          variant: 'destructive',
        }),
      )
    })
  })
})