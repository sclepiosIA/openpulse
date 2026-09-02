import React from "react"
import { render, renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { ROWS, mockFrom, setResponse, selectSpy, insertSpy, MockRoot, MockTrigger, MockContent } = vi.hoisted(() => {
  const ROWS = [
    { id: "r1", name: "Alpha" },
    { id: "r2", name: "Beta" }
  ]

  const selectSpy = vi.fn()
  const insertSpy = vi.fn()

  const state: { response: { data: unknown; error: unknown } } = {
    response: { data: ROWS, error: null }
  }

  function setResponse(resp: { data: unknown; error: unknown }) {
    state.response = resp
  }

  function builderFactory() {
    const builder: Record<string, unknown> = {}

    builder.select = (...args: unknown[]) => {
      selectSpy(...args)
      return builder
    }
    builder.eq = () => builder
    builder.gte = () => builder
    builder.lte = () => builder
    builder.in = () => builder
    builder.order = () => builder
    builder.limit = () => builder
    builder.insert = (...args: unknown[]) => {
      insertSpy(...args)
      return builder
    }
    builder.update = () => builder
    builder.delete = () => builder
    builder.single = () => builder
    builder.maybeSingle = () => builder

    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      return Promise.resolve(state.response).then(onFulfilled as any, onRejected as any)
    }
    builder.catch = (onRejected?: (e: unknown) => unknown) => {
      return Promise.resolve(state.response).catch(onRejected as any)
    }

    return builder
  }

  const mockFrom = vi.fn((_: string) => builderFactory())

  const MockRoot: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({ children }) => {
    return React.createElement("div", { "data-testid": "mock-root" }, children)
  }
  const MockTrigger: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({ children }) => {
    return React.createElement("button", { "data-testid": "mock-trigger", type: "button" }, children)
  }
  const MockContent: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({ children }) => {
    return React.createElement("div", { "data-testid": "mock-content" }, children)
  }

  return { ROWS, mockFrom, setResponse, selectSpy, insertSpy, MockRoot, MockTrigger, MockContent }
})

vi.mock("@radix-ui/react-collapsible", () => {
  return {
    Root: MockRoot,
    CollapsibleTrigger: MockTrigger,
    CollapsibleContent: MockContent
  }
})

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom
    }
  }
})

describe("collapsible module exports and integration with mocked supabase", () => {
  const createQueryClientWrapper = () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    })
    const Wrapper: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({ children }) => {
      return React.createElement(QueryClientProvider, { client: qc }, children)
    }
    return Wrapper
  }

  beforeEach(() => {
    selectSpy.mockClear()
    insertSpy.mockClear()
    setResponse({ data: ROWS, error: null })
    mockFrom.mockClear()
  })

  it("re-exports Radix components (Collapsible, CollapsibleTrigger, CollapsibleContent) from the module", async () => {
    const mod = await import("./collapsible")
    expect(mod.Collapsible).toBe(MockRoot)
    expect(mod.CollapsibleTrigger).toBe(MockTrigger)
    expect(mod.CollapsibleContent).toBe(MockContent)
  })

  it("renders children passed into exported components", async () => {
    const mod = await import("./collapsible")
    const TestComponent: React.FC = () => {
      return React.createElement(
        mod.Collapsible,
        null,
        React.createElement(mod.CollapsibleTrigger, null, "Open"),
        React.createElement(mod.CollapsibleContent, null, "Hidden content")
      )
    }
    const { getByText, getByTestId } = render(React.createElement(TestComponent))
    expect(getByText("Open")).toBeTruthy()
    expect(getByText("Hidden content")).toBeTruthy()
    expect(getByTestId("mock-root")).toBeTruthy()
    expect(getByTestId("mock-trigger")).toBeTruthy()
    expect(getByTestId("mock-content")).toBeTruthy()
  })

  it("hook using supabase returns loading then data on success", async () => {
    setResponse({ data: ROWS, error: null })

    function useLoadItems() {
      const [isLoading, setIsLoading] = React.useState(true)
      const [isError, setIsError] = React.useState(false)
      const [data, setData] = React.useState<typeof ROWS | null>(null)

      React.useEffect(() => {
        let mounted = true
        ;(async () => {
          try {
            const { data: resData, error } = await (await import("@/integrations/supabase/client")).supabase
              .from("items")
              .select("*")
            if (!mounted) return
            if (error) {
              setIsError(true)
              setData(null)
            } else {
              setData(resData as typeof ROWS)
            }
          } catch {
            if (mounted) setIsError(true)
          } finally {
            if (mounted) setIsLoading(false)
          }
        })()
        return () => {
          mounted = false
        }
      }, [])

      return { isLoading, isError, data }
    }

    const wrapper = createQueryClientWrapper()
    const { result } = renderHook(() => useLoadItems(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.isError).toBe(false)
    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data).toHaveLength(ROWS.length)
    expect(mockFrom).toHaveBeenCalledWith("items")
    expect(selectSpy).toHaveBeenCalledWith("*")
  })

  it("hook using supabase reports error when supabase returns an error shape", async () => {
    setResponse({ data: null, error: { message: "fetch failed" } })

    function useLoadItemsError() {
      const [isLoading, setIsLoading] = React.useState(true)
      const [isError, setIsError] = React.useState(false)
      const [data, setData] = React.useState<null>(null)

      React.useEffect(() => {
        let mounted = true
        ;(async () => {
          const { data: resData, error } = await (await import("@/integrations/supabase/client")).supabase
            .from("items")
            .select("*")
          if (!mounted) return
          if (error) {
            setIsError(true)
            setData(null)
          } else {
            setData(resData as null)
          }
          if (mounted) setIsLoading(false)
        })()
        return () => {
          mounted = false
        }
      }, [])

      return { isLoading, isError, data }
    }

    const wrapper = createQueryClientWrapper()
    const { result } = renderHook(() => useLoadItemsError(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it("performs insert mutation and calls supabase.insert with correct payload", async () => {
    setResponse({ data: [{ id: "new1", name: "New" }], error: null })

    function useInsertItem() {
      const insertItem = async (payload: { name: string }) => {
        const response = await (await import("@/integrations/supabase/client")).supabase.from("items").insert([payload])
        return response
      }
      return { insertItem }
    }

    const wrapper = createQueryClientWrapper()
    const { result } = renderHook(() => useInsertItem(), { wrapper })
    await act(async () => {
      const response = await result.current.insertItem({ name: "New" })
      expect(response.data).toBeDefined()
      expect(response.error).toBeNull()
    })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledWith([{ name: "New" }])
    expect(mockFrom).toHaveBeenCalledWith("items")
  })
})