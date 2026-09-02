import React from "react"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"

// Stable constants and mocks
const { INITIAL_SEARCH_PARAMS, SET_SEARCH_PARAMS, GROUPS } = vi.hoisted(() => {
  const initial = new URLSearchParams() // start empty
  const setFn = vi.fn()
  const now = Date.now()
  const g1 = {
    id: "1",
    created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    type: "GHT",
    nombre_etablissements: 3,
    name: "G1",
  }
  const g2 = {
    id: "2",
    created_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days ago
    type: "Autre",
    nombre_etablissements: 10,
    name: "G2",
  }
  const g3 = {
    id: "3",
    created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    type: "Groupe Cliniques",
    nombre_etablissements: 7,
    name: "G3",
  }
  return {
    INITIAL_SEARCH_PARAMS: initial,
    SET_SEARCH_PARAMS: setFn,
    GROUPS: [g1, g2, g3],
  }
})

// Mock react-router-dom (useSearchParams + safeguard useNavigate)
vi.mock("react-router-dom", () => {
  return {
    useSearchParams: () => {
      return [INITIAL_SEARCH_PARAMS, SET_SEARCH_PARAMS]
    },
    useNavigate: vi.fn(),
  }
})

// Mock UI components and utilities
vi.mock("@/components/ui/button", () => {
  return {
    Button: ({ children, ...props }: any) => {
      // spread props so className and onClick exist on DOM node
      return (
        // @ts-ignore
        <button data-testid="btn" {...props}>
          {children}
        </button>
      )
    },
  }
})

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: ({ children, ...props }: any) => {
      return (
        // @ts-ignore
        <span data-testid="badge" {...props}>
          {children}
        </span>
      )
    },
  }
})

vi.mock("@/components/ui/dropdown-menu", () => {
  return {
    DropdownMenu: ({ children }: any) => {
      return <div data-testid="dropdown">{children}</div>
    },
    DropdownMenuContent: ({ children }: any) => {
      return <div data-testid="dropdown-content">{children}</div>
    },
    DropdownMenuItem: ({ children, onClick, className }: any) => {
      return (
        // @ts-ignore
        <div role="menuitem" onClick={onClick} className={className}>
          {children}
        </div>
      )
    },
    DropdownMenuTrigger: ({ children, asChild }: any) => {
      // preserve asChild behavior used by component
      if (asChild) {
        return children
      }
      return <button>{children}</button>
    },
  }
})

vi.mock("@/lib/utils", () => {
  return {
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
  }
})

// Mock lucide-react icons as identifiable spans
vi.mock("lucide-react", () => {
  const IconFactory = (name: string) => (props: any) => {
    // render with data-icon attribute for querying
    return (
      // @ts-ignore
      <span data-icon={name} {...props}>
        {name}
      </span>
    )
  }
  return {
    Star: IconFactory("Star"),
    Sparkles: IconFactory("Sparkles"),
    Building2: IconFactory("Building2"),
    Users: IconFactory("Users"),
    Filter: IconFactory("Filter"),
    ChevronDown: IconFactory("ChevronDown"),
  }
})

// Import the module under test AFTER mocks
import { GroupesFiltersBar } from "./GroupesFiltersBar"

const createQueryClientWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe("GroupesFiltersBar", () => {
  it("sets up QueryClientProvider wrapper for hooks (renderHook smoke)", () => {
    const Wrapper = createQueryClientWrapper()
    const { result } = renderHook(
      () => {
        return { ok: true }
      },
      { wrapper: Wrapper }
    )
    expect(result.current.ok).toBe(true)
  })

  it("renders counts correctly and displays badges with correct values", () => {
    render(<GroupesFiltersBar groupes={GROUPS} compact={false} />)

    // Ensure 'Nouveaux' visible
    expect(screen.getByText("Nouveaux")).toBeTruthy()

    // Find buttons and identify them by their icon child
    const buttons = screen.getAllByTestId("btn") as HTMLElement[]
    const findButtonByIcon = (iconName: string) => buttons.find((b) => b.querySelector(`[data-icon="${iconName}"]`))

    // Nouveaux -> Sparkles icon, expected count 2 (g1 and g3)
    const nouveauxBtn = findButtonByIcon("Sparkles")
    expect(nouveauxBtn).toBeDefined()
    const nouveauxBadge = nouveauxBtn!.querySelector('[data-testid="badge"]')
    expect(nouveauxBadge).toBeTruthy()
    expect(nouveauxBadge!.textContent).toBe("2")

    // GHT -> Building2 icon, expected count 1 (only g1)
    const ghtBtn = findButtonByIcon("Building2")
    expect(ghtBtn).toBeDefined()
    const ghtBadge = ghtBtn!.querySelector('[data-testid="badge"]')
    expect(ghtBadge).toBeTruthy()
    expect(ghtBadge!.textContent).toBe("1")

    // Grosses -> Users icon, expected count 2 (g2 and g3)
    const grossesBtn = findButtonByIcon("Users")
    expect(grossesBtn).toBeDefined()
    const grossesBadge = grossesBtn!.querySelector('[data-testid="badge"]')
    expect(grossesBadge).toBeTruthy()
    expect(grossesBadge!.textContent).toBe("2")
  })

  it("handles smart filter button clicks by calling setSearchParams with correct params", () => {
    SET_SEARCH_PARAMS.mockReset()
    render(<GroupesFiltersBar groupes={GROUPS} compact={false} />)

    const buttons = screen.getAllByTestId("btn") as HTMLElement[]
    const findButtonByIcon = (iconName: string) => buttons.find((b) => b.querySelector(`[data-icon="${iconName}"]`))

    // Click GHT smart filter button (Building2)
    const ghtBtn = findButtonByIcon("Building2")
    expect(ghtBtn).toBeDefined()
    fireEvent.click(ghtBtn!)
    expect(SET_SEARCH_PARAMS).toHaveBeenCalledTimes(1)
    const calledWith1 = SET_SEARCH_PARAMS.mock.calls[0][0]
    expect(calledWith1 instanceof URLSearchParams).toBe(true)
    expect(calledWith1.get("smart_filter")).toBe("ght")

    // Click Nouveaux smart filter button (Sparkles)
    SET_SEARCH_PARAMS.mockReset()
    const nouveauxBtn = findButtonByIcon("Sparkles")
    expect(nouveauxBtn).toBeDefined()
    fireEvent.click(nouveauxBtn!)
    expect(SET_SEARCH_PARAMS).toHaveBeenCalledTimes(1)
    const calledWith2 = SET_SEARCH_PARAMS.mock.calls[0][0]
    expect(calledWith2.get("smart_filter")).toBe("nouveaux")
  })

  it("handles type selection from dropdown by setting 'type' search param", () => {
    SET_SEARCH_PARAMS.mockReset()
    render(<GroupesFiltersBar groupes={GROUPS} compact={false} />)

    // Dropdown items are rendered with role="menuitem"
    const items = screen.getAllByRole("menuitem")
    const ghtItem = items.find((it) => it.textContent === "GHT")
    expect(ghtItem).toBeDefined()
    fireEvent.click(ghtItem!)
    expect(SET_SEARCH_PARAMS).toHaveBeenCalledTimes(1)
    const arg = SET_SEARCH_PARAMS.mock.calls[0][0]
    expect(arg instanceof URLSearchParams).toBe(true)
    expect(arg.get("type")).toBe("GHT")
  })

  it("applies compact classes when compact is true", () => {
    render(<GroupesFiltersBar groupes={GROUPS} compact={true} />)
    const buttons = screen.getAllByTestId("btn") as HTMLElement[]
    expect(buttons.length).toBeGreaterThan(0)
    const hasCompact = buttons.some((b) => (b.className || "").includes("h-6"))
    expect(hasCompact).toBe(true)
  })

  it("wrapper rendering pattern: shows loading then error then content based on flags", async () => {
    function TestContainer({ isLoading, isError, errorMessage }: any) {
      if (isLoading) return <div>Loading...</div>
      if (isError) return <div>Error: {errorMessage}</div>
      return <GroupesFiltersBar groupes={GROUPS} />
    }

    const { rerender } = render(<TestContainer isLoading={true} isError={false} errorMessage={""} />)
    expect(screen.getByText("Loading...")).toBeTruthy()

    rerender(<TestContainer isLoading={false} isError={true} errorMessage={"une erreur svp"} />)
    expect(screen.getByText("Error: une erreur svp")).toBeTruthy()

    rerender(<TestContainer isLoading={false} isError={false} errorMessage={""} />)
    expect(screen.getByText("Nouveaux")).toBeTruthy()
  })
})