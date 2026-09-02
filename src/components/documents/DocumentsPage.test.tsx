// @vitest-environment jsdom
import React from 'react'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  renderHook,
  cleanup,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
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
  MY_DOCS,
  RECENT_DOCS,
  DELETED_DOCS,
  EMPTY_DOCS,
  ETABS,
  mockFrom,
  toastSuccessMock,
  toastErrorMock,
  builder,
} = vi.hoisted(() => {
  const MY_DOCS_STABLE = [
    { id: 'doc-1', deleted_at: null, created_by: 'u1', title: 'Doc A' },
    { id: 'doc-2', deleted_at: null, created_by: 'u1', title: 'Doc B' },
  ]
  const RECENT_DOCS_STABLE = [
    { id: 'r1', deleted_at: null, created_at: '2024-01-03' },
    { id: 'r2', deleted_at: null, created_at: '2024-01-02' },
    { id: 'r3', deleted_at: null, created_at: '2024-01-01' },
  ]
  const DELETED_DOCS_STABLE = [
    { id: 'd1', deleted_at: '2024-01-10' },
    { id: 'd2', deleted_at: null },
    { id: 'd3', deleted_at: '2024-01-12' },
  ]
  const EMPTY_DOCS_STABLE: Array<{ id: string; deleted_at: string | null }> = []
  const ETABS_STABLE = [
    { id: 'e1', name: 'Alpha', document_count: 3 },
    { id: 'e2', name: 'Beta', document_count: 4 },
  ]
  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }
  const searchState = new URLSearchParams()
  const setSearchParams = vi.fn((next: Record<string, string>) => {
    searchState.set('tab', next.tab)
  })
  const getPreference = vi.fn((_key: string, fallback: string) => fallback)
  const updatePreference = vi.fn()
  const useDocumentsFn = vi.fn()
  const useEtabsFn = vi.fn()
  const useIsMobileFn = vi.fn(() => false)
  const success = vi.fn()
  const error = vi.fn()

  const chainBuilder: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: (onFulfilled?: (value: { data: null; error: null }) => unknown) => Promise<unknown>
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {} as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: (onFulfilled?: (value: { data: null; error: null }) => unknown) => Promise<unknown>
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  }

  chainBuilder.select = vi.fn(() => chainBuilder)
  chainBuilder.eq = vi.fn(() => chainBuilder)
  chainBuilder.gte = vi.fn(() => chainBuilder)
  chainBuilder.lte = vi.fn(() => chainBuilder)
  chainBuilder.in = vi.fn(() => chainBuilder)
  chainBuilder.order = vi.fn(() => chainBuilder)
  chainBuilder.limit = vi.fn(() => chainBuilder)
  chainBuilder.insert = vi.fn(() => chainBuilder)
  chainBuilder.update = vi.fn(() => chainBuilder)
  chainBuilder.delete = vi.fn(() => chainBuilder)
  chainBuilder.single = vi.fn(async () => ({ data: null, error: null }))
  chainBuilder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  chainBuilder.then = (onFulfilled) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  chainBuilder.catch = (onRejected) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)

  const from = vi.fn(() => chainBuilder)

  return {
    AUTH_STATE: AUTH,
    SEARCH_PARAMS_STATE: searchState,
    setSearchParamsMock: setSearchParams,
    updatePreferenceMock: updatePreference,
    getPreferenceMock: getPreference,
    useDocumentsMock: useDocumentsFn,
    useEtablissementsWithDocumentsMock: useEtabsFn,
    useIsMobileMock: useIsMobileFn,
    MY_DOCS: MY_DOCS_STABLE,
    RECENT_DOCS: RECENT_DOCS_STABLE,
    DELETED_DOCS: DELETED_DOCS_STABLE,
    EMPTY_DOCS: EMPTY_DOCS_STABLE,
    ETABS: ETABS_STABLE,
    mockFrom: from,
    toastSuccessMock: success,
    toastErrorMock: error,
    builder: chainBuilder,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
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

vi.mock('@/lib/drive/driveClient', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/drive/driveClient')>('@/lib/drive/driveClient')
  return { ...actual, resolveDocumentsBackend: () => 'legacy' }
})

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
  DocumentBrowser: ({ showUpload }: { showUpload?: boolean }) => (
    <div data-testid="document-browser">showUpload:{String(showUpload)}</div>
  ),
}))

vi.mock('@/components/documents/MyDocumentsBrowser', () => ({
  MyDocumentsBrowser: () => <div data-testid="my-documents-browser">MyDocumentsBrowser</div>,
}))

vi.mock('@/components/documents/DocumentFolderBrowser', () => ({
  DocumentFolderBrowser: () => (
    <div data-testid="document-folder-browser">DocumentFolderBrowser</div>
  ),
}))

vi.mock('@/components/documents/DocumentQuotaIndicator', () => ({
  DocumentQuotaIndicator: ({ className }: { className?: string }) => (
    <div data-testid="quota-indicator">{className ?? 'no-class'}</div>
  ),
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    stats,
    onSearchClick,
    actions,
    children,
  }: {
    title: string
    subtitle: string
    stats: Array<{ label: string; value: number; highlight?: boolean }>
    onSearchClick: () => void
    actions: React.ReactNode
    children: React.ReactNode
  }) => (
    <div data-testid="desktop-header">
      <div>{title}</div>
      <div>{subtitle}</div>
      <div data-testid="stat-total">
        {stats[0]?.label}:{stats[0]?.value}
      </div>
      <div data-testid="stat-recents">
        {stats[1]?.label}:{stats[1]?.value}
      </div>
      <button type="button" onClick={onSearchClick}>
        search
      </button>
      <div data-testid="header-actions">{actions}</div>
      <div>{children}</div>
    </div>
  ),
}))

vi.mock('@/components/documents/DocumentsMobileHeader', () => ({
  DocumentsMobileHeader: ({
    totalDocs,
    showGlobalNav,
    activeTab,
    onTabChange,
    tabCounts,
    onSearch,
  }: {
    totalDocs: number
    showGlobalNav: boolean
    activeTab: string
    onTabChange: (tab: string) => void
    tabCounts: Record<string, number>
    onSearch: () => void
  }) => (
    <div data-testid="mobile-header">
      <div data-testid="mobile-total">{String(totalDocs)}</div>
      <div data-testid="mobile-global-nav">{String(showGlobalNav)}</div>
      <div data-testid="mobile-active-tab">{activeTab}</div>
      <div data-testid="mobile-count-etabs">{String(tabCounts.etablissements)}</div>
      <div data-testid="mobile-count-my">{String(tabCounts['mes-documents'])}</div>
      <div data-testid="mobile-count-recents">{String(tabCounts.recents)}</div>
      <div data-testid="mobile-count-bin">{String(tabCounts.corbeille)}</div>
      <button type="button" onClick={() => onTabChange('recents')}>
        go-recents
      </button>
      <button type="button" onClick={onSearch}>
        mobile-search
      </button>
    </div>
  ),
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

describe('DocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    SEARCH_PARAMS_STATE.delete('tab')
    getPreferenceMock.mockImplementation((_key: string, fallback: string) => fallback)
    useIsMobileMock.mockReturnValue(false)
    useDocumentsMock.mockImplementation((filters?: unknown, orderBy?: unknown, limit?: unknown) => {
      if (
        filters &&
        typeof filters === 'object' &&
        filters !== null &&
        'showDeleted' in (filters as Record<string, unknown>)
      ) {
        return { data: DELETED_DOCS, isLoading: false, isError: false }
      }
      if (orderBy && limit === 10) {
        return { data: RECENT_DOCS, isLoading: false, isError: false }
      }
      return { data: MY_DOCS, isLoading: false, isError: false }
    })
    useEtablissementsWithDocumentsMock.mockReturnValue({
      data: ETABS,
      isLoading: false,
      isError: false,
    })
    builder.single.mockResolvedValue({ data: null, error: null })
    builder.maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()
  })

  it("affiche les statistiques métier correctes sur desktop et gère le changement d'onglet", async () => {
    render(<DocumentsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('desktop-header')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByTestId('stat-total')).toHaveTextContent('total:9')
      expect(screen.getByTestId('stat-recents')).toHaveTextContent('récents:3')
    })

    expect(screen.getByRole('tab', { name: 'Étab.7' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mes docs2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Récents3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Corbeille2' })).toBeInTheDocument()
    expect(screen.getByTestId('header-actions')).toHaveTextContent('hidden md:block w-48')

    fireEvent.click(screen.getByRole('tab', { name: 'Mes docs2' }))

    await waitFor(() => {
      expect(setSearchParamsMock).toHaveBeenCalledWith({ tab: 'mes-documents' })
      expect(updatePreferenceMock).toHaveBeenCalledWith('documents_tab', 'mes-documents')
    })

    await waitFor(() => {
      expect(useDocumentsMock).toHaveBeenCalledWith({ createdBy: undefined })
      expect(useDocumentsMock).toHaveBeenCalledWith(
        undefined,
        { field: 'created_at', order: 'desc' },
        10
      )
      expect(useDocumentsMock).toHaveBeenCalledWith({ showDeleted: true })
      expect(useEtablissementsWithDocumentsMock).toHaveBeenCalled()
    })
  })

  it("priorise l'onglet URL sur la préférence sauvegardée et rend le header mobile avec les bons compteurs", async () => {
    SEARCH_PARAMS_STATE.set('tab', 'corbeille')
    getPreferenceMock.mockReturnValue('mes-documents')
    useIsMobileMock.mockReturnValue(true)

    render(<DocumentsPage isPWAMode />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-total')).toHaveTextContent('9')
      expect(screen.getByTestId('mobile-global-nav')).toHaveTextContent('false')
      expect(screen.getByTestId('mobile-active-tab')).toHaveTextContent('corbeille')
      expect(screen.getByTestId('mobile-count-etabs')).toHaveTextContent('7')
      expect(screen.getByTestId('mobile-count-my')).toHaveTextContent('2')
      expect(screen.getByTestId('mobile-count-recents')).toHaveTextContent('3')
      expect(screen.getByTestId('mobile-count-bin')).toHaveTextContent('2')
    })

    fireEvent.click(screen.getByText('go-recents'))

    await waitFor(() => {
      expect(setSearchParamsMock).toHaveBeenCalledWith({ tab: 'recents' })
      expect(updatePreferenceMock).toHaveBeenCalledWith('documents_tab', 'recents')
    })
  })

  it('déclenche la recherche clavier meta+k depuis le header', async () => {
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

    render(<DocumentsPage />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText('search'))

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledTimes(1)
    })

    const event = dispatchSpy.mock.calls[0]?.[0]
    expect(event).toBeInstanceOf(KeyboardEvent)
    expect((event as KeyboardEvent).key).toBe('k')
    expect((event as KeyboardEvent).metaKey).toBe(true)
  })

  it("affiche l'état métier de la corbeille vide quand aucun document supprimé n'existe", async () => {
    useDocumentsMock.mockImplementation((filters?: unknown, orderBy?: unknown, limit?: unknown) => {
      if (
        filters &&
        typeof filters === 'object' &&
        filters !== null &&
        'showDeleted' in (filters as Record<string, unknown>)
      ) {
        return { data: EMPTY_DOCS, isLoading: false, isError: false }
      }
      if (orderBy && limit === 10) {
        return { data: RECENT_DOCS, isLoading: false, isError: false }
      }
      return { data: MY_DOCS, isLoading: false, isError: false }
    })
    SEARCH_PARAMS_STATE.set('tab', 'corbeille')

    render(<DocumentsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Corbeille vide')).toBeInTheDocument()
      expect(screen.getByText(/seront définitivement effacés après 30 jours/i)).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Corbeille0' })).toBeInTheDocument()
    })
  })

  it('couvre loading puis succès puis erreur avec renderHook et QueryClientProvider', async () => {
    const wrapper = createWrapper()

    let resolveLoadingQuery!: (value: typeof MY_DOCS) => void
    const loadingPromise = new Promise<typeof MY_DOCS>((resolve) => {
      resolveLoadingQuery = resolve
    })

    const loadingQuery = renderHook(
      () =>
        useQuery({
          queryKey: ['loading-query', 'documents-page', 'controlled'],
          queryFn: () => loadingPromise,
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(loadingQuery.result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveLoadingQuery(MY_DOCS)
      await loadingPromise
    })

    await waitFor(() => {
      expect(loadingQuery.result.current.isSuccess).toBe(true)
    })

    expect(loadingQuery.result.current.data).toBe(MY_DOCS)
    expect(loadingQuery.result.current.data).toHaveLength(2)
    expect(loadingQuery.result.current.data?.[0]?.title).toBe('Doc A')

    const successMutation = vi.fn(async (payload: { id: string; tab: string }) => ({
      data: payload,
      error: null,
    }))
    const successHook = renderHook(
      () =>
        useMutation({
          mutationFn: successMutation,
        }),
      { wrapper }
    )

    await act(async () => {
      await successHook.result.current.mutateAsync({ id: 'u1', tab: 'mes-documents' })
    })

    await waitFor(() => {
      expect(successHook.result.current.isSuccess).toBe(true)
    })

    expect(successMutation).toHaveBeenCalledWith({ id: 'u1', tab: 'mes-documents' })
    expect(successHook.result.current.data).toEqual({
      data: { id: 'u1', tab: 'mes-documents' },
      error: null,
    })

    const mutationError = { message: 'x' }
    const errorHook = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw mutationError
          },
        }),
      { wrapper }
    )

    await act(async () => {
      try {
        await errorHook.result.current.mutateAsync({ id: 'bad' })
      } catch {
        // L'erreur est attendue : elle permet de vérifier l'état métier isError.
      }
    })

    await waitFor(() => {
      expect(errorHook.result.current.isError).toBe(true)
    })

    expect(errorHook.result.current.error).toEqual(mutationError)
  })
})
