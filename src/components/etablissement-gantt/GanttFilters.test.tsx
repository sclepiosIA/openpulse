/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { GanttFiltersPanel } from './GanttFilters'

const {
  AUTH_STATE,
  PHASE_GROUPS_STABLE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError
} = vi.hoisted(() => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="phase-icon" className={className} />
  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false
    },
    PHASE_GROUPS_STABLE: {
      planning: { label: 'Planification', color: '#111', icon: Icon },
      execution: { label: 'Exécution', color: '#222', icon: Icon }
    },
    mockFrom: vi.fn(),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn()
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const result = { data: null, error: null }
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      rangeGt: vi.fn(() => builder),
      rangeGte: vi.fn(() => builder),
      rangeLt: vi.fn(() => builder),
      rangeLte: vi.fn(() => builder),
      overlaps: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
      filter: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      abortSignal: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected)
    }
    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
      }
    }
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError
  }
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    className?: string
  }) => (
    <input
      data-testid="input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  )
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    className
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange
  }: {
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      data-testid={id}
      id={id}
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.(!(checked ?? false))}
    />
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    className?: string
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />
}))

vi.mock('lucide-react', () => ({
  X: ({ className }: { className?: string }) => <svg data-testid="icon-x" className={className} />,
  Search: ({ className }: { className?: string }) => <svg data-testid="icon-search" className={className} />
}))

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: PHASE_GROUPS_STABLE
}))

type Filters = {
  searchTerm: string
  phases: string[]
  categories: string[]
  statuts: string[]
  priorites: string[]
  etablissements?: string[]
  responsables?: string[]
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('GanttFiltersPanel', () => {
  const baseFilters: Filters = {
    searchTerm: 'chantier',
    phases: ['planning'],
    categories: ['cat-1'],
    statuts: ['En cours'],
    priorites: ['high'],
    etablissements: ['etab-1'],
    responsables: ['resp-1']
  }

  const categories = [
    { id: 'cat-1', nom: 'Maintenance', couleur: '#f00' },
    { id: 'cat-2', nom: 'Sécurité', couleur: '#0f0' }
  ]

  const statuts = ['En cours', 'Terminé']
  const priorites = ['high', 'medium', 'low']
  const etablissements = [
    { id: 'etab-1', nom: 'Site Nord' },
    { id: 'etab-2', nom: 'Site Sud' }
  ]
  const responsables = [
    { id: 'resp-1', prenom: 'Jean', nom: 'Dupont' },
    { id: 'resp-2', prenom: 'Lina', nom: 'Martin' }
  ]

  it('affiche les sections et les valeurs métier réelles', () => {
    const onFilterChange = vi.fn()
    const onReset = vi.fn()

    render(
      <GanttFiltersPanel
        filters={baseFilters}
        onFilterChange={onFilterChange}
        onReset={onReset}
        categories={categories}
        statuts={statuts}
        priorites={priorites}
        etablissements={etablissements}
        responsables={responsables}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Filtres')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Titre ou description...')).toHaveValue('chantier')
    expect(screen.getByText('Planification')).toBeInTheDocument()
    expect(screen.getByText('Exécution')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Sécurité')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('Terminé')).toBeInTheDocument()
    expect(screen.getByText('Haute')).toBeInTheDocument()
    expect(screen.getByText('Moyenne')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()
    expect(screen.getByText('Site Nord')).toBeInTheDocument()
    expect(screen.getByText('Site Sud')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText('Lina Martin')).toBeInTheDocument()

    expect(screen.getByTestId('phase-planning')).toBeChecked()
    expect(screen.getByTestId('phase-execution')).not.toBeChecked()
    expect(screen.getByTestId('cat-cat-1')).toBeChecked()
    expect(screen.getByTestId('cat-cat-2')).not.toBeChecked()
    expect(screen.getByTestId('stat-En cours')).toBeChecked()
    expect(screen.getByTestId('stat-Terminé')).not.toBeChecked()
    expect(screen.getByTestId('prio-high')).toBeChecked()
    expect(screen.getByTestId('prio-medium')).not.toBeChecked()
    expect(screen.getByTestId('etab-etab-1')).toBeChecked()
    expect(screen.getByTestId('resp-resp-1')).toBeChecked()
  })

  it('met à jour le terme de recherche et permet de le réinitialiser', () => {
    const onFilterChange = vi.fn()
    const onReset = vi.fn()

    render(
      <GanttFiltersPanel
        filters={baseFilters}
        onFilterChange={onFilterChange}
        onReset={onReset}
        categories={categories}
        statuts={statuts}
        priorites={priorites}
        etablissements={etablissements}
        responsables={responsables}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.change(screen.getByPlaceholderText('Titre ou description...'), {
      target: { value: 'audit' }
    })

    expect(onFilterChange).toHaveBeenCalledWith('searchTerm', 'audit')

    fireEvent.click(screen.getByTestId('icon-x').closest('button') as HTMLButtonElement)

    expect(onFilterChange).toHaveBeenCalledWith('searchTerm', '')
  })

  it('toggle correctement chaque filtre tableau', () => {
    const onFilterChange = vi.fn()
    const onReset = vi.fn()

    render(
      <GanttFiltersPanel
        filters={baseFilters}
        onFilterChange={onFilterChange}
        onReset={onReset}
        categories={categories}
        statuts={statuts}
        priorites={priorites}
        etablissements={etablissements}
        responsables={responsables}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByTestId('phase-planning'))
    expect(onFilterChange).toHaveBeenCalledWith('phases', [])

    fireEvent.click(screen.getByTestId('phase-execution'))
    expect(onFilterChange).toHaveBeenCalledWith('phases', ['planning', 'execution'])

    fireEvent.click(screen.getByTestId('cat-cat-2'))
    expect(onFilterChange).toHaveBeenCalledWith('categories', ['cat-1', 'cat-2'])

    fireEvent.click(screen.getByTestId('stat-Terminé'))
    expect(onFilterChange).toHaveBeenCalledWith('statuts', ['En cours', 'Terminé'])

    fireEvent.click(screen.getByTestId('prio-medium'))
    expect(onFilterChange).toHaveBeenCalledWith('priorites', ['high', 'medium'])

    fireEvent.click(screen.getByTestId('etab-etab-2'))
    expect(onFilterChange).toHaveBeenCalledWith('etablissements', ['etab-1', 'etab-2'])

    fireEvent.click(screen.getByTestId('resp-resp-2'))
    expect(onFilterChange).toHaveBeenCalledWith('responsables', ['resp-1', 'resp-2'])
  })

  it('appelle onReset au clic sur Réinitialiser', () => {
    const onFilterChange = vi.fn()
    const onReset = vi.fn()

    render(
      <GanttFiltersPanel
        filters={baseFilters}
        onFilterChange={onFilterChange}
        onReset={onReset}
        categories={categories}
        statuts={statuts}
        priorites={priorites}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('n’affiche pas les sections optionnelles si les listes sont absentes', () => {
    const onFilterChange = vi.fn()
    const onReset = vi.fn()

    render(
      <GanttFiltersPanel
        filters={{
          searchTerm: '',
          phases: [],
          categories: [],
          statuts: [],
          priorites: [],
          etablissements: [],
          responsables: []
        }}
        onFilterChange={onFilterChange}
        onReset={onReset}
        categories={categories}
        statuts={statuts}
        priorites={priorites}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByText('Établissements')).not.toBeInTheDocument()
    expect(screen.queryByText('Responsables')).not.toBeInTheDocument()
    expect(screen.queryByTestId('icon-x')).not.toBeInTheDocument()
  })
})