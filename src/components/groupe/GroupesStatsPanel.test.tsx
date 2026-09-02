/* @vitest-environment jsdom */
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GroupesStatsPanel } from "./GroupesStatsPanel"

const {
  GROUPES,
  EMPTY_GROUPES,
  AUTH_STATE,
  mockFrom,
} = vi.hoisted(() => ({
  GROUPES: [
    {
      id: "g1",
      nom: "Groupe A",
      type: "GHT",
      region: "Île-de-France",
      modules_deployes: ["DPI", "PMSI"],
      progression_moyenne: 80,
      nombre_etablissements: 5,
    },
    {
      id: "g2",
      nom: "Groupe B",
      type: "GHT",
      region: "Occitanie",
      modules_deployes: ["DPI"],
      progression_moyenne: 60,
      nombre_etablissements: 3,
    },
    {
      id: "g3",
      nom: "Groupe C",
      type: "Consortium",
      region: "Île-de-France",
      modules_deployes: ["RIS", "DPI"],
      progression_moyenne: 100,
      nombre_etablissements: 2,
    },
    {
      id: "g4",
      nom: "Groupe D",
      type: "Groupe Cliniques",
      region: "Normandie",
      modules_deployes: [],
      progression_moyenne: 40,
      nombre_etablissements: 4,
    },
  ],
  EMPTY_GROUPES: [],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
}))

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
    const result = { data: null, error: null }
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    }
    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  }
})

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/collapsible", () => {
  const CollapsibleContext = React.createContext<{
    open: boolean
    onOpenChange?: (open: boolean) => void
  }>({ open: false })

  return {
    Collapsible: ({
      children,
      open = false,
      onOpenChange,
    }: {
      children: React.ReactNode
      open?: boolean
      onOpenChange?: (open: boolean) => void
    }) => (
      <CollapsibleContext.Provider value={{ open, onOpenChange }}>
        <div data-testid="collapsible" data-open={String(open)}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    ),
    CollapsibleTrigger: ({
      children,
      asChild,
    }: {
      children: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>
      asChild?: boolean
    }) => {
      const ctx = React.useContext(CollapsibleContext)
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            children.props.onClick?.(event)
            ctx.onOpenChange?.(!ctx.open)
          },
        })
      }
      return (
        <button type="button" onClick={() => ctx.onOpenChange?.(!ctx.open)}>
          {children}
        </button>
      )
    },
    CollapsibleContent: ({
      children,
      className,
    }: {
      children: React.ReactNode
      className?: string
    }) => {
      const ctx = React.useContext(CollapsibleContext)
      if (!ctx.open) return null
      return (
        <div data-testid="collapsible-content" className={className}>
          {children}
        </div>
      )
    },
  }
})

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={value === undefined ? "" : String(value)} className={className} />
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({
    data,
    children,
  }: {
    data?: Array<{ name: string; value: number }>
    children?: React.ReactNode
  }) => <div data-testid="pie" data-count={String(data?.length ?? 0)}>{children}</div>,
  Cell: ({ fill }: { fill?: string }) => <span data-testid="cell" data-fill={fill} />,
  Legend: () => <div data-testid="legend">Legend</div>,
  Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
}))

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    ChevronDown: Icon,
    Building2: Icon,
    MapPin: Icon,
    TrendingUp: Icon,
    Layers: Icon,
  }
})

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("GroupesStatsPanel", () => {
  it("affiche les KPI calculés à partir des groupes", () => {
    render(<GroupesStatsPanel groupes={GROUPES} totalGroupes={12} />, { wrapper: createWrapper() })

    expect(screen.getByText("Groupes")).toBeInTheDocument()
    expect(screen.getByText("GHT")).toBeInTheDocument()
    expect(screen.getByText("Progression")).toBeInTheDocument()
    expect(screen.getByText("Régions")).toBeInTheDocument()

    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("70%")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("ouvre les détails et affiche le graphique, les régions triées et les modules comptés", () => {
    render(<GroupesStatsPanel groupes={GROUPES} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole("button", { name: /voir les détails/i }))

    expect(screen.getByRole("button", { name: /masquer les détails/i })).toBeInTheDocument()
    expect(screen.getByText("Répartition par type")).toBeInTheDocument()
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument()
    expect(screen.getByTestId("pie")).toHaveAttribute("data-count", "3")

    expect(screen.getByText("Top 5 régions")).toBeInTheDocument()
    expect(screen.getByText("Île-de-France")).toBeInTheDocument()
    expect(screen.getByText("Occitanie")).toBeInTheDocument()
    expect(screen.getByText("Normandie")).toBeInTheDocument()

    const progressBars = screen.getAllByTestId("progress")
    expect(progressBars).toHaveLength(3)
    expect(progressBars[0]).toHaveAttribute("data-value", "100")
    expect(progressBars[1]).toHaveAttribute("data-value", "50")
    expect(progressBars[2]).toHaveAttribute("data-value", "50")

    expect(screen.getByText("Modules les plus déployés")).toBeInTheDocument()
    expect(screen.getByText(/DPI/)).toBeInTheDocument()
    expect(screen.getByText(/PMSI/)).toBeInTheDocument()
    expect(screen.getByText(/RIS/)).toBeInTheDocument()

    const badges = screen.getAllByTestId("badge")
    expect(badges).toHaveLength(3)
    expect(badges[0]).toHaveTextContent("DPI")
    expect(badges[0]).toHaveTextContent("(3)")
    expect(badges[1]).toHaveTextContent("PMSI")
    expect(badges[1]).toHaveTextContent("(1)")
    expect(badges[2]).toHaveTextContent("RIS")
    expect(badges[2]).toHaveTextContent("(1)")
  })

  it("affiche les états vides pour les détails quand il n'y a aucune donnée", () => {
    render(<GroupesStatsPanel groupes={EMPTY_GROUPES} />, { wrapper: createWrapper() })

    expect(screen.getByText("0%")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /voir les détails/i }))

    expect(screen.getByText("Aucune région renseignée")).toBeInTheDocument()
    expect(screen.getByText("Aucun module déployé")).toBeInTheDocument()
    expect(screen.getByTestId("pie")).toHaveAttribute("data-count", "0")
  })

  it("rebascule les détails au second clic", () => {
    render(<GroupesStatsPanel groupes={GROUPES} />, { wrapper: createWrapper() })

    const button = screen.getByRole("button", { name: /voir les détails/i })
    fireEvent.click(button)
    expect(screen.getByRole("button", { name: /masquer les détails/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /masquer les détails/i }))
    expect(screen.getByRole("button", { name: /voir les détails/i })).toBeInTheDocument()
    expect(screen.queryByText("Répartition par type")).not.toBeInTheDocument()
  })
})