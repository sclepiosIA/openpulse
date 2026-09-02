import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { DOCS, FOLDERS, mockUseDocuments, mockUseFolders, mockCreateFolder, mockLoadContent } =
  vi.hoisted(() => {
    const DOCS = [
      {
        id: 'doc-1',
        name: 'Rapport annuel.pdf',
        folder_id: null,
        mime_type: 'application/pdf',
        source_type: 'upload',
        storage_path: 'docs/rapport.pdf',
      },
      {
        id: 'doc-2',
        name: 'Notes.html',
        folder_id: 'folder-1',
        mime_type: 'text/html',
        source_type: 'native_editor',
        storage_path: 'docs/notes.html',
      },
    ]
    const FOLDERS = [
      { id: 'folder-1', name: 'Contrats', parent_folder_id: null },
      { id: 'folder-2', name: 'Factures', parent_folder_id: null },
    ]
    const mockCreateFolder = vi.fn()
    const mockLoadContent = vi.fn(async () => '<p>contenu</p>')
    const mockUseDocuments = vi.fn(() => ({
      data: DOCS,
      isLoading: false,
      error: null,
    }))
    const mockUseFolders = vi.fn(() => ({
      folders: FOLDERS,
      isLoading: false,
      createFolder: mockCreateFolder,
      isCreating: false,
    }))
    return { DOCS, FOLDERS, mockUseDocuments, mockUseFolders, mockCreateFolder, mockLoadContent }
  })

vi.mock('@/hooks/documents/useDocuments', () => ({
  useDocuments: mockUseDocuments,
}))

vi.mock('@/hooks/documents/useFolders', () => ({
  useFolders: mockUseFolders,
}))

vi.mock('@/hooks/documents/useNativeDocumentLoad', () => ({
  useNativeDocumentLoad: () => ({ loadContent: mockLoadContent, isLoading: false }),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/types/documents', () => ({
  MIME_TYPE_CATEGORIES: {
    pdf: ['application/pdf'],
    image: ['image/png', 'image/jpeg'],
    word: ['application/msword'],
    excel: ['application/vnd.ms-excel'],
    powerpoint: ['application/vnd.ms-powerpoint'],
    text: ['text/plain'],
    video: ['video/mp4'],
    audio: ['audio/mpeg'],
  },
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: Record<string, unknown>) => <input data-testid="search-input" {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant,
    size,
    ...props
  }: { children?: React.ReactNode; variant?: string; size?: string } & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./DocumentCard', () => ({
  DocumentCard: () => <div data-testid="document-card" />,
}))
vi.mock('./DocumentUpload', () => ({
  DocumentUpload: () => <div data-testid="document-upload" />,
}))
vi.mock('./folders/FolderCard', () => ({
  FolderCard: () => <div data-testid="folder-card" />,
}))
vi.mock('./folders/FolderBreadcrumb', () => ({
  FolderBreadcrumb: () => <div data-testid="folder-breadcrumb" />,
}))
vi.mock('./folders/CreateFolderDialog', () => ({
  CreateFolderDialog: () => null,
}))
vi.mock('./folders/RenameFolderDialog', () => ({
  RenameFolderDialog: () => null,
}))
vi.mock('./folders/DeleteFolderDialog', () => ({
  DeleteFolderDialog: () => null,
}))
vi.mock('./DocumentPreviewDialog', () => ({
  DocumentPreviewDialog: () => null,
}))
vi.mock('./DocSpaceEditorDialog', () => ({
  DocSpaceEditorDialog: () => null,
}))
vi.mock('./dialogs/NewDocumentDialog', () => ({
  NewDocumentDialog: () => null,
}))
vi.mock('./editors/NativeEditorDialog', () => ({
  NativeEditorDialog: () => null,
}))
vi.mock('./views/FolderTreeSidebar', () => ({
  FolderTreeSidebar: () => <div data-testid="folder-tree-sidebar" />,
}))
vi.mock('./views/FinderColumnView', () => ({
  FinderColumnView: () => <div data-testid="finder-column-view" />,
}))
vi.mock('./views/ViewModeSelector', () => ({
  ViewModeSelector: () => <div data-testid="view-mode-selector" />,
}))
vi.mock('./views/DocumentContentPane', () => ({
  DocumentContentPane: () => <div data-testid="document-content-pane" />,
}))
vi.mock('./dialogs/ShareDocumentDialog', () => ({
  ShareDocumentDialog: () => null,
}))
vi.mock('./dialogs/FolderPermissionsDialog', () => ({
  FolderPermissionsDialog: () => null,
}))
vi.mock('./dialogs/ManageGroupsDialog', () => ({
  ManageGroupsDialog: () => null,
}))
vi.mock('./dialogs/NextcloudImportDialog', () => ({
  NextcloudImportDialog: () => null,
}))

import { MyDocumentsBrowser } from './MyDocumentsBrowser'

function renderBrowser(props: { className?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MyDocumentsBrowser {...props} />
    </QueryClientProvider>
  )
}

describe('MyDocumentsBrowser', () => {
  beforeEach(() => {
    localStorage.clear()
    mockUseDocuments.mockClear()
    mockUseFolders.mockClear()
    mockCreateFolder.mockClear()
    mockLoadContent.mockClear()
    mockUseDocuments.mockImplementation(() => ({
      data: DOCS,
      isLoading: false,
      error: null,
    }))
    mockUseFolders.mockImplementation(() => ({
      folders: FOLDERS,
      isLoading: false,
      createFolder: mockCreateFolder,
      isCreating: false,
    }))
  })

  it('rend la vue arborescence par défaut avec le bouton de bascule du panneau', () => {
    renderBrowser()
    expect(screen.getByLabelText('Basculer le panneau')).toBeTruthy()
    expect(screen.getByTestId('folder-tree-sidebar')).toBeTruthy()
    expect(screen.getByTestId('document-content-pane')).toBeTruthy()
  })

  it('persiste les préférences de vue dans le localStorage', () => {
    renderBrowser()
    expect(localStorage.getItem('documents-view-style')).toBe('tree')
    expect(localStorage.getItem('documents-content-mode')).toBe('grid')
    expect(localStorage.getItem('documents-sidebar-collapsed')).toBe('false')
  })

  it("bascule le panneau latéral et persiste l'état réduit", () => {
    renderBrowser()
    const toggle = screen.getByLabelText('Basculer le panneau')
    fireEvent.click(toggle)
    expect(localStorage.getItem('documents-sidebar-collapsed')).toBe('true')
    fireEvent.click(toggle)
    expect(localStorage.getItem('documents-sidebar-collapsed')).toBe('false')
  })

  it('appelle useDocuments avec folderId null (racine) et le tri par défaut', () => {
    renderBrowser()
    expect(mockUseDocuments).toHaveBeenCalledWith(expect.objectContaining({ folderId: null }), {
      field: 'created_at',
      order: 'desc',
    })
  })

  it('appelle useFolders avec le dossier racine (null)', () => {
    renderBrowser()
    expect(mockUseFolders).toHaveBeenCalledWith(null)
  })

  it('restaure les préférences de vue depuis le localStorage', () => {
    localStorage.setItem('documents-sidebar-collapsed', 'true')
    renderBrowser()
    expect(localStorage.getItem('documents-sidebar-collapsed')).toBe('true')
    expect(screen.getByLabelText('Basculer le panneau')).toBeTruthy()
  })

  it("rend toujours la structure de la vue arbre même en cas d'erreur des documents", () => {
    mockUseDocuments.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      error: { message: 'x' },
    }))
    renderBrowser()
    expect(screen.getByTestId('document-content-pane')).toBeTruthy()
    expect(screen.getByLabelText('Basculer le panneau')).toBeTruthy()
  })

  it('rend la structure pendant le chargement des dossiers', () => {
    mockUseFolders.mockImplementation(() => ({
      folders: [],
      isLoading: true,
      createFolder: mockCreateFolder,
      isCreating: false,
    }))
    renderBrowser()
    expect(screen.getByTestId('folder-tree-sidebar')).toBeTruthy()
  })
})
