// @vitest-environment jsdom
/**
 * Tests ciblés façade Gestion Drive dans DocumentsPage.
 *
 * Vérifie le câblage du feature flag VITE_DOCUMENTS_BACKEND :
 *  - legacy  → UI historique intacte, AUCUN panneau Drive ;
 *  - azure   → panneau Drive seul, onglets legacy masqués ;
 *  - hybrid  → panneau Drive + UI legacy côte à côte ;
 *  - préservation de ?backend= lors d'un changement d'onglet.
 *
 * La logique de résolution elle-même est testée dans
 * src/lib/drive/driveClient.test.ts — ici on mocke resolveDocumentsBackend
 * pour piloter chaque mode sans dépendre de import.meta.env.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DocumentsPage from './DocumentsPage'

const {
  AUTH_STATE,
  SEARCH_PARAMS_STATE,
  setSearchParamsMock,
  updatePreferenceMock,
  getPreferenceMock,
  useDocumentsMock,
  useEtablissementsWithDocumentsMock,
  useIsMobileMock,
  resolveDocumentsBackendMock,
  drivePanelSpy,
} = vi.hoisted(() => {
  const searchState = new URLSearchParams()
  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    SEARCH_PARAMS_STATE: searchState,
    setSearchParamsMock: vi.fn((next: Record<string, string>) => {
      searchState.set('tab', next.tab)
    }),
    updatePreferenceMock: vi.fn(),
    getPreferenceMock: vi.fn((_key: string, fallback: string) => fallback),
    useDocumentsMock: vi.fn(),
    useEtablissementsWithDocumentsMock: vi.fn(),
    useIsMobileMock: vi.fn(() => false),
    resolveDocumentsBackendMock: vi.fn(() => 'legacy'),
    drivePanelSpy: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [SEARCH_PARAMS_STATE, setSearchParamsMock] as const,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => useIsMobileMock(),
}))

vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    getPreference: getPreferenceMock,
    updatePreference: updatePreferenceMock,
  }),
}))

vi.mock('@/hooks/documents/useDocuments', () => ({
  useDocuments: (...args: unknown[]) => useDocumentsMock(...args),
}))

vi.mock('@/hooks/documents/useEtablissementsWithDocuments', () => ({
  useEtablissementsWithDocuments: () => useEtablissementsWithDocumentsMock(),
}))

// Façade Drive : on pilote le backend résolu, les helpers restent réels.
vi.mock('@/lib/drive/driveClient', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/drive/driveClient')>('@/lib/drive/driveClient')
  return {
    ...actual,
    resolveDocumentsBackend: (...args: unknown[]) => resolveDocumentsBackendMock(...args),
  }
})

vi.mock('@/components/documents/DriveAzurePanel', () => ({
  DriveAzurePanel: ({ backend, className }: { backend: string; className?: string }) => {
    drivePanelSpy({ backend, className })
    return <div data-testid="drive-azure-panel">backend:{backend}</div>
  },
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsContent: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid={`tab-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  FolderOpen: () => <svg data-testid="icon-folder" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Share2: () => <svg data-testid="icon-share" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  Building2: () => <svg data-testid="icon-building" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  FileText: () => <svg data-testid="icon-file-text" />,
}))

vi.mock('@/components/documents/DocumentBrowser', () => ({
  DocumentBrowser: () => <div data-testid="document-browser" />,
}))

vi.mock('@/components/documents/MyDocumentsBrowser', () => ({
  MyDocumentsBrowser: () => <div data-testid="my-documents-browser" />,
}))

vi.mock('@/components/documents/DocumentFolderBrowser', () => ({
  DocumentFolderBrowser: () => <div data-testid="document-folder-browser" />,
}))

vi.mock('@/components/documents/DocumentQuotaIndicator', () => ({
  DocumentQuotaIndicator: () => <div data-testid="quota-indicator" />,
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="desktop-header">{children}</div>
  ),
}))

vi.mock('@/components/documents/DocumentsMobileHeader', () => ({
  DocumentsMobileHeader: () => <div data-testid="mobile-header" />,
}))

vi.mock('@/components/documents/folders/CreateFolderDialog', () => ({
  CreateFolderDialog: () => <div data-testid="create-folder-dialog" />,
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

describe('DocumentsPage — façade Gestion Drive (feature flag)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    SEARCH_PARAMS_STATE.delete('tab')
    SEARCH_PARAMS_STATE.delete('backend')
    getPreferenceMock.mockImplementation((_key: string, fallback: string) => fallback)
    useIsMobileMock.mockReturnValue(false)
    resolveDocumentsBackendMock.mockReturnValue('legacy')
    useDocumentsMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    useEtablissementsWithDocumentsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('mode legacy (défaut) : UI historique intacte, aucun panneau Drive', () => {
    render(<DocumentsPage />, { wrapper: createWrapper() })

    expect(screen.queryByTestId('drive-azure-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('tabs')).toBeInTheDocument()
    expect(screen.getByTestId('tab-etablissements')).toBeInTheDocument()
    expect(screen.getByTestId('tab-corbeille')).toBeInTheDocument()
    expect(drivePanelSpy).not.toHaveBeenCalled()
  })

  it('mode azure : panneau Drive rendu, onglets legacy masqués', () => {
    resolveDocumentsBackendMock.mockReturnValue('azure')

    render(<DocumentsPage />, { wrapper: createWrapper() })

    expect(screen.getByTestId('drive-azure-panel')).toHaveTextContent('backend:azure')
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument()
    expect(drivePanelSpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'azure' }))
  })

  it('mode hybrid : panneau Drive ET UI legacy côte à côte', () => {
    resolveDocumentsBackendMock.mockReturnValue('hybrid')

    render(<DocumentsPage />, { wrapper: createWrapper() })

    expect(screen.getByTestId('drive-azure-panel')).toHaveTextContent('backend:hybrid')
    expect(screen.getByTestId('tabs')).toBeInTheDocument()
    expect(screen.getByTestId('tab-etablissements')).toBeInTheDocument()
  })

  it('le header historique (desktop) reste rendu dans tous les modes', () => {
    for (const backend of ['legacy', 'azure', 'hybrid'] as const) {
      resolveDocumentsBackendMock.mockReturnValue(backend)
      render(<DocumentsPage />, { wrapper: createWrapper() })
      expect(screen.getByTestId('desktop-header')).toBeInTheDocument()
      cleanup()
    }
  })

  it("changement d'onglet sans ?backend= : signature historique préservée", () => {
    resolveDocumentsBackendMock.mockReturnValue('hybrid')
    render(<DocumentsPage />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText(/Mes docs/))

    expect(setSearchParamsMock).toHaveBeenCalledWith({ tab: 'mes-documents' })
    expect(updatePreferenceMock).toHaveBeenCalledWith('documents_tab', 'mes-documents')
  })

  it("changement d'onglet avec ?backend=azure : l'override est conservé", () => {
    SEARCH_PARAMS_STATE.set('backend', 'azure')
    resolveDocumentsBackendMock.mockReturnValue('azure')
    render(<DocumentsPage />, { wrapper: createWrapper() })

    // En mode azure les onglets legacy sont masqués mais les badges du
    // header restent cliquables (navigation conservée).
    fireEvent.click(screen.getByText(/Récents/))

    expect(setSearchParamsMock).toHaveBeenCalledWith({ tab: 'recents', backend: 'azure' })
  })

  it('resolveDocumentsBackend reçoit bien les searchParams de la route', () => {
    render(<DocumentsPage />, { wrapper: createWrapper() })

    expect(resolveDocumentsBackendMock).toHaveBeenCalledWith(SEARCH_PARAMS_STATE)
  })
})
