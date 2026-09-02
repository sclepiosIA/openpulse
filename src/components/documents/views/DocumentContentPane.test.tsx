import React from 'react'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  stableAuth,
  mockUseFolders,
  mockUseDocuments,
  mockIsNextcloudFolderId,
  mockOnFolderClick,
  mockOnFolderRename,
  mockOnFolderDelete,
  mockOnDocumentPreview,
  mockOnDocumentEdit,
  mockFrom,
} = vi.hoisted(() => {
  const createThenableBuilder = () => {
    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      overlap: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      like: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: vi.fn((onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
      ),
      catch: vi.fn((onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected)),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createThenableBuilder())

  return {
    stableAuth: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockUseFolders: vi.fn(),
    mockUseDocuments: vi.fn(),
    mockIsNextcloudFolderId: vi.fn(),
    mockOnFolderClick: vi.fn(),
    mockOnFolderRename: vi.fn(),
    mockOnFolderDelete: vi.fn(),
    mockOnDocumentPreview: vi.fn(),
    mockOnDocumentEdit: vi.fn(),
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: stableAuth.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: stableAuth.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuth,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}))

vi.mock('../DocumentUpload', () => ({
  DocumentUpload: ({ options }: { options: { folderId: string | null } }) => (
    <div data-testid="document-upload">upload:{String(options.folderId)}</div>
  ),
}))

vi.mock('../folders/CreateFolderDialog', () => ({
  CreateFolderDialog: ({
    parentFolderId,
    trigger,
  }: {
    parentFolderId: string | null
    trigger: React.ReactNode
  }) => (
    <div data-testid="create-folder-dialog">
      <div>parent:{String(parentFolderId)}</div>
      {trigger}
    </div>
  ),
}))

vi.mock('../folders/FolderCard', () => ({
  FolderCard: ({
    folder,
    onClick,
    onRename,
    onDelete,
    viewMode,
  }: {
    folder: { id: string; name?: string }
    onClick: () => void
    onRename: () => void
    onDelete: () => void
    viewMode: 'grid' | 'list'
  }) => (
    <div data-testid={`folder-card-${folder.id}`} data-view={viewMode}>
      <div>{folder.name ?? folder.id}</div>
      <button type="button" onClick={onClick}>
        open-folder
      </button>
      <button type="button" onClick={onRename}>
        rename-folder
      </button>
      <button type="button" onClick={onDelete}>
        delete-folder
      </button>
    </div>
  ),
}))

vi.mock('../DocumentCard', () => ({
  DocumentCard: ({
    document,
    onPreview,
    onEdit,
    viewMode,
    currentFolderId,
  }: {
    document: { id: string; title?: string; folder_id?: string | null }
    onPreview: (doc: unknown) => void
    onEdit: (doc: unknown) => void
    viewMode: 'grid' | 'list'
    currentFolderId: string | null
  }) => (
    <div data-testid={`document-card-${document.id}`} data-view={viewMode}>
      <div>{document.title ?? document.id}</div>
      <div>currentFolder:{String(currentFolderId)}</div>
      <button type="button" onClick={() => onPreview(document)}>
        preview
      </button>
      <button type="button" onClick={() => onEdit(document)}>
        edit
      </button>
    </div>
  ),
}))

vi.mock('../NextcloudContentPane', () => ({
  NextcloudContentPane: ({
    folderId,
    viewMode,
    onFolderClick,
    className,
  }: {
    folderId: string
    viewMode: 'grid' | 'list'
    onFolderClick: (id: string) => void
    className?: string
  }) => (
    <div data-testid="nextcloud-pane" data-folderid={folderId} data-view={viewMode} data-classname={className ?? ''}>
      <button type="button" onClick={() => onFolderClick('nc-child')}>
        open-nextcloud-child
      </button>
    </div>
  ),
}))

vi.mock('@/hooks/documents/useFolders', () => ({
  useFolders: (...args: unknown[]) => mockUseFolders(...args),
}))

vi.mock('@/hooks/documents/useDocuments', () => ({
  useDocuments: (...args: unknown[]) => mockUseDocuments(...args),
}))

vi.mock('@/hooks/documents/useNextcloudFolderTree', () => ({
  isNextcloudFolderId: (...args: unknown[]) => mockIsNextcloudFolderId(...args),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

import { DocumentContentPane } from './DocumentContentPane'

describe('DocumentContentPane', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche le loader pendant le chargement', () => {
    mockIsNextcloudFolderId.mockReturnValue(false)
    mockUseFolders.mockReturnValue({ folders: [], isLoading: true })
    mockUseDocuments.mockReturnValue({ data: [], isLoading: false })

    const { container } = renderWithClient(
      <DocumentContentPane
        folderId={null}
        viewMode="grid"
        onFolderClick={mockOnFolderClick}
        onFolderRename={mockOnFolderRename}
        onFolderDelete={mockOnFolderDelete}
        onDocumentPreview={mockOnDocumentPreview}
        onDocumentEdit={mockOnDocumentEdit}
        className="pane"
      />
    )

    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText('Ce dossier est vide')).toBeNull()
    expect(screen.queryByTestId('scroll-area')).toBeNull()
  })

  it('succès: affiche dossiers + documents filtrés et déclenche les callbacks', async () => {
    mockIsNextcloudFolderId.mockReturnValue(false)

    const folders = [
      { id: 'f1', name: 'Folder One' },
      { id: 'f2', name: 'Folder Two' },
    ]
    const documents = [
      { id: 'd1', title: 'Doc One', folder_id: 'f1' },
      { id: 'd2', title: 'Doc Two', folder_id: 'f2' },
      { id: 'd3', title: 'Root Doc', folder_id: null },
    ]

    mockUseFolders.mockReturnValue({ folders, isLoading: false })
    mockUseDocuments.mockReturnValue({ data: documents, isLoading: false })

    renderWithClient(
      <DocumentContentPane
        folderId="f1"
        viewMode="list"
        filters={{ q: 'x' } as unknown as Record<string, unknown>}
        sort={{ field: 'created_at', order: 'desc' } as unknown as { field: string; order: string }}
        onFolderClick={mockOnFolderClick}
        onFolderRename={mockOnFolderRename}
        onFolderDelete={mockOnFolderDelete}
        onDocumentPreview={mockOnDocumentPreview}
        onDocumentEdit={mockOnDocumentEdit}
      />
    )

    expect(screen.getByTestId('scroll-area')).toBeInTheDocument()
    expect(screen.getByText('Dossiers')).toBeInTheDocument()
    expect(screen.getAllByTestId('badge')[0]?.textContent).toBe('2')
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getAllByTestId('badge')[1]?.textContent).toBe('1')

    expect(screen.getByTestId('folder-card-f1')).toBeInTheDocument()
    expect(screen.getByTestId('folder-card-f2')).toBeInTheDocument()

    expect(screen.getByTestId('document-card-d1')).toBeInTheDocument()
    expect(screen.queryByTestId('document-card-d2')).toBeNull()
    expect(screen.queryByTestId('document-card-d3')).toBeNull()

    await act(async () => {
      fireEvent.click(within(screen.getByTestId('folder-card-f1')).getByText('open-folder'))
    })
    expect(mockOnFolderClick).toHaveBeenCalledTimes(1)
    expect(mockOnFolderClick).toHaveBeenCalledWith(folders[0])

    await act(async () => {
      fireEvent.click(within(screen.getByTestId('folder-card-f1')).getByText('rename-folder'))
    })
    expect(mockOnFolderRename).toHaveBeenCalledTimes(1)
    expect(mockOnFolderRename).toHaveBeenCalledWith(folders[0])

    await act(async () => {
      fireEvent.click(within(screen.getByTestId('folder-card-f1')).getByText('delete-folder'))
    })
    expect(mockOnFolderDelete).toHaveBeenCalledTimes(1)
    expect(mockOnFolderDelete).toHaveBeenCalledWith(folders[0])

    await act(async () => {
      fireEvent.click(within(screen.getByTestId('document-card-d1')).getByText('preview'))
    })
    expect(mockOnDocumentPreview).toHaveBeenCalledTimes(1)
    expect(mockOnDocumentPreview).toHaveBeenCalledWith(documents[0])

    await act(async () => {
      fireEvent.click(within(screen.getByTestId('document-card-d1')).getByText('edit'))
    })
    expect(mockOnDocumentEdit).toHaveBeenCalledTimes(1)
    expect(mockOnDocumentEdit).toHaveBeenCalledWith(documents[0])

    expect(mockUseFolders).toHaveBeenCalledWith('f1')
    expect(mockUseDocuments).toHaveBeenCalledTimes(1)
    expect(mockUseDocuments.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ folderId: 'f1', q: 'x' }))
    expect(mockUseDocuments.mock.calls[0]?.[1]).toEqual({ field: 'created_at', order: 'desc' })
  })

  it("erreur: si les hooks renvoient isError, le composant ne doit pas rester en loader (et doit rendre l'état vide si aucune donnée)", () => {
    mockIsNextcloudFolderId.mockReturnValue(false)
    mockUseFolders.mockReturnValue({ folders: [], isLoading: false, isError: true, error: { message: 'x' } })
    mockUseDocuments.mockReturnValue({ data: [], isLoading: false, isError: true, error: { message: 'x' } })

    const { container } = renderWithClient(
      <DocumentContentPane
        folderId={null}
        viewMode="grid"
        onFolderClick={mockOnFolderClick}
        onFolderRename={mockOnFolderRename}
        onFolderDelete={mockOnFolderDelete}
        onDocumentPreview={mockOnDocumentPreview}
        onDocumentEdit={mockOnDocumentEdit}
      />
    )

    expect(container.querySelector('.animate-spin')).toBeNull()
    expect(screen.getByText('Ce dossier est vide')).toBeInTheDocument()
    expect(screen.getByTestId('create-folder-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('document-upload').textContent).toBe('upload:null')
  })

  it('si folderId est un dossier Nextcloud, rend NextcloudContentPane et mappe onFolderClick', async () => {
    mockIsNextcloudFolderId.mockReturnValue(true)

    renderWithClient(
      <DocumentContentPane
        folderId="nc:root"
        viewMode="grid"
        onFolderClick={mockOnFolderClick}
        onFolderRename={mockOnFolderRename}
        onFolderDelete={mockOnFolderDelete}
        onDocumentPreview={mockOnDocumentPreview}
        onDocumentEdit={mockOnDocumentEdit}
        className="cls"
      />
    )

    const pane = screen.getByTestId('nextcloud-pane')
    expect(pane.getAttribute('data-folderid')).toBe('nc:root')
    expect(pane.getAttribute('data-view')).toBe('grid')
    expect(pane.getAttribute('data-classname')).toBe('cls')

    await act(async () => {
      fireEvent.click(screen.getByText('open-nextcloud-child'))
    })

    expect(mockOnFolderClick).toHaveBeenCalledTimes(1)
    expect(mockOnFolderClick).toHaveBeenCalledWith({ id: 'nc-child' })
    expect(mockUseFolders).not.toHaveBeenCalled()
    expect(mockUseDocuments).not.toHaveBeenCalled()
  })
})