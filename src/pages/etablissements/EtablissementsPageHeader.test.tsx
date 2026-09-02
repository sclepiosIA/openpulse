import React from "react"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EtablissementsPageHeader } from "./EtablissementsPageHeader"

const {
  mockSetSearchTerm,
  mockOnToggleStats,
  mockOnViewChange,
  mockOnSortChange,
  mockSetIsFiltersDialogOpen,
  mockSetIsDialogOpen,
  mockSetIsImportDialogOpen,
  mockSetIsSelectionMode,
  mockSetShowFillWithAI,
  mockToggleShowOnlyMine,
  mockGetToggleText,
  mockDownloadCsv,
  mockInvalidateQueries,
  mockOnSearchClick,
  mockOnSubmit,
  mockCn,
  AUTH_STATE,
  ROWS,
  mockFrom,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: ROWS[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: ROWS[0], error: null })),
    then: (onFulfilled: (value: { data: typeof ROWS; error: null }) => unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: ROWS, error: null }).catch(onRejected),
  }

  return {
    mockSetSearchTerm: vi.fn(),
    mockOnToggleStats: vi.fn(),
    mockOnViewChange: vi.fn(),
    mockOnSortChange: vi.fn(),
    mockSetIsFiltersDialogOpen: vi.fn(),
    mockSetIsDialogOpen: vi.fn(),
    mockSetIsImportDialogOpen: vi.fn(),
    mockSetIsSelectionMode: vi.fn(),
    mockSetShowFillWithAI: vi.fn(),
    mockToggleShowOnlyMine: vi.fn(),
    mockGetToggleText: vi.fn(() => "Mes établissements"),
    mockDownloadCsv: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockOnSearchClick: vi.fn(),
    mockOnSubmit: vi.fn(async () => {}),
    mockCn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ")),
    AUTH_STATE: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    ROWS: [{ id: "1" }],
    mockFrom: vi.fn(() => builder),
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, placeholder, className }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} />
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock("@/components/layout/ImmersivePageHeader", () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    stats,
    actions,
    children,
  }: {
    title: string
    subtitle: string
    stats: Array<{ label: string; value: number }>
    actions: React.ReactNode
    children: React.ReactNode
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div data-testid="stats">
        {stats.map((s) => (
          <span key={s.label}>
            {s.label}:{s.value}
          </span>
        ))}
      </div>
      <div>{actions}</div>
      <div>{children}</div>
    </section>
  ),
}))

vi.mock("@/components/layout/CRMToolbar", () => ({
  CRMToolbar: ({
    searchSlot,
    unifiedFilters,
    viewSelector,
    sortMenu,
    advancedFilters,
    moreActions,
  }: {
    searchSlot: React.ReactNode
    unifiedFilters: React.ReactNode
    viewSelector: React.ReactNode
    sortMenu: React.ReactNode
    advancedFilters: React.ReactNode
    moreActions: React.ReactNode
  }) => (
    <div>
      <div>{searchSlot}</div>
      <div>{unifiedFilters}</div>
      <div>{viewSelector}</div>
      <div>{sortMenu}</div>
      <div>{advancedFilters}</div>
      <div>{moreActions}</div>
    </div>
  ),
}))

vi.mock("@/components/etablissement/EtablissementsMobileHeader", () => ({
  EtablissementsMobileHeader: ({
    searchValue,
    onSearchChange,
    onCreateClick,
    stats,
    toolbar,
  }: {
    searchValue: string
    onSearchChange: (v: string) => void
    onCreateClick: () => void
    stats: { displayed: number; total: number }
    toolbar: React.ReactNode
  }) => (
    <div>
      <div>mobile-header</div>
      <div>
        displayed:{stats.displayed}/total:{stats.total}
      </div>
      <input aria-label="mobile-search" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} />
      <button type="button" onClick={onCreateClick}>
        mobile-create
      </button>
      <div>{toolbar}</div>
    </div>
  ),
}))

vi.mock("@/components/etablissement/UnifiedFilters", () => ({
  UnifiedFilters: ({ variant }: { variant: string }) => <div>UnifiedFilters-{variant}</div>,
}))

vi.mock("@/components/etablissement/ViewSelector", () => ({
  ViewSelector: ({ currentView, onViewChange }: { currentView: string; onViewChange: (view: string) => void }) => (
    <button type="button" onClick={() => onViewChange("kanban")}>
      ViewSelector-{currentView}
    </button>
  ),
}))

vi.mock("@/components/etablissement/SortMenu", () => ({
  SortMenu: ({
    sortField,
    sortDirection,
    onSortChange,
  }: {
    sortField: string
    sortDirection: string
    onSortChange: (field: string, direction: string) => void
  }) => (
    <button type="button" onClick={() => onSortChange("nom", sortDirection === "asc" ? "desc" : "asc")}>
      SortMenu-{sortField}-{sortDirection}
    </button>
  ),
}))

vi.mock("@/components/etablissement/EtablissementFilters", () => ({
  EtablissementFilters: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      CloseFilters
    </button>
  ),
}))

vi.mock("@/components/etablissement/EtablissementForm", () => ({
  EtablissementForm: ({
    submitLabel,
    isLoading,
    onCancel,
    onSubmit,
  }: {
    submitLabel: string
    isLoading: boolean
    onCancel: () => void
    onSubmit: (data: { nom: string }) => Promise<void>
  }) => (
    <div>
      <span>{submitLabel}</span>
      <span>{isLoading ? "loading" : "idle"}</span>
      <button type="button" onClick={() => void onSubmit({ nom: "Centre Hospitalier" })}>
        SubmitCreate
      </button>
      <button type="button" onClick={onCancel}>
        CancelCreate
      </button>
    </div>
  ),
}))

vi.mock("lucide-react", () => {
  const Icon = () => <svg />
  return {
    Building2: Icon,
    Plus: Icon,
    Search: Icon,
    Filter: Icon,
    Download: Icon,
    Upload: Icon,
    RefreshCw: Icon,
    MoreHorizontal: Icon,
    ChevronDown: Icon,
    BarChart3: Icon,
    CheckSquare: Icon,
    Sparkles: Icon,
    ToggleLeft: Icon,
    ToggleRight: Icon,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function createProps(overrides: Partial<React.ComponentProps<typeof EtablissementsPageHeader>> = {}): React.ComponentProps<typeof EtablissementsPageHeader> {
  return {
    isMobile: false,
    searchTerm: "chu",
    setSearchTerm: mockSetSearchTerm,
    debouncedCount: 12,
    totalCount: 42,
    allEtablissementsData: [{ id: "1" }, { id: "2" }],
    showStats: false,
    onToggleStats: mockOnToggleStats,
    currentView: "list",
    onViewChange: mockOnViewChange,
    sortField: "created_at",
    sortDirection: "asc",
    onSortChange: mockOnSortChange,
    isFiltersDialogOpen: true,
    setIsFiltersDialogOpen: mockSetIsFiltersDialogOpen,
    isDialogOpen: true,
    setIsDialogOpen: mockSetIsDialogOpen,
    isImportDialogOpen: false,
    setIsImportDialogOpen: mockSetIsImportDialogOpen,
    isSelectionMode: false,
    setIsSelectionMode: mockSetIsSelectionMode,
    showFillWithAI: false,
    setShowFillWithAI: mockSetShowFillWithAI,
    canFilterByUser: true,
    showOnlyMine: true,
    toggleShowOnlyMine: mockToggleShowOnlyMine,
    getToggleText: mockGetToggleText,
    downloadEstablishmentsCsv: mockDownloadCsv,
    invalidateQueries: mockInvalidateQueries,
    unifiedFiltersElement: <div>UnifiedFiltersElement</div>,
    onSearchClick: mockOnSearchClick,
    form: {} as React.ComponentProps<typeof EtablissementsPageHeader>["form"],
    onSubmit: mockOnSubmit,
    createPending: false,
    allProfiles: [{ id: "p1" }],
    activeFilterFlags: {
      statutFilter: "actif",
      typeFilter: "public",
      dpiFilter: null,
      regionFilter: "idf",
      commercialFilter: null,
      chefProjetFilter: null,
      csmFilter: "csm-1",
    },
    ...overrides,
  }
}

describe("EtablissementsPageHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rend via renderHook dans QueryClientProvider avec état de chargement puis succès puis erreur", async () => {
    const { result, rerender } = renderHook(
      ({ phase }: { phase: "loading" | "success" | "error" }) => {
        if (phase === "loading") {
          return { isLoading: true, isError: false, data: null as null | { displayed: number; total: number } }
        }
        if (phase === "success") {
          return { isLoading: false, isError: false, data: { displayed: 12, total: 42 } }
        }
        return { isLoading: false, isError: true, data: null as null | { displayed: number; total: number }, error: { message: "x" } }
      },
      {
        initialProps: { phase: "loading" as const },
        wrapper: createWrapper(),
      },
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)

    rerender({ phase: "success" })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual({ displayed: 12, total: 42 })

    rerender({ phase: "error" })
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: "x" })
  })

  it("rend la version desktop avec compteurs, recherche et badge de filtres actifs", () => {
    render(<EtablissementsPageHeader {...createProps()} />, { wrapper: createWrapper() })

    expect(screen.getByText("Établissements")).toBeInTheDocument()
    expect(screen.getByText("Gestion des clients hospitaliers")).toBeInTheDocument()
    expect(screen.getByText("affichés:12")).toBeInTheDocument()
    expect(screen.getByText("total:42")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Rechercher...")).toHaveValue("chu")
    expect(screen.getByText("UnifiedFiltersElement")).toBeInTheDocument()
    expect(screen.getByText("ViewSelector-list")).toBeInTheDocument()
    expect(screen.getByText("SortMenu-created_at-asc")).toBeInTheDocument()
    expect(screen.getByText("Créer")).toBeInTheDocument()
    expect(screen.getByText("idle")).toBeInTheDocument()
    expect(screen.getByText("CloseFilters")).toBeInTheDocument()

    const badges = screen.getAllByText("4")
    expect(badges.length).toBeGreaterThan(0)
  })

  it("déclenche les callbacks desktop métier", async () => {
    render(<EtablissementsPageHeader {...createProps()} />, { wrapper: createWrapper() })

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), { target: { value: "clinique" } })
    expect(mockSetSearchTerm).toHaveBeenCalledWith("clinique")

    fireEvent.click(screen.getByText("CloseFilters"))
    expect(mockSetIsFiltersDialogOpen).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByText("Exporter CSV"))
    expect(mockDownloadCsv).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText("Importer"))
    expect(mockSetIsImportDialogOpen).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByText("Fill with AI"))
    expect(mockSetShowFillWithAI).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByText("Mode sélection"))
    expect(mockSetIsSelectionMode).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByText("Mes établissements"))
    expect(mockToggleShowOnlyMine).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText("Actualiser"))
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText("ViewSelector-list"))
    expect(mockOnViewChange).toHaveBeenCalledWith("kanban")

    fireEvent.click(screen.getByText("SortMenu-created_at-asc"))
    expect(mockOnSortChange).toHaveBeenCalledWith("nom", "desc")

    await act(async () => {
      fireEvent.click(screen.getByText("SubmitCreate"))
    })
    expect(mockOnSubmit).toHaveBeenCalledWith({ nom: "Centre Hospitalier" })

    fireEvent.click(screen.getByText("CancelCreate"))
    expect(mockSetIsDialogOpen).toHaveBeenCalledWith(false)
  })

  it("toggle les KPIs desktop et applique la rotation via cn quand showStats=true", () => {
    render(<EtablissementsPageHeader {...createProps({ showStats: true })} />, { wrapper: createWrapper() })

    const statsButtons = screen.getAllByRole("button")
    fireEvent.click(statsButtons[0])
    expect(mockOnToggleStats).toHaveBeenCalledWith(false)
    expect(mockCn).toHaveBeenCalledWith("h-3 w-3 ml-1 transition-transform", "rotate-180")
  })

  it("rend la version mobile et déclenche ses actions", () => {
    render(
      <EtablissementsPageHeader
        {...createProps({
          isMobile: true,
          debouncedCount: 5,
          totalCount: 9,
          allEtablissementsData: [{ id: "1" }, { id: "2" }, { id: "3" }],
          showStats: false,
          showOnlyMine: false,
        })}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText("mobile-header")).toBeInTheDocument()
    expect(screen.getByText("displayed:5/total:9")).toBeInTheDocument()
    expect(screen.getByText("UnifiedFilters-tabs-only")).toBeInTheDocument()
    expect(screen.getByText("UnifiedFilters-smart-only")).toBeInTheDocument()
    expect(screen.getByText("ViewSelector-list")).toBeInTheDocument()
    expect(screen.getByText("SortMenu-created_at-asc")).toBeInTheDocument()
    expect(screen.getByText("Afficher KPIs")).toBeInTheDocument()
    expect(screen.getByText("Tous les établissements")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("mobile-search"), { target: { value: "hopital nord" } })
    expect(mockSetSearchTerm).toHaveBeenCalledWith("hopital nord")

    fireEvent.click(screen.getByText("mobile-create"))
    expect(mockSetIsDialogOpen).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByText("Afficher KPIs"))
    expect(mockOnToggleStats).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByText("Mode sélection"))
    expect(mockSetIsSelectionMode).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByText("Tous les établissements"))
    expect(mockToggleShowOnlyMine).toHaveBeenCalledTimes(1)
  })

  it("n'affiche pas le filtre utilisateur si canFilterByUser est falsy", () => {
    render(
      <EtablissementsPageHeader
        {...createProps({
          canFilterByUser: false,
          showOnlyMine: false,
        })}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.queryByText("Tous les établissements")).not.toBeInTheDocument()
    expect(screen.queryByText("Mes établissements")).not.toBeInTheDocument()
  })
})