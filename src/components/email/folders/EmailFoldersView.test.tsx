import '@testing-library/jest-dom/vitest'
import type * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const {
  FOLDERS,
  COUNTS,
  THREAD_LINKS,
  THREAD_ROWS,
  hookState,
  mockFrom,
  mockDeleteFolderMutateAsync,
  mockRemoveThreadFromFolderMutate,
  mockUseEmailFolders,
  mockUseFolderThreads,
  mockUseThreadFolderMutations,
} = vi.hoisted(() => {
  const FOLDERS = [
    {
      id: 'f1',
      name: 'Projet Alpha',
      color: 'blue',
      icon: 'folder',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      user_id: 'u1',
    },
    {
      id: 'f2',
      name: 'Client Beta',
      color: 'green',
      icon: 'archive',
      created_at: '2024-02-01',
      updated_at: '2024-02-02',
      user_id: 'u1',
    },
  ]

  const COUNTS: Record<string, number> = {
    f1: 2,
    f2: 1,
  }

  const THREAD_LINKS = [
    {
      id: 'l1',
      folder_id: 'f1',
      thread_id: 't1',
      created_at: '2024-03-01',
    },
    {
      id: 'l2',
      folder_id: 'f1',
      thread_id: 't2',
      created_at: '2024-03-02',
    },
  ]

  const THREAD_ROWS = [
    {
      id: 't1',
      subject: 'Re: Analyse réunion',
      ai_generated_title: null,
      last_message_date: '2024-04-04T10:00:00.000Z',
      last_message_from_name: 'Claude Martin',
      last_message_from_email: 'claude@example.fr',
      unread_count: 3,
      is_processed: true,
    },
    {
      id: 't2',
      subject: 'Note interne',
      ai_generated_title: 'Synthèse opérationnelle',
      last_message_date: '2024-04-03T10:00:00.000Z',
      last_message_from_name: null,
      last_message_from_email: 'ops@example.fr',
      unread_count: 0,
      is_processed: false,
    },
  ]

  const EMPTY_FOLDERS: typeof FOLDERS = []
  const EMPTY_COUNTS: Record<string, number> = {}
  const EMPTY_LINKS: typeof THREAD_LINKS = []
  const SUPABASE_ERROR = { message: 'x' }
  const SUPABASE_SUCCESS_RESPONSE = { data: THREAD_ROWS, error: null }
  const SUPABASE_ERROR_RESPONSE = { data: null, error: SUPABASE_ERROR }

  type SupabaseResponse = typeof SUPABASE_SUCCESS_RESPONSE | typeof SUPABASE_ERROR_RESPONSE

  const hookState = {
    emailFoldersMode: 'success' as 'success' | 'loading' | 'empty',
    folderLinksMode: 'success' as 'success' | 'empty',
    supabaseMode: 'success' as 'success' | 'error' | 'pending',
  }

  const pendingPromise = new Promise<SupabaseResponse>(() => undefined)

  class SupabaseBuilder {
    select(_columns?: string) {
      return this
    }

    eq(_column: string, _value: unknown) {
      return this
    }

    gte(_column: string, _value: unknown) {
      return this
    }

    lte(_column: string, _value: unknown) {
      return this
    }

    in(_column: string, _values: readonly unknown[]) {
      return this
    }

    order(_column: string, _options?: Record<string, unknown>) {
      return this
    }

    limit(_count: number) {
      return this
    }

    insert(_values: unknown) {
      return this
    }

    update(_values: unknown) {
      return this
    }

    delete() {
      return this
    }

    single() {
      return this.toPromise()
    }

    maybeSingle() {
      return this.toPromise()
    }

    then<TResult1 = SupabaseResponse, TResult2 = never>(
      onFulfilled?: ((value: SupabaseResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.toPromise().then(onFulfilled, onRejected)
    }

    catch<TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) {
      return this.toPromise().catch(onRejected)
    }

    private toPromise() {
      if (hookState.supabaseMode === 'pending') return pendingPromise
      if (hookState.supabaseMode === 'error') return Promise.resolve(SUPABASE_ERROR_RESPONSE)
      return Promise.resolve(SUPABASE_SUCCESS_RESPONSE)
    }
  }

  const builder = new SupabaseBuilder()
  const mockFrom = vi.fn(() => builder)

  const mockDeleteFolderMutateAsync = vi.fn((_folderId: string) => Promise.resolve())
  const mockRemoveThreadFromFolderMutate = vi.fn()

  const deleteFolder = { mutateAsync: mockDeleteFolderMutateAsync }
  const removeThreadFromFolder = { mutate: mockRemoveThreadFromFolderMutate }

  const emailFoldersSuccess = {
    folders: FOLDERS,
    counts: COUNTS,
    isLoading: false,
    deleteFolder,
  }

  const emailFoldersLoading = {
    folders: EMPTY_FOLDERS,
    counts: EMPTY_COUNTS,
    isLoading: true,
    deleteFolder,
  }

  const emailFoldersEmpty = {
    folders: EMPTY_FOLDERS,
    counts: EMPTY_COUNTS,
    isLoading: false,
    deleteFolder,
  }

  const folderThreadsSuccess = { data: THREAD_LINKS }
  const folderThreadsEmpty = { data: EMPTY_LINKS }

  const mockUseEmailFolders = vi.fn(() => {
    if (hookState.emailFoldersMode === 'loading') return emailFoldersLoading
    if (hookState.emailFoldersMode === 'empty') return emailFoldersEmpty
    return emailFoldersSuccess
  })

  const mockUseFolderThreads = vi.fn((folderId: string | null) => {
    if (folderId === null) return folderThreadsEmpty
    if (hookState.folderLinksMode === 'empty') return folderThreadsEmpty
    return folderThreadsSuccess
  })

  const mockUseThreadFolderMutations = vi.fn(() => ({
    removeThreadFromFolder,
  }))

  return {
    FOLDERS,
    COUNTS,
    THREAD_LINKS,
    THREAD_ROWS,
    hookState,
    mockFrom,
    mockDeleteFolderMutateAsync,
    mockRemoveThreadFromFolderMutate,
    mockUseEmailFolders,
    mockUseFolderThreads,
    mockUseThreadFolderMutations,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/email/useEmailFolders', () => ({
  useEmailFolders: mockUseEmailFolders,
}))

vi.mock('@/hooks/email/useThreadFolders', () => ({
  useFolderThreads: mockUseFolderThreads,
  useThreadFolderMutations: mockUseThreadFolderMutations,
}))

vi.mock('@/components/ui/button', () => {
  type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    variant?: string
    size?: string
  }

  const Button = ({
    asChild: _asChild,
    variant: _variant,
    size: _size,
    type,
    ...props
  }: ButtonProps) => <button type={type ?? 'button'} {...props} />

  return {
    Button,
    buttonVariants: vi.fn(() => ''),
  }
})

vi.mock('@/components/ui/badge', () => {
  type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
    variant?: string
  }

  const Badge = ({ variant: _variant, ...props }: BadgeProps) => <span {...props} />

  return {
    Badge,
    badgeVariants: vi.fn(() => ''),
  }
})

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  ScrollBar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => {
  type ChildProps = {
    children?: React.ReactNode
  }

  type TriggerProps = React.HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean
  }

  type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
    align?: string
  }

  const DropdownMenu = ({ children }: ChildProps) => <div>{children}</div>
  const DropdownMenuTrigger = ({ children, asChild: _asChild }: TriggerProps) => <>{children}</>
  const DropdownMenuContent = ({ children, align: _align, ...props }: ContentProps) => (
    <div {...props}>{children}</div>
  )
  const DropdownMenuItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="menuitem" {...props}>
      {children}
    </div>
  )

  return {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  }
})

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" data-testid="mock-icon" {...props} />
  )

  return {
    Plus: Icon,
    Search: Icon,
    FolderOpen: Icon,
    MoreVertical: Icon,
    Pencil: Icon,
    Trash2: Icon,
    X: Icon,
    MailPlus: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/lib/emailUtils', () => ({
  sanitizeEmailSubject: vi.fn((subject: string) => subject.replace(/^(re|fwd)\s*:\s*/i, '').trim()),
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => 'il y a 2 jours'),
}))

vi.mock('date-fns/locale', () => ({
  fr: {},
}))

vi.mock('./AddThreadsToFolderDialog', () => ({
  AddThreadsToFolderDialog: () => null,
}))

vi.mock('./EmailFolderDialog', () => {
  type DialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    folder?: {
      id: string
      name: string
    } | null
  }

  const MockFolderIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" data-testid="folder-icon" {...props} />
  )

  const EmailFolderDialog = ({ open, folder }: DialogProps) =>
    open ? <div data-testid="email-folder-dialog">{folder?.name ?? 'nouveau dossier'}</div> : null

  return {
    EmailFolderDialog,
    getFolderColorClass: vi.fn(
      (color: string | null | undefined) => `folder-color-${color ?? 'none'}`
    ),
    getFolderIconComponent: vi.fn(() => MockFolderIcon),
  }
})

import { EmailFoldersView } from './EmailFoldersView'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

function renderEmailFoldersView(initialEntry = '/emails') {
  const client = createQueryClient()
  const onOpenThread = vi.fn()
  const user = userEvent.setup()

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <EmailFoldersView onOpenThread={onOpenThread} />
      </MemoryRouter>
    </QueryClientProvider>
  )

  return { client, onOpenThread, user }
}

describe('EmailFoldersView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState.emailFoldersMode = 'success'
    hookState.folderLinksMode = 'success'
    hookState.supabaseMode = 'success'
  })

  afterEach(() => {
    cleanup()
  })

  it("affiche le chargement des dossiers et l'état sans dossier sélectionné", () => {
    hookState.emailFoldersMode = 'loading'

    renderEmailFoldersView()

    expect(screen.getByRole('heading', { name: 'Mes dossiers' })).toBeInTheDocument()
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sélectionnez un dossier' })).toBeInTheDocument()
    expect(
      screen.getByText(/Créez vos propres dossiers pour organiser vos emails/i)
    ).toBeInTheDocument()
    expect(mockUseEmailFolders).toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rend les dossiers, les compteurs et les fils du dossier actif avec les valeurs métier', async () => {
    const { onOpenThread, user } = renderEmailFoldersView('/emails?folder=f1')

    expect(await screen.findByRole('heading', { name: 'Projet Alpha' })).toBeInTheDocument()
    expect(screen.getByText('Client Beta')).toBeInTheDocument()
    expect(screen.getByText(String(COUNTS.f1))).toBeInTheDocument()
    expect(screen.getByText(`${THREAD_LINKS.length} fils rangés`)).toBeInTheDocument()

    expect(await screen.findByText(THREAD_ROWS[0].last_message_from_name ?? '')).toBeInTheDocument()
    expect(screen.getByText('Analyse réunion')).toBeInTheDocument()
    expect(screen.getByText(THREAD_ROWS[1].ai_generated_title ?? '')).toBeInTheDocument()
    expect(screen.getByText('Non lu')).toBeInTheDocument()
    expect(screen.getByText('Traité')).toBeInTheDocument()
    expect(screen.getAllByText('il y a 2 jours')).toHaveLength(2)

    await act(async () => {
      await user.click(screen.getByText('Analyse réunion'))
    })

    expect(onOpenThread).toHaveBeenCalledTimes(1)
    expect(onOpenThread).toHaveBeenCalledWith(THREAD_ROWS[0].id)
    expect(mockFrom).toHaveBeenCalledWith('email_threads')
  })

  it('filtre les dossiers depuis le champ de recherche', async () => {
    const { user } = renderEmailFoldersView()

    expect(screen.getByText(FOLDERS[0].name)).toBeInTheDocument()
    expect(screen.getByText(FOLDERS[1].name)).toBeInTheDocument()

    await act(async () => {
      await user.type(screen.getByPlaceholderText('Rechercher…'), 'beta')
    })

    expect(screen.queryByText(FOLDERS[0].name)).not.toBeInTheDocument()
    expect(screen.getByText(FOLDERS[1].name)).toBeInTheDocument()
  })

  it("déclenche la mutation de retrait d'un fil sans ouvrir le fil", async () => {
    const { onOpenThread, user } = renderEmailFoldersView('/emails?folder=f1')

    await screen.findByText('Analyse réunion')
    const removeButtons = screen.getAllByRole('button', { name: 'Retirer de ce dossier' })
    const firstRemoveButton = removeButtons.at(0)

    expect(firstRemoveButton).toBeDefined()

    if (firstRemoveButton) {
      await act(async () => {
        await user.click(firstRemoveButton)
      })
    }

    expect(mockRemoveThreadFromFolderMutate).toHaveBeenCalledTimes(1)
    expect(mockRemoveThreadFromFolderMutate).toHaveBeenCalledWith({
      threadId: THREAD_ROWS[0].id,
      folderId: FOLDERS[0].id,
    })
    expect(onOpenThread).not.toHaveBeenCalled()
  })

  it('passe la requête des détails de fils en erreur quand Supabase renvoie une erreur', async () => {
    hookState.supabaseMode = 'error'
    const { client } = renderEmailFoldersView('/emails?folder=f1')

    await waitFor(() => {
      const queries = client.getQueryCache().findAll({ queryKey: ['folder-thread-details'] })

      expect(queries.some((query) => query.state.status === 'error')).toBe(true)
      expect(queries.find((query) => query.state.status === 'error')?.state.error).toMatchObject({
        message: 'x',
      })
    })

    expect(screen.getByText('Ce dossier est vide.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /ajouter des emails/i }).length).toBeGreaterThan(0)
  })
})
