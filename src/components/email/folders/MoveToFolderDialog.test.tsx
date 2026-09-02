/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MoveToFolderDialog } from './MoveToFolderDialog'

const {
  FOLDERS,
  EMPTY_FOLDERS,
  CURRENT_FOLDER_IDS,
  EMPTY_FOLDER_IDS,
  EMAIL_FOLDERS_STATE,
  THREAD_FOLDERS_STATE,
  NO_THREAD_FOLDERS_STATE,
  MUTATIONS_STATE,
  AUTH_STATE,
  BUTTON_CLICK_ERRORS,
  toastSuccess,
  toastError,
  mockFrom,
  useEmailFoldersMock,
  useThreadFoldersMock,
  setThreadFoldersMutateAsync,
  addThreadsToFolderMutateAsync,
} = vi.hoisted(() => {
  type Folder = { id: string; name: string; color: string; icon: string }
  type HookError = null | { message: string }

  const folders: Folder[] = [
    { id: 'f1', name: 'Clients', color: 'blue', icon: 'folder' },
    { id: 'f2', name: 'Urgent', color: 'red', icon: 'star' },
    { id: 'f3', name: 'Archives', color: 'gray', icon: 'archive' },
  ]
  const emptyFolders: Folder[] = []
  const currentFolderIds = ['f1', 'f3']
  const emptyFolderIds: string[] = []

  const emailFoldersState: {
    folders: Folder[]
    isLoading: boolean
    isError: boolean
    error: HookError
  } = {
    folders,
    isLoading: false,
    isError: false,
    error: null,
  }

  const threadFoldersState: {
    data: string[]
    isLoading: boolean
    isError: boolean
    error: HookError
  } = {
    data: currentFolderIds,
    isLoading: false,
    isError: false,
    error: null,
  }

  const noThreadFoldersState: {
    data: string[]
    isLoading: boolean
    isError: boolean
    error: HookError
  } = {
    data: emptyFolderIds,
    isLoading: false,
    isError: false,
    error: null,
  }

  const setMutate = vi.fn()
  const addMutate = vi.fn()

  const mutationsState = {
    setThreadFolders: {
      mutateAsync: setMutate,
      isPending: false,
    },
    addThreadsToFolder: {
      mutateAsync: addMutate,
      isPending: false,
    },
  }

  return {
    FOLDERS: folders,
    EMPTY_FOLDERS: emptyFolders,
    CURRENT_FOLDER_IDS: currentFolderIds,
    EMPTY_FOLDER_IDS: emptyFolderIds,
    EMAIL_FOLDERS_STATE: emailFoldersState,
    THREAD_FOLDERS_STATE: threadFoldersState,
    NO_THREAD_FOLDERS_STATE: noThreadFoldersState,
    MUTATIONS_STATE: mutationsState,
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    BUTTON_CLICK_ERRORS: [] as unknown[],
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    mockFrom: vi.fn(),
    useEmailFoldersMock: vi.fn(),
    useThreadFoldersMock: vi.fn(),
    setThreadFoldersMutateAsync: setMutate,
    addThreadsToFolderMutateAsync: addMutate,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  type QueryResult = { data: null; error: null }
  interface Builder extends PromiseLike<QueryResult> {
    select: () => Builder
    eq: () => Builder
    gte: () => Builder
    lte: () => Builder
    in: () => Builder
    order: () => Builder
    limit: () => Builder
    insert: () => Builder
    update: () => Builder
    delete: () => Builder
    upsert: () => Builder
    single: () => Promise<QueryResult>
    maybeSingle: () => Promise<QueryResult>
    catch: Promise<QueryResult>['catch']
  }

  const createBuilder = (): Builder => {
    const result: QueryResult = { data: null, error: null }
    const partialBuilder: Partial<Builder> = {}
    const chain = () => partialBuilder as Builder

    partialBuilder.select = vi.fn(chain)
    partialBuilder.eq = vi.fn(chain)
    partialBuilder.gte = vi.fn(chain)
    partialBuilder.lte = vi.fn(chain)
    partialBuilder.in = vi.fn(chain)
    partialBuilder.order = vi.fn(chain)
    partialBuilder.limit = vi.fn(chain)
    partialBuilder.insert = vi.fn(chain)
    partialBuilder.update = vi.fn(chain)
    partialBuilder.delete = vi.fn(chain)
    partialBuilder.upsert = vi.fn(chain)
    partialBuilder.single = vi.fn(async () => result)
    partialBuilder.maybeSingle = vi.fn(async () => result)
    partialBuilder.then = (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
    partialBuilder.catch = (onRejected) => Promise.resolve(result).catch(onRejected)

    return partialBuilder as Builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
  }
})

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void | Promise<void>
    disabled?: boolean
    variant?: string
    size?: string
    className?: string
  }) => (
    <button
      type="button"
      onClick={() => {
        const result = onClick?.()
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            BUTTON_CLICK_ERRORS.push(error)
          })
        }
      }}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: () => void }) => (
    <input
      type="checkbox"
      aria-label="folder-checkbox"
      checked={Boolean(checked)}
      onChange={() => onCheckedChange?.()}
    />
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
  }) => <input value={value ?? ''} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('lucide-react', () => ({
  Plus: ({ className }: { className?: string }) => (
    <svg data-testid="icon-plus" className={className} />
  ),
  FolderOpen: ({ className }: { className?: string }) => (
    <svg data-testid="icon-folder-open" className={className} />
  ),
}))

vi.mock('@/hooks/email/useEmailFolders', () => ({
  useEmailFolders: () => useEmailFoldersMock(),
}))

vi.mock('@/hooks/email/useThreadFolders', () => ({
  useThreadFolders: (threadId: string | null) => useThreadFoldersMock(threadId),
  useThreadFolderMutations: () => MUTATIONS_STATE,
}))

vi.mock('./EmailFolderDialog', () => {
  const FolderIcon = ({ className }: { className?: string }) => (
    <svg data-testid="folder-icon" className={className} />
  )

  return {
    EmailFolderDialog: ({
      open,
      onOpenChange,
    }: {
      open: boolean
      onOpenChange: (open: boolean) => void
    }) => (
      <div data-testid="email-folder-dialog" data-open={open ? 'true' : 'false'}>
        <button type="button" onClick={() => onOpenChange(false)}>
          close-create
        </button>
      </div>
    ),
    getFolderColorClass: () => 'mock-color',
    getFolderIconComponent: () => FolderIcon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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
    success: toastSuccess,
    error: toastError,
  },
}))

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderDialog(props?: Partial<React.ComponentProps<typeof MoveToFolderDialog>>) {
  const queryClient = createClient()
  const onOpenChange = vi.fn()

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MoveToFolderDialog open onOpenChange={onOpenChange} threadIds={['th1']} {...props} />
    </QueryClientProvider>
  )

  return { ...view, onOpenChange, queryClient }
}

function getFolderCheckboxes(): HTMLInputElement[] {
  return screen.getAllByLabelText('folder-checkbox').map((element) => {
    if (element instanceof HTMLInputElement) {
      return element
    }
    throw new Error("Le contrôle de dossier attendu n'est pas un input.")
  })
}

function getFolderCheckboxAt(index: number): HTMLInputElement {
  const checkbox = getFolderCheckboxes()[index]
  if (checkbox === undefined) {
    throw new Error(`Checkbox de dossier introuvable à l'index ${index}.`)
  }
  return checkbox
}

describe('MoveToFolderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    BUTTON_CLICK_ERRORS.splice(0, BUTTON_CLICK_ERRORS.length)

    EMAIL_FOLDERS_STATE.folders = FOLDERS
    EMAIL_FOLDERS_STATE.isLoading = false
    EMAIL_FOLDERS_STATE.isError = false
    EMAIL_FOLDERS_STATE.error = null

    THREAD_FOLDERS_STATE.data = CURRENT_FOLDER_IDS
    THREAD_FOLDERS_STATE.isLoading = false
    THREAD_FOLDERS_STATE.isError = false
    THREAD_FOLDERS_STATE.error = null

    NO_THREAD_FOLDERS_STATE.data = EMPTY_FOLDER_IDS
    NO_THREAD_FOLDERS_STATE.isLoading = false
    NO_THREAD_FOLDERS_STATE.isError = false
    NO_THREAD_FOLDERS_STATE.error = null

    MUTATIONS_STATE.setThreadFolders.isPending = false
    MUTATIONS_STATE.addThreadsToFolder.isPending = false

    useEmailFoldersMock.mockImplementation(() => EMAIL_FOLDERS_STATE)
    useThreadFoldersMock.mockImplementation((threadId: string | null) =>
      threadId ? THREAD_FOLDERS_STATE : NO_THREAD_FOLDERS_STATE
    )

    setThreadFoldersMutateAsync.mockResolvedValue({ data: null, error: null })
    addThreadsToFolderMutateAsync.mockResolvedValue({ data: null, error: null })
  })

  it('affiche le chargement des dossiers', () => {
    EMAIL_FOLDERS_STATE.isLoading = true

    renderDialog()

    expect(screen.getByText('Chargement…')).toBeInTheDocument()
    expect(screen.getByText('Ranger dans un dossier')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Rechercher un dossier…')).toHaveValue('')
  })

  it('pré-coche les dossiers du thread unique, filtre la recherche et enregistre la sélection', async () => {
    const { onOpenChange } = renderDialog({ threadIds: ['thread-1'] })

    expect(screen.getByText('Ranger dans un dossier')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('Archives')).toBeInTheDocument()

    expect(getFolderCheckboxes()).toHaveLength(3)
    expect(getFolderCheckboxAt(0).checked).toBe(true)
    expect(getFolderCheckboxAt(1).checked).toBe(false)
    expect(getFolderCheckboxAt(2).checked).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('Rechercher un dossier…'), {
      target: { value: 'urg' },
    })

    expect(screen.queryByText('Clients')).not.toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.queryByText('Archives')).not.toBeInTheDocument()

    fireEvent.click(getFolderCheckboxAt(0))

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'))
    })

    await waitFor(() => {
      expect(setThreadFoldersMutateAsync).toHaveBeenCalledWith({
        threadId: 'thread-1',
        folderIds: ['f1', 'f3', 'f2'],
      })
    })

    expect(addThreadsToFolderMutateAsync).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('en mode multi-threads ajoute chaque dossier coché à tous les fils sélectionnés', async () => {
    const { onOpenChange } = renderDialog({ threadIds: ['th1', 'th2'] })

    expect(screen.getByText('Ranger 2 fils dans un dossier')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Les dossiers cochés seront ajoutés aux fils sélectionnés (les dossiers existants ne sont pas retirés).'
      )
    ).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Ranger' })).toHaveProperty('disabled', true)

    fireEvent.click(getFolderCheckboxAt(0))
    fireEvent.click(getFolderCheckboxAt(2))

    expect(screen.getByRole('button', { name: 'Ranger' })).toHaveProperty('disabled', false)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ranger' }))
    })

    await waitFor(() => {
      expect(addThreadsToFolderMutateAsync).toHaveBeenNthCalledWith(1, {
        threadIds: ['th1', 'th2'],
        folderId: 'f1',
      })
      expect(addThreadsToFolderMutateAsync).toHaveBeenNthCalledWith(2, {
        threadIds: ['th1', 'th2'],
        folderId: 'f3',
      })
    })

    expect(setThreadFoldersMutateAsync).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("affiche l'état vide et ouvre la création d'un dossier", () => {
    EMAIL_FOLDERS_STATE.folders = EMPTY_FOLDERS

    renderDialog()

    expect(screen.getByText("Vous n'avez pas encore de dossier.")).toBeInTheDocument()
    expect(screen.getByText('Créer mon premier dossier')).toBeInTheDocument()
    expect(screen.getByTestId('email-folder-dialog')).toHaveAttribute('data-open', 'false')

    fireEvent.click(screen.getByText('Créer mon premier dossier'))

    expect(screen.getByTestId('email-folder-dialog')).toHaveAttribute('data-open', 'true')
  })

  it('affiche le message quand aucun dossier ne correspond à la recherche', () => {
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText('Rechercher un dossier…'), {
      target: { value: 'zzz' },
    })

    expect(screen.getByText('Aucun dossier ne correspond')).toBeInTheDocument()
  })

  it("capture l'erreur de mutation sans fermer le dialogue", async () => {
    const mutationError = { data: null, error: { message: 'x' } }
    setThreadFoldersMutateAsync.mockRejectedValueOnce(mutationError)

    const { onOpenChange } = renderDialog({ threadIds: ['th-err'] })

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'))
    })

    await waitFor(() => {
      expect(setThreadFoldersMutateAsync).toHaveBeenCalledWith({
        threadId: 'th-err',
        folderIds: ['f1', 'f3'],
      })
      expect(BUTTON_CLICK_ERRORS).toEqual([mutationError])
    })

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
