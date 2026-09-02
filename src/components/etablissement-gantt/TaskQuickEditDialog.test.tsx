import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook } from '@testing-library/react'
import { TaskQuickEditDialog } from './TaskQuickEditDialog'

const {
  TASK,
  DOCUMENTS,
  PROFILES,
  AUTH_STATE,
  toastSpy,
  debugErrorSpy,
  updateMutateAsync,
  deleteMutateAsync,
  mockUseUpdateTache,
  mockUseDeleteTache,
  mockUseTachesDocuments,
  mockUseProfiles,
  mockFrom,
} = vi.hoisted(() => {
  const TASK = {
    id: 'task-1',
    titre: 'Préparer devis',
    description: 'Description initiale',
    statut: 'En cours',
    priorite: 'medium',
    date_debut: '2024-02-10',
    echeance: '2024-02-20',
    responsable_id: 'p1',
    etablissement_id: 'eta-1',
  }

  const DOCUMENTS = [{ id: 'd1' }, { id: 'd2' }]
  const PROFILES = [
    { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
    { id: 'p2', prenom: 'Marie', nom: 'Curie' },
  ]
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const toastSpy = vi.fn()
  const debugErrorSpy = vi.fn()
  const updateMutateAsync = vi.fn()
  const deleteMutateAsync = vi.fn()
  const mockUseUpdateTache = vi.fn()
  const mockUseDeleteTache = vi.fn()
  const mockUseTachesDocuments = vi.fn()
  const mockUseProfiles = vi.fn()

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      match: vi.fn(() => builder),
      or: vi.fn(() => builder),
      not: vi.fn(() => builder),
      is: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      overlap: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())

  return {
    TASK,
    DOCUMENTS,
    PROFILES,
    AUTH_STATE,
    toastSpy,
    debugErrorSpy,
    updateMutateAsync,
    deleteMutateAsync,
    mockUseUpdateTache,
    mockUseDeleteTache,
    mockUseTachesDocuments,
    mockUseProfiles,
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorSpy,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: mockUseUpdateTache,
  useDeleteTache: mockUseDeleteTache,
}))

vi.mock('@/hooks/tasks/useTachesDocuments', () => ({
  useTachesDocuments: mockUseTachesDocuments,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock('@/components/tasks/TacheDocuments', () => ({
  TacheDocuments: ({ tacheId, tacheTitre, etablissementId }: { tacheId: string; tacheTitre: string; etablissementId: string }) => (
    <div data-testid="tache-documents">
      {tacheId}:{tacheTitre}:{etablissementId}
    </div>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input ref={ref} {...props} />),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => <textarea ref={ref} {...props} />),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string | null
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => {
    const items: Array<{ value: string; label: string }> = []
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      if ((child.type as { displayName?: string }).displayName === 'SelectContent') {
        React.Children.forEach(child.props.children, (itemChild) => {
          if (!React.isValidElement(itemChild)) return
          if ((itemChild.type as { displayName?: string }).displayName === 'SelectItem') {
            const label = typeof itemChild.props.children === 'string'
              ? itemChild.props.children
              : React.Children.toArray(itemChild.props.children).join('')
            items.push({ value: itemChild.props.value, label })
          }
        })
      }
    })

    return (
      <select
        data-testid="select"
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    )
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode; value: string }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader-icon">loader</span>,
  Trash2: () => <span>trash</span>,
  Archive: () => <span>archive</span>,
  CheckCircle: () => <span>check</span>,
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

describe('TaskQuickEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUpdateTache.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
    mockUseDeleteTache.mockReturnValue({
      mutateAsync: deleteMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
    mockUseTachesDocuments.mockReturnValue({
      data: DOCUMENTS,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseProfiles.mockReturnValue({
      data: PROFILES,
      isLoading: false,
      isError: false,
      error: null,
    })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('expose un état de chargement puis succès et erreur via les hooks mockés', async () => {
    const wrapper = createWrapper()

    mockUseProfiles
      .mockReturnValueOnce({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: PROFILES,
        isLoading: false,
        isError: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'x' },
      })

    const loadingHook = renderHook(() => mockUseProfiles(), { wrapper })
    expect(loadingHook.result.current.isLoading).toBe(true)
    expect(loadingHook.result.current.data).toBeNull()

    const successHook = renderHook(() => mockUseProfiles(), { wrapper })
    expect(successHook.result.current.isLoading).toBe(false)
    expect(successHook.result.current.isError).toBe(false)
    expect(successHook.result.current.data).toEqual(PROFILES)
    expect(successHook.result.current.data[1].prenom).toBe('Marie')

    const errorHook = renderHook(() => mockUseProfiles(), { wrapper })
    expect(errorHook.result.current.isError).toBe(true)
    expect(errorHook.result.current.error).toEqual({ message: 'x' })
  })

  it('pré-remplit le formulaire, affiche le nombre de documents et sauvegarde les modifications', async () => {
    updateMutateAsync.mockResolvedValue({ data: { id: TASK.id }, error: null })
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<TaskQuickEditDialog task={TASK} isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByDisplayValue('Préparer devis')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Description initiale')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByTestId('tache-documents')).toHaveTextContent('task-1:Préparer devis:eta-1')

    const titleInput = screen.getByLabelText('Titre *')
    await user.clear(titleInput)
    await user.type(titleInput, 'Devis final')

    const descriptionInput = screen.getByLabelText('Description')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Description modifiée')

    const saveButton = screen.getByRole('button', { name: /enregistrer/i })
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: 'task-1',
        data: {
          titre: 'Devis final',
          description: 'Description modifiée',
          statut: 'En cours',
          priorite: 'medium',
          date_debut: '2024-02-10',
          echeance: '2024-02-20',
          responsable_id: 'p1',
        },
      })
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marque la tâche comme terminée et affiche un toast', async () => {
    updateMutateAsync.mockResolvedValue({ data: { id: TASK.id }, error: null })
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<TaskQuickEditDialog task={TASK} isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: /terminé/i }))

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledTimes(1)
    })

    const payload = updateMutateAsync.mock.calls[0][0] as {
      id: string
      data: { statut: string; date_realisation: string }
    }

    expect(payload.id).toBe('task-1')
    expect(payload.data.statut).toBe('Terminé')
    expect(payload.data.date_realisation).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Tâche terminée',
      description: 'La tâche a été marquée comme terminée',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('archive la tâche via delete et affiche un toast', async () => {
    deleteMutateAsync.mockResolvedValue({ data: { id: TASK.id }, error: null })
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<TaskQuickEditDialog task={TASK} isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: /archiver/i }))

    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalledWith('task-1')
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Tâche archivée',
      description: 'La tâche a été archivée avec succès',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supprime la tâche après confirmation', async () => {
    deleteMutateAsync.mockResolvedValue({ data: { id: TASK.id }, error: null })
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<TaskQuickEditDialog task={TASK} isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalledWith('task-1')
    })

    expect(globalThis.confirm).toHaveBeenCalledWith('Êtes-vous sûr de vouloir supprimer cette tâche ?')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('gère les erreurs de mutation sans fermer la boîte de dialogue', async () => {
    updateMutateAsync.mockRejectedValue(new Error('x'))
    deleteMutateAsync.mockRejectedValue(new Error('x'))
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<TaskQuickEditDialog task={TASK} isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    })

    const titleInput = screen.getByLabelText('Titre *')
    await user.clear(titleInput)
    await user.type(titleInput, 'Titre erreur')
    await user.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith('Error updating task:', expect.any(Error))
    })

    await user.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith('Error deleting task:', expect.any(Error))
    })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('retourne null si task est null', () => {
    const onClose = vi.fn()

    const { container } = render(<TaskQuickEditDialog task={null} isOpen={true} onClose={onClose} />, {
      wrapper: createWrapper(),
    })

    expect(container).toBeEmptyDOMElement()
  })
})