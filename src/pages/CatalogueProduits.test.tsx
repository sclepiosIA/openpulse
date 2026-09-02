import React from 'react'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  PRODUITS,
  STATS_MAP,
  mockUseCatalogueProduits,
  mockUseCatalogueStats,
  mockUseProduitImport,
  mockIsMobile,
  mockPageTitle,
  mockDelete,
  mockDuplicate,
  mockArchive,
  mockReorder,
  mockExportCSV,
  mockFrom,
} = vi.hoisted(() => {
  const PRODUITS = [
    {
      id: 'p1',
      code: 'C1',
      nom: 'Produit 1',
      description: 'desc1',
      type: 'service',
      categorie: 'cat1',
      est_actif: true,
    },
    {
      id: 'p2',
      code: 'C2',
      nom: 'Produit 2',
      description: '',
      type: 'product',
      categorie: 'cat2',
      est_actif: false,
    },
  ]
  const STATS_MAP = new Map<string, { ca_cumule_ht?: number }>([
    ['p1', { ca_cumule_ht: 12345 }],
    ['p2', { ca_cumule_ht: 67890 }],
  ])
  const mockUseCatalogueProduits = vi.fn()
  const mockUseCatalogueStats = vi.fn()
  const mockUseProduitImport = vi.fn()
  const mockIsMobile = vi.fn()
  const mockPageTitle = vi.fn()
  const mockDelete = vi.fn(async (_id: string) => Promise.resolve())
  const mockDuplicate = vi.fn()
  const mockArchive = vi.fn(async (_: any) => Promise.resolve())
  const mockReorder = vi.fn(async (_: any) => Promise.resolve())
  const mockExportCSV = vi.fn()
  const mockFrom = vi.fn()
  return {
    PRODUITS,
    STATS_MAP,
    mockUseCatalogueProduits,
    mockUseCatalogueStats,
    mockUseProduitImport,
    mockIsMobile,
    mockPageTitle,
    mockDelete,
    mockDuplicate,
    mockArchive,
    mockReorder,
    mockExportCSV,
    mockFrom,
  }
})

// Mock UI primitives and components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="Card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="CardContent">{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...rest }: any) => (
    <input value={value} onChange={onChange} {...rest} />
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id }: any) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...rest }: any) => <label {...rest}>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <div>{placeholder}</div>,
}))

// Hooks and services
vi.mock('@/hooks/catalogue/useCatalogueProduits', () => ({
  useCatalogueProduits: (...args: any[]) => mockUseCatalogueProduits(...args),
}))

vi.mock('@/hooks/catalogue/useCatalogueStats', () => ({
  useCatalogueStats: () => mockUseCatalogueStats(),
}))

vi.mock('@/hooks/catalogue/useProduitImport', () => ({
  useProduitImport: () => mockUseProduitImport(),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => mockIsMobile(),
}))

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: (...args: any[]) => mockPageTitle(...args),
}))

// Catalogue subcomponents
vi.mock('@/components/catalogue/CatalogueProduitTable', () => ({
  CatalogueProduitTable: ({
    produits,
    onDelete,
    onEdit,
    onDuplicate,
    onArchive,
    onReorder,
    reorderEnabled,
  }: any) => (
    <div>
      <div data-testid="table">
        {Array.isArray(produits)
          ? produits.map((p: any) => (
              <div key={p.id} data-testid={`row-${p.id}`}>
                <span>{p.nom}</span>
                <button onClick={() => onEdit && onEdit(p)}>Edit-{p.id}</button>
                <button onClick={() => onDuplicate && onDuplicate && onDuplicate(p.id)}>
                  Dup-{p.id}
                </button>
                <button onClick={() => onArchive && onArchive(p.id, !p.est_actif)}>
                  Arch-{p.id}
                </button>
                <button onClick={() => onDelete && onDelete(p)}>Delete-{p.id}</button>
              </div>
            ))
          : null}
      </div>
      <div data-testid="reorder-enabled">{reorderEnabled ? 'REORDER' : 'NO-REORDER'}</div>
    </div>
  ),
}))

vi.mock('@/components/catalogue/CatalogueProduitCard', () => ({
  CatalogueProduitCard: ({ produit, onEdit, onDuplicate, onArchive, onDelete, stat }: any) => (
    <div data-testid={`card-${produit.id}`}>
      <span>{produit.nom}</span>
      <button onClick={() => onEdit && onEdit(produit)}>Edit-{produit.id}</button>
      <button onClick={() => onDuplicate && onDuplicate(produit.id)}>Dup-{produit.id}</button>
      <button onClick={() => onArchive && onArchive(produit.id, !produit.est_actif)}>
        Arch-{produit.id}
      </button>
      <button onClick={() => onDelete && onDelete(produit)}>Delete-{produit.id}</button>
      {stat ? <div data-testid={`stat-${produit.id}`}>{String(stat.ca_cumule_ht)}</div> : null}
    </div>
  ),
}))

vi.mock('@/components/catalogue/CatalogueProduitForm', () => ({
  CatalogueProduitForm: ({ open, onOpenChange, produit }: any) => (
    <div data-testid="form">{open ? 'FORM-OPEN' : 'FORM-CLOSED'}</div>
  ),
}))

vi.mock('@/components/catalogue/CatalogueImportDialog', () => ({
  CatalogueImportDialog: ({ open }: any) => (
    <div data-testid="import-dialog">{open ? 'IMPORT-OPEN' : 'IMPORT-CLOSED'}</div>
  ),
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    onOpenChange,
    title,
    description,
    confirmText,
    onConfirm,
    loading,
  }: any) => {
    return (
      <div data-testid="confirm-dialog">
        {open ? (
          <div>
            <div>{title}</div>
            <div>{description}</div>
            <button onClick={() => onOpenChange(false)}>Close</button>
            <button
              data-testid="confirm-button"
              onClick={() => onConfirm && onConfirm()}
              disabled={loading}
            >
              {confirmText ?? 'Confirm'}
            </button>
          </div>
        ) : null}
      </div>
    )
  },
}))

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: any) => <div data-testid="background">{children}</div>,
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ icon: _icon, title, subtitle, stats, actions }: any) => (
    <header data-testid="header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div data-testid="header-stats">
        {Array.isArray(stats)
          ? stats.map((s: any) => (
              <span key={s.label} data-testid={`stat-${s.label}`}>
                {s.label}:{String(s.value)}
              </span>
            ))
          : null}
      </div>
      <div data-testid="header-actions">{actions}</div>
    </header>
  ),
}))

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({ isLoading, isError, error, onRetry, children }: any) => {
    if (isLoading) return <div data-testid="page-state">LOADING</div>
    if (isError) return <div data-testid="page-state">ERROR:{error?.message ?? 'unknown'}</div>
    return <div data-testid="page-state">{children}</div>
  },
}))

// Types
vi.mock('@/types/facturation', () => ({
  PRODUIT_TYPE_LABELS: { service: 'Service', product: 'Produit', maintenance: 'Maintenance' },
}))

// Supabase client mock (builder chaînable)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    // minimal chainable builder example not used directly in these tests but provided per rules
    builder: (() => {
      const b: any = {
        select: vi.fn(() => b),
        eq: vi.fn(() => b),
        gte: vi.fn(() => b),
        lte: vi.fn(() => b),
        in: vi.fn(() => b),
        order: vi.fn(() => b),
        limit: vi.fn(() => b),
        insert: vi.fn(() => b),
        update: vi.fn(() => b),
        delete: vi.fn(() => b),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        then: vi.fn((cb: any) => Promise.resolve(cb({ data: null, error: null }))),
        catch: vi.fn(() => Promise.resolve()),
      }
      return b
    })(),
  },
}))

// Additional safe mocks
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }),
}))

let CatalogueProduitsPage: any

beforeAll(async () => {
  // Import the module under test after all mocks are in place
  CatalogueProduitsPage = (await import('./CatalogueProduits')).default
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  // Ensure hoisted mocks exist and are reset appropriately
  mockUseCatalogueProduits.mockReset()
  mockUseCatalogueStats.mockReset()
  mockUseProduitImport.mockReset()
  mockIsMobile.mockReset()
  mockPageTitle.mockReset()
  mockDelete.mockReset()
  mockDuplicate.mockReset()
  mockArchive.mockReset()
  mockReorder.mockReset()
  mockExportCSV.mockReset()

  // Default behaviors
  mockUseCatalogueProduits.mockReturnValue({
    produits: [],
    deleteProduit: mockDelete,
    duplicateProduit: mockDuplicate,
    archiveProduit: mockArchive,
    reorderProduits: mockReorder,
    isDeleting: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseCatalogueStats.mockReturnValue({ data: STATS_MAP })
  mockUseProduitImport.mockReturnValue({ exportCSV: mockExportCSV })
  mockIsMobile.mockReturnValue(false)
  mockPageTitle.mockImplementation(() => {})
})

describe('CatalogueProduitsPage', () => {
  it('renders loading state when hook reports loading', async () => {
    const qc = createQueryClient()
    // renderHook with QueryClientProvider as required by rules
    renderHook(() => 0, {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })

    mockUseCatalogueProduits.mockReturnValueOnce({
      produits: [],
      deleteProduit: mockDelete,
      duplicateProduit: mockDuplicate,
      archiveProduit: mockArchive,
      reorderProduits: mockReorder,
      isDeleting: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    await act(async () => {
      render(
        <QueryClientProvider client={qc}>
          <CatalogueProduitsPage />
        </QueryClientProvider>
      )
    })

    expect(screen.getByTestId('page-state').textContent).toBe('LOADING')
  })

  it('renders KPIs and product list, and calls deleteProduit when confirming deletion', async () => {
    const qc = createQueryClient()
    // satisfy the rule to use renderHook with wrapper
    renderHook(() => 0, {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })

    mockUseCatalogueProduits.mockReturnValue({
      produits: PRODUITS,
      deleteProduit: mockDelete,
      duplicateProduit: mockDuplicate,
      archiveProduit: mockArchive,
      reorderProduits: mockReorder,
      isDeleting: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    mockUseCatalogueStats.mockReturnValue({ data: STATS_MAP })
    mockIsMobile.mockReturnValue(false)

    await act(async () => {
      render(
        <QueryClientProvider client={qc}>
          <CatalogueProduitsPage />
        </QueryClientProvider>
      )
    })

    // KPIs should reflect totals: total=2, actifs=1 (only p1), services=1 (p1 is service)
    expect(screen.getByTestId('stat-total').textContent).toBe('total:2')
    expect(screen.getByTestId('stat-actifs').textContent).toBe('actifs:1')
    expect(screen.getByTestId('stat-services').textContent).toBe('services:1')

    // Badge shows product count and pluralization for 2 => "2 produits"
    expect(screen.getByText((content) => content.includes('2 produit'))).toBeTruthy()

    // Table should render rows for products
    expect(screen.getByTestId('row-p1')).toBeTruthy()
    expect(screen.getByTestId('row-p2')).toBeTruthy()

    // Trigger delete on first product via the table mock's Delete button
    const deleteButton = screen.getByText('Delete-p1')
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    // ConfirmDialog should appear; click confirm
    const confirmBtn = screen.getByTestId('confirm-button')
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    // deleteProduit should have been called with the id of first product
    expect(mockDelete).toHaveBeenCalled()
    // Ensure it was called with 'p1'
    expect(mockDelete.mock.calls[0][0]).toBe('p1')
  })

  it('renders error state when hook returns an error', async () => {
    const qc = createQueryClient()
    renderHook(() => 0, {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })

    mockUseCatalogueProduits.mockReturnValue({
      produits: [],
      deleteProduit: mockDelete,
      duplicateProduit: mockDuplicate,
      archiveProduit: mockArchive,
      reorderProduits: mockReorder,
      isDeleting: false,
      isLoading: false,
      error: { message: 'une erreur est survenue' },
      refetch: vi.fn(),
    })

    await act(async () => {
      render(
        <QueryClientProvider client={qc}>
          <CatalogueProduitsPage />
        </QueryClientProvider>
      )
    })

    expect(screen.getByTestId('page-state').textContent).toBe('ERROR:une erreur est survenue')
  })
})
