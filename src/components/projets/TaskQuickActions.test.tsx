/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskQuickActions } from './TaskQuickActions'

const {
  TASK,
  TASK_WITHOUT_ESTABLISHMENT,
  ACTIVITIES,
  EMPTY_ACTIVITIES,
  toastSpy,
  invalidateQueriesSpy,
  debugErrorSpy,
  sanitizeSpy,
  formatDateSpy,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockLimit,
  mockUpdate,
  updateResult,
  selectResult,
  currentTable,
  makeBuilder,
} = vi.hoisted(() => {
  const TASK = {
    id: 'task-1',
    titre: 'Appeler le client',
    description: 'Note initiale',
    etablissement_id: 'eta-1',
    etablissements: { nom: 'Clinique du Lac' },
  }

  const TASK_WITHOUT_ESTABLISHMENT = {
    id: 'task-2',
    titre: 'Tâche sans établissement',
    description: '',
    etablissement_id: null,
    etablissements: { nom: 'Sans établissement' },
  }

  const ACTIVITIES = [
    {
      id: 'a1',
      etablissement_id: 'eta-1',
      activity_type: 'call',
      activity_date: '2024-05-10',
      description: 'Premier échange',
      title: 'Appel',
      created_at: '2024-05-10T10:00:00',
    },
    {
      id: 'a2',
      etablissement_id: 'eta-1',
      activity_type: 'email',
      activity_date: '2024-05-09',
      description: 'Envoi du devis',
      title: 'Email',
      created_at: '2024-05-09T10:00:00',
    },
  ]

  const EMPTY_ACTIVITIES: Array<{
    id: string
    etablissement_id: string
    activity_type: string
    activity_date: string
    description: string
    title: string
    created_at: string
  }> = []

  const toastSpy = vi.fn()
  const invalidateQueriesSpy = vi.fn()
  const debugErrorSpy = vi.fn()
  const sanitizeSpy = vi.fn(() => 'Erreur nettoyée')
  const formatDateSpy = vi.fn((value: string) => `fmt:${value}`)

  const updateResult = {
    value: { data: null, error: null as null | { message: string } },
  }

  const selectResult = {
    value: { data: ACTIVITIES as typeof ACTIVITIES | null, error: null as null | { message: string } },
  }

  const currentTable = {
    value: '',
  }

  const makeBuilder = () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn(),
      catch: vi.fn(),
    }

    builder.select.mockImplementation(() => builder)
    builder.eq.mockImplementation((field: string, value: string) => {
      if (currentTable.value === 'taches' && field === 'id') {
        return Promise.resolve(updateResult.value)
      }
      return builder
    })
    builder.gte.mockImplementation(() => builder)
    builder.lte.mockImplementation(() => builder)
    builder.in.mockImplementation(() => builder)
    builder.order.mockImplementation(() => builder)
    builder.limit.mockImplementation(() => Promise.resolve(selectResult.value))
    builder.insert.mockImplementation(() => builder)
    builder.update.mockImplementation(() => builder)
    builder.delete.mockImplementation(() => builder)
    builder.single.mockImplementation(() => Promise.resolve(selectResult.value))
    builder.maybeSingle.mockImplementation(() => Promise.resolve(selectResult.value))
    builder.then.mockImplementation(
      (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        const value = currentTable.value === 'taches' ? updateResult.value : selectResult.value
        return Promise.resolve(value).then(onFulfilled, onRejected)
      }
    )
    builder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) => {
      const value = currentTable.value === 'taches' ? updateResult.value : selectResult.value
      return Promise.resolve(value).catch(onRejected)
    })

    return builder
  }

  const mockSelect = vi.fn()
  const mockEq = vi.fn()
  const mockOrder = vi.fn()
  const mockLimit = vi.fn()
  const mockUpdate = vi.fn()

  const mockFrom = vi.fn((table: string) => {
    currentTable.value = table
    const builder = makeBuilder()

    builder.select.mockImplementation((...args: unknown[]) => {
      mockSelect(...args)
      return builder
    })
    builder.eq.mockImplementation((...args: unknown[]) => {
      mockEq(...args)
      if (table === 'taches' && args[0] === 'id') {
        return Promise.resolve(updateResult.value)
      }
      return builder
    })
    builder.order.mockImplementation((...args: unknown[]) => {
      mockOrder(...args)
      return builder
    })
    builder.limit.mockImplementation((...args: unknown[]) => {
      mockLimit(...args)
      return Promise.resolve(selectResult.value)
    })
    builder.update.mockImplementation((...args: unknown[]) => {
      mockUpdate(...args)
      return builder
    })

    return builder
  })

  return {
    TASK,
    TASK_WITHOUT_ESTABLISHMENT,
    ACTIVITIES,
    EMPTY_ACTIVITIES,
    toastSpy,
    invalidateQueriesSpy,
    debugErrorSpy,
    sanitizeSpy,
    formatDateSpy,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockLimit,
    mockUpdate,
    updateResult,
    selectResult,
    currentTable,
    makeBuilder,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSpy,
}))

vi.mock('@/lib/projetsUtils', () => ({
  formatDateFr: formatDateSpy,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorSpy,
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    [key: string]: unknown
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({
    children,
    onClick,
  }: {
    children: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>
    onClick?: React.MouseEventHandler<HTMLElement>
  }) =>
    React.cloneElement(children, {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        onClick?.(e)
        children.props.onClick?.(e)
      },
    }),
  DropdownMenuContent: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLDivElement>
  }) => <div onClick={onClick}>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLDivElement>
  }) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLDivElement>
  }) => <div onClick={onClick}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
  }: {
    value: string
    onChange: React.ChangeEventHandler<HTMLTextAreaElement>
    placeholder?: string
    rows?: number
  }) => <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}))

vi.mock('lucide-react', () => ({
  MoreHorizontal: () => <span>more</span>,
  StickyNote: () => <span>note</span>,
  Activity: () => <span>activity</span>,
  Loader2: () => <span data-testid="loader">loading</span>,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(invalidateQueriesSpy)

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('TaskQuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateResult.value = { data: null, error: null }
    selectResult.value = { data: ACTIVITIES, error: null }
    currentTable.value = ''
    sanitizeSpy.mockReturnValue('Erreur nettoyée')
    formatDateSpy.mockImplementation((value: string) => `fmt:${value}`)
  })

  it('ouvre la note, enregistre la nouvelle description, affiche le loader puis invalide les tâches', async () => {
    let resolveUpdate: ((value: { data: null; error: null }) => void) | undefined
    const pendingUpdate = new Promise<{ data: null; error: null }>((resolve) => {
      resolveUpdate = resolve
    })

    mockFrom.mockImplementationOnce((table: string) => {
      currentTable.value = table
      const builder = makeBuilder()

      builder.update.mockImplementation((...args: unknown[]) => {
        mockUpdate(...args)
        return builder
      })
      builder.eq.mockImplementation((...args: unknown[]) => {
        mockEq(...args)
        return pendingUpdate
      })

      return builder
    })

    render(<TaskQuickActions task={TASK} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('menuitem', { name: /modifier la note/i }))

    expect(screen.getByText('Note pour "Appeler le client"')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('Ajouter une note ou description...')
    expect(textarea).toHaveValue('Note initiale')

    fireEvent.change(textarea, { target: { value: 'Nouvelle note client' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    expect(screen.getByTestId('loader')).toBeInTheDocument()
    expect(mockFrom).toHaveBeenCalledWith('taches')
    expect(mockUpdate).toHaveBeenCalledWith({ description: 'Nouvelle note client' })
    expect(mockEq).toHaveBeenCalledWith('id', 'task-1')

    resolveUpdate?.({ data: null, error: null })

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({ title: 'Note mise à jour' })
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['taches'] })
    await waitFor(() => {
      expect(screen.queryByText('Note pour "Appeler le client"')).not.toBeInTheDocument()
    })
  })

  it('affiche les activités récentes avec les dates formatées', async () => {
    selectResult.value = { data: ACTIVITIES, error: null }

    render(<TaskQuickActions task={TASK} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('menuitem', { name: /voir les activités/i }))

    expect(screen.getByText(/Activités récentes - Clinique du Lac/)).toBeInTheDocument()

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('customer_activities')
      expect(mockSelect).toHaveBeenCalledWith(
        'id, etablissement_id, activity_type, activity_date, description, created_at'
      )
      expect(mockEq).toHaveBeenCalledWith('etablissement_id', 'eta-1')
      expect(mockOrder).toHaveBeenCalledWith('activity_date', { ascending: false })
      expect(mockLimit).toHaveBeenCalledWith(5)
    })

    await waitFor(() => {
      expect(screen.getByText('Appel')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Premier échange')).toBeInTheDocument()
      expect(screen.getByText('Envoi du devis')).toBeInTheDocument()
      expect(screen.getByText('fmt:2024-05-10')).toBeInTheDocument()
      expect(screen.getByText('fmt:2024-05-09')).toBeInTheDocument()
    })

    expect(formatDateSpy).toHaveBeenCalledWith('2024-05-10')
    expect(formatDateSpy).toHaveBeenCalledWith('2024-05-09')
  })

  it('affiche une erreur toastée quand la sauvegarde échoue', async () => {
    updateResult.value = { data: null, error: { message: 'x' } }

    render(<TaskQuickActions task={TASK} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('menuitem', { name: /modifier la note/i }))
    fireEvent.change(screen.getByPlaceholderText('Ajouter une note ou description...'), {
      target: { value: 'Note KO' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'x' })
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    })
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('affiche le message vide quand aucune activité récente n’est trouvée', async () => {
    selectResult.value = { data: EMPTY_ACTIVITIES, error: null }

    render(<TaskQuickActions task={TASK} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('menuitem', { name: /voir les activités/i }))

    await waitFor(() => {
      expect(screen.getByText('Aucune activité récente')).toBeInTheDocument()
    })
  })

  it('journalise une erreur si le chargement des activités échoue', async () => {
    selectResult.value = { data: null, error: { message: 'x' } }

    render(<TaskQuickActions task={TASK} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('menuitem', { name: /voir les activités/i }))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith('Error loading activities:', { message: 'x' })
    })

    expect(screen.getByText('Aucune activité récente')).toBeInTheDocument()
  })

  it('n’interroge pas supabase pour les activités si la tâche n’a pas d’établissement', async () => {
    render(<TaskQuickActions task={TASK_WITHOUT_ESTABLISHMENT} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('menuitem', { name: /voir les activités/i }))

    expect(screen.getByText(/Activités récentes - Sans établissement/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Aucune activité récente')).toBeInTheDocument()
    })

    expect(mockFrom).not.toHaveBeenCalledWith('customer_activities')
    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockOrder).not.toHaveBeenCalled()
    expect(mockLimit).not.toHaveBeenCalled()
  })
})