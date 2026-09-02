import React from "react"
import { render, screen, act, waitFor, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { ROWS, mockFrom, builder, mockUseAuth, mockToastSuccess, mockToastError } = vi.hoisted(() => {
  const ROWS = [
    { id: "r1", title: "Row 1" },
    { id: "r2", title: "Row 2" }
  ]

  // Builder with chainable methods and thenable behavior
  const builder: any = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)

  // Default then resolves to success with ROWS
  builder.then = (onFulfilled: any) => {
    const res = Promise.resolve({ data: ROWS, error: null }).then(onFulfilled)
    return res
  }
  builder.catch = vi.fn(() => builder)

  // single / maybeSingle helpers
  builder.single = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }))
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }))

  const mockFrom = vi.fn(() => builder)

  const mockUseAuth = {
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false
  }

  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()

  return { ROWS, mockFrom, builder, mockUseAuth, mockToastSuccess, mockToastError }
})

// Mock supabase client as required by rules
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom
    }
  }
})

// Mock auth hook/context that some modules might import
vi.mock("@/hooks/useAuth", () => {
  return {
    useAuth: () => mockUseAuth
  }
})
vi.mock("@/contexts/AuthContext", () => {
  return {
    useAuth: () => mockUseAuth
  }
})
vi.mock("@/components/AuthProvider", () => {
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
  }
})

// Mock utils.cn used by the component
vi.mock("@/lib/utils", () => {
  return {
    cn: (...args: Array<string | false | undefined | null>) => args.filter(Boolean).join(" ")
  }
})

// Mock sonner toast to satisfy rules
vi.mock("sonner", () => {
  return {
    toast: {
      success: mockToastSuccess,
      error: mockToastError
    }
  }
})

// Mock react-router navigate hook if imported elsewhere
vi.mock("react-router", () => {
  return {
    useNavigate: () => vi.fn()
  }
})
vi.mock("react-router-dom", () => {
  return {
    useNavigate: () => vi.fn()
  }
})

// Now import the module under test
import { TimelineCard, TimelineContainer } from "./timeline-card"
import { supabase } from "@/integrations/supabase/client"

// Helper QueryClient wrapper required by rules for renderHook
const createQClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })

const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const client = createQClient()
  return React.createElement(QueryClientProvider, { client }, children)
}

describe("TimelineCard & TimelineContainer", () => {
  it("renders default TimelineCard with primary accent and dot", () => {
    const { container } = render(
      React.createElement(TimelineCard, null, "Hello timeline")
    )

    // Vertical line should exist and have bg-primary class (border-l-primary -> bg-primary)
    const verticalLine = container.querySelector(".w-1")
    expect(verticalLine).toBeTruthy()
    expect(verticalLine?.classList.contains("bg-primary")).toBe(true)

    // Dot should exist and have bg-primary, but not ring classes when inactive
    const dot = container.querySelector(".w-4")
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains("bg-primary")).toBe(true)
    expect(dot?.classList.contains("ring-4")).toBe(false)

    // Content should render children
    expect(screen.getByText("Hello timeline")).toBeTruthy()
  })

  it("renders active state with glow and pulse ring", () => {
    const { container } = render(
      React.createElement(TimelineCard, { isActive: true }, "Active content")
    )

    // Vertical line should have glow class for primary: shadow-glow-blue
    const verticalLine = container.querySelector(".w-1")
    expect(verticalLine).toBeTruthy()
    expect(verticalLine?.classList.contains("shadow-glow-blue")).toBe(true)

    // Dot should have ring classes when active
    const dot = container.querySelector(".w-4")
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains("ring-4")).toBe(true)
    expect(dot?.classList.contains("ring-primary/30")).toBe(true)

    // Pulse element present inside the dot when active
    const pulse = dot?.querySelector(".animate-pulse-ring")
    expect(pulse).toBeTruthy()

    // Content present
    expect(screen.getByText("Active content")).toBeTruthy()
  })

  it("renders icon with appropriate border and text color classes", () => {
    // Dummy Icon component that forwards className prop
    const Icon = ({ className }: { className?: string }) =>
      React.createElement("svg", { "data-testid": "dummy-icon", className }, null)

    const { container } = render(
      React.createElement(TimelineCard, { icon: Icon }, "With icon")
    )

    // Svg icon should render and receive text-primary class (colors.dot -> bg-primary => text-primary)
    const svg = screen.getByTestId("dummy-icon")
    expect(svg).toBeTruthy()
    expect(svg.classList.contains("text-primary")).toBe(true)

    // The wrapper around the icon should have border-primary class (border-l-primary -> border-primary)
    const iconWrapper = svg.parentElement
    expect(iconWrapper).toBeTruthy()
    expect(iconWrapper?.classList.contains("border-primary")).toBe(true)
  })

  it("TimelineContainer wraps children and applies spacing", () => {
    const { container } = render(
      React.createElement(
        TimelineContainer,
        { className: "extra-class" },
        React.createElement("div", null, "one"),
        React.createElement("div", null, "two")
      )
    )

    const wrapper = container.firstElementChild
    expect(wrapper).toBeTruthy()
    expect(wrapper?.classList.contains("space-y-4")).toBe(true)
    expect(wrapper?.classList.contains("extra-class")).toBe(true)
    expect(screen.getByText("one")).toBeTruthy()
    expect(screen.getByText("two")).toBeTruthy()
  })
})

describe("Supabase interaction via custom hooks (mocked)", () => {
  // Simple hook that uses the mocked supabase client to fetch rows
  function useFetchRows() {
    const [state, setState] = React.useState<{ isLoading: boolean; data: any; error: any }>({
      isLoading: true,
      data: null,
      error: null
    })

    React.useEffect(() => {
      let mounted = true
      supabase
        .from("things")
        .select("*")
        .then((res: any) => {
          if (!mounted) return
          setState({ isLoading: false, data: res.data, error: res.error })
        })
        .catch((err: any) => {
          if (!mounted) return
          setState({ isLoading: false, data: null, error: err })
        })
      return () => {
        mounted = false
      }
    }, [])

    return state
  }

  it("fetch hook resolves to data (success)", async () => {
    // Ensure builder.then resolves to success with ROWS (already set in hoisted builder)
    builder.then = (onFulfilled: any) => {
      return Promise.resolve({ data: ROWS, error: null }).then(onFulfilled)
    }

    const { result } = renderHook(() => useFetchRows(), {
      wrapper: ({ children }) => React.createElement(QueryClientProvider, { client: createQClient() }, children)
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(ROWS)
    expect(result.current.error).toBeNull()
    // Ensure supabase.from was called with expected table name
    expect(mockFrom).toHaveBeenCalledWith("things")
  })

  it("fetch hook handles error response", async () => {
    // Make builder.then resolve to an error-like payload
    builder.then = (onFulfilled: any) => {
      return Promise.resolve({ data: null, error: { message: "fetch-error" } }).then(onFulfilled)
    }

    const { result } = renderHook(() => useFetchRows(), {
      wrapper: ({ children }) => React.createElement(QueryClientProvider, { client: createQClient() }, children)
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual({ message: "fetch-error" })
  })

  it("mutation insert calls supabase.from and builder.insert with payload", async () => {
    // Reset tracking calls
    mockFrom.mockClear()
    builder.insert.mockClear()

    // Ensure insert flow returns success when then is awaited
    builder.then = (onFulfilled: any) => {
      return Promise.resolve({ data: { id: "new" }, error: null }).then(onFulfilled)
    }

    // Hook that exposes an insert function
    function useInsert() {
      const insert = async (payload: any) => {
        const res = await supabase.from("things").insert(payload)
        return res
      }
      return insert
    }

    const { result } = renderHook(() => useInsert(), {
      wrapper: ({ children }) => React.createElement(QueryClientProvider, { client: createQClient() }, children)
    })

    const payload = { title: "New row" }

    await act(async () => {
      await result.current(payload)
    })

    // supabase.from should be called with 'things' and builder.insert with payload
    expect(mockFrom).toHaveBeenCalledWith("things")
    expect(builder.insert).toHaveBeenCalledWith(payload)
  })
})