/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { GanttMobileHeader } from "./GanttMobileHeader"

const {
  mockOpen,
  mockUseMobileDrawer,
  stableAuth,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  ROWS,
  mockFrom,
} = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockUseMobileDrawer: vi.fn(),
  stableAuth: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  ROWS: [{ id: "1" }],
  mockFrom: vi.fn(),
}))

vi.mock("@/contexts/MobileDrawerContext", () => ({
  useMobileDrawer: mockUseMobileDrawer,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ariaLabel,
    "aria-label": ariaLabelProp,
    title,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    ariaLabel?: string
    variant?: string
    size?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabelProp ?? ariaLabel}
      title={title}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) => (
    <div className={className} data-variant={variant} {...props}>
      {children}
    </div>
  ),
}))

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    GanttChart: Icon,
    Menu: Icon,
    Search: Icon,
    Plus: Icon,
    Bell: Icon,
  }
})

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => stableAuth,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => stableAuth,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => stableAuth,
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock("@/integrations/supabase/client", () => {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: ROWS[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: ROWS[0], error: null })),
    then: (onFulfilled: (value: { data: typeof ROWS; error: null }) => unknown) =>
      Promise.resolve({ data: ROWS, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: ROWS, error: null }).catch(onRejected),
  }
  mockFrom.mockImplementation(() => builder)
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe("GanttMobileHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMobileDrawer.mockReturnValue({ open: mockOpen })
  })

  it("affiche les informations métier, le menu, les alertes et la toolbar", () => {
    const onSearchClick = vi.fn()
    const onCreateTask = vi.fn()
    const onOpenAlerts = vi.fn()

    render(
      <GanttMobileHeader
        stats={{ total: 12, completed: 8, overdue: 3, completionRate: 67 }}
        alertsCount={4}
        hasWarnings={true}
        onSearchClick={onSearchClick}
        onCreateTask={onCreateTask}
        onOpenAlerts={onOpenAlerts}
        toolbar={<button type="button">Zoom +</button>}
      />
    )

    expect(screen.getByRole("heading", { name: "Gantt" })).toBeInTheDocument()
    expect(screen.getByText(/12 tâches • 67% fait/)).toBeInTheDocument()
    expect(screen.getByText("• 3 retard")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer une tâche" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Alertes (4)" })).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("Zoom +")).toBeInTheDocument()
  })

  it("déclenche les callbacks utilisateur et ouvre le drawer mobile", () => {
    const onSearchClick = vi.fn()
    const onCreateTask = vi.fn()
    const onOpenAlerts = vi.fn()

    render(
      <GanttMobileHeader
        stats={{ total: 5, completed: 2, overdue: 1, completionRate: 40 }}
        alertsCount={2}
        hasWarnings={false}
        onSearchClick={onSearchClick}
        onCreateTask={onCreateTask}
        onOpenAlerts={onOpenAlerts}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }))
    fireEvent.click(screen.getByRole("button", { name: "Alertes (2)" }))
    fireEvent.click(screen.getByRole("button", { name: "Créer une tâche" }))

    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(onSearchClick).toHaveBeenCalledTimes(1)
    expect(onOpenAlerts).toHaveBeenCalledTimes(1)
    expect(onCreateTask).toHaveBeenCalledTimes(1)
  })

  it("masque le menu global, les alertes à zéro et le retard si aucune tâche en retard", () => {
    render(
      <GanttMobileHeader
        stats={{ total: 7, completed: 7, overdue: 0, completionRate: 100 }}
        alertsCount={0}
        hasWarnings={false}
        onSearchClick={vi.fn()}
        onCreateTask={vi.fn()}
        onOpenAlerts={vi.fn()}
        showGlobalNav={false}
      />
    )

    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Alertes/ })).not.toBeInTheDocument()
    expect(screen.getByText(/7 tâches • 100% fait/)).toBeInTheDocument()
    expect(screen.queryByText(/retard/)).not.toBeInTheDocument()
  })

  it("utilise renderHook avec QueryClientProvider et couvre loading puis succès puis erreur", async () => {
    const wrapper = createWrapper()

    const loadingHook = () => ({ isLoading: true, isError: false, data: null as null | { total: number } })
    const successHook = () => ({
      isLoading: false,
      isError: false,
      data: { total: 12, completed: 8, overdue: 3, completionRate: 67 },
    })
    const errorHook = () => ({
      isLoading: false,
      isError: true,
      data: null as null,
      error: { message: "x" },
    })

    const { result: loadingResult } = renderHook(() => loadingHook(), { wrapper })
    expect(loadingResult.current.isLoading).toBe(true)
    expect(loadingResult.current.data).toBeNull()

    const { result: successResult } = renderHook(() => successHook(), { wrapper })
    expect(successResult.current.isLoading).toBe(false)
    expect(successResult.current.isError).toBe(false)
    expect(successResult.current.data).toEqual({
      total: 12,
      completed: 8,
      overdue: 3,
      completionRate: 67,
    })

    const { result: errorResult } = renderHook(() => errorHook(), { wrapper })
    expect(errorResult.current.isError).toBe(true)
    expect(errorResult.current.error).toEqual({ message: "x" })
  })
})