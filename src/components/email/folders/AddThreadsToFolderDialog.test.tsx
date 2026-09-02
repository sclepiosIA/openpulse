/* @vitest-environment jsdom */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddThreadsToFolderDialog } from './AddThreadsToFolderDialog'

const {
  AUTH_STATE,
  THREADS,
  EMPTY_THREADS,
  addThreadsMutateAsync,
  useThreadFolderMutationsMock,
  sanitizeEmailSubjectMock,
  formatDistanceToNowMock,
  makeBuilder,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const THREADS = [
    {
      id: 't1',
      subject: 'Sujet original 1',
      ai_generated_title: null,
      last_message_date: '2024-01-10T12:00:00.000Z',
      last_message_from_name: 'Alice',
      last_message_from_email: 'alice@test.co',
      unread_count: 2,
    },
    {
      id: 't2',
      subject: 'Sujet original 2',
      ai_generated_title: 'Titre IA 2',
      last_message_date: '2024-01-09T11:00:00.000Z',
      last_message_from_name: null,
      last_message_from_email: 'bob@test.co',
      unread_count: 0,
    },
  ] as const

  const EMPTY_THREADS: Array<{
    id: string
    subject: string | null
    ai_generated_title: string | null
    last_message_date: string
    last_message_from_name: string | null
    last_message_from_email: string | null
    unread_count: number
  }> = []

  const addThreadsMutateAsync = vi.fn(
    async (_vars: { threadIds: string[]; folderId: string }) => undefined
  )

  const useThreadFolderMutationsMock = vi.fn(() => ({
    addThreadsToFolder: {
      mutateAsync: addThreadsMutateAsync,
      isPending: false,
    },
  }))

  const sanitizeEmailSubjectMock = vi.fn((value: string) => `sanitized:${value}`)
  const formatDistanceToNowMock = vi.fn(() => 'il y a 2 jours')

  const makeBuilder = (resultData: unknown, resultError: unknown = null) => {
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
      upsert: vi.fn(),
      or: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then(
        onfulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onrejected?: (reason: unknown) => unknown
      ) {
        return Promise.resolve({ data: resultData, error: resultError }).then(
          onfulfilled,
          onrejected
        )
      },
      catch(onrejected?: (reason: unknown) => unknown) {
        return Promise.resolve({ data: resultData, error: resultError }).catch(onrejected)
      },
    }

    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.gte.mockReturnValue(builder)
    builder.lte.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    builder.insert.mockReturnValue(builder)
    builder.update.mockReturnValue(builder)
    builder.delete.mockReturnValue(builder)
    builder.upsert.mockReturnValue(builder)
    builder.or.mockReturnValue(builder)
    builder.single.mockResolvedValue({ data: resultData, error: resultError })
    builder.maybeSingle.mockResolvedValue({ data: resultData, error: resultError })

    return builder
  }

  const mockFrom = vi.fn(() => makeBuilder(THREADS))

  return {
    AUTH_STATE,
    THREADS,
    EMPTY_THREADS,
    addThreadsMutateAsync,
    useThreadFolderMutationsMock,
    sanitizeEmailSubjectMock,
    formatDistanceToNowMock,
    makeBuilder,
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/email/useThreadFolders', () => ({
  useThreadFolderMutations: useThreadFolderMutationsMock,
}))

vi.mock('@/lib/emailUtils', () => ({
  sanitizeEmailSubject: sanitizeEmailSubjectMock,
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}))

vi.mock('date-fns/locale', () => ({
  fr: {},
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="search-icon" {...props} />,
  Inbox: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="inbox-icon" {...props} />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: string
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    disabled,
    onCheckedChange,
  }: {
    checked?: boolean
    disabled?: boolean
    onCheckedChange?: () => void
    className?: string
  }) => (
    <input
      type="checkbox"
      aria-label="thread-checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={() => onCheckedChange?.()}
      readOnly
    />
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    className?: string
  }) => <input value={value} onChange={onChange} placeholder={placeholder} className={className} />,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderComponent(props?: Partial<React.ComponentProps<typeof AddThreadsToFolderDialog>>) {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <AddThreadsToFolderDialog
        open={true}
        onOpenChange={vi.fn()}
        folderId="folder-1"
        folderName="Dossier projets"
        existingThreadIds={[]}
        {...props}
      />
    </QueryClientProvider>
  )
}

describe('AddThreadsToFolderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockImplementation(() => makeBuilder(THREADS))
    useThreadFolderMutationsMock.mockReturnValue({
      addThreadsToFolder: {
        mutateAsync: addThreadsMutateAsync,
        isPending: false,
      },
    })
  })

  it('affiche le chargement puis la liste des threads avec les valeurs métier attendues', async () => {
    renderComponent()

    expect(screen.getByText('Chargement…')).toBeInTheDocument()

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(mockFrom).toHaveBeenCalledWith('email_threads')
    expect(screen.getByText('bob@test.co')).toBeInTheDocument()
    expect(screen.getByText('Ajouter des emails à « Dossier projets »')).toBeInTheDocument()
    expect(screen.getByText('Non lu')).toBeInTheDocument()
    expect(screen.getByText('sanitized:Sujet original 1')).toBeInTheDocument()
    expect(screen.getByText('sanitized:Titre IA 2')).toBeInTheDocument()
    expect(screen.getAllByText('il y a 2 jours')).toHaveLength(2)
    expect(screen.getByText('Cochez les emails à ranger')).toBeInTheDocument()
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith('Sujet original 1')
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith('Titre IA 2')
  })

  it('grise les threads déjà rangés, permet de sélectionner un thread libre et confirme la mutation', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    renderComponent({
      onOpenChange,
      existingThreadIds: ['t1'],
    })

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Déjà rangé')).toBeInTheDocument()

    const labels = screen.getAllByText(/sanitized:/)
    expect(labels).toHaveLength(2)

    await user.click(labels[1])

    expect(screen.getByText('1 email sélectionné')).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: 'Ranger dans le dossier' })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    await waitFor(() => {
      expect(addThreadsMutateAsync).toHaveBeenCalledWith({
        threadIds: ['t2'],
        folderId: 'folder-1',
      })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("affiche l'état vide quand aucun email n'est trouvé et relance la requête avec la recherche", async () => {
    const user = userEvent.setup()
    mockFrom.mockImplementation(() => makeBuilder(EMPTY_THREADS))

    renderComponent()

    expect(await screen.findByText('Aucun email trouvé')).toBeInTheDocument()
    expect(screen.getByTestId('inbox-icon')).toBeInTheDocument()
    expect(mockFrom).toHaveBeenCalledTimes(1)

    const searchInput = screen.getByPlaceholderText('Rechercher par sujet ou expéditeur…')
    await user.clear(searchInput)
    await user.type(searchInput, 'alice')

    await waitFor(() => {
      expect(mockFrom.mock.calls.length).toBeGreaterThan(1)
    })
  })

  it('ferme via annuler et ne déclenche pas de mutation sans sélection', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    renderComponent({ onOpenChange })

    expect(await screen.findByText('Alice')).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: 'Ranger dans le dossier' })
    expect(confirmButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(addThreadsMutateAsync).not.toHaveBeenCalled()
  })

  it("bascule sur l'état vide quand la requête échoue", async () => {
    mockFrom.mockImplementation(() => makeBuilder(null, { message: 'x' }))

    renderComponent()

    expect(screen.getByText('Chargement…')).toBeInTheDocument()

    expect(await screen.findByText('Aucun email trouvé')).toBeInTheDocument()
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.getByText('Cochez les emails à ranger')).toBeInTheDocument()
    expect(mockFrom).toHaveBeenCalledWith('email_threads')
  })
})
