import * as React from "react"
import { render, screen, act, waitFor, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query"

const { cnMock, MotionDiv, mockFetchSuccess, mockFetchError, mockMutate } = vi.hoisted(() => {
  const cnMock = (...args: Array<unknown>) =>
    args
      .flatMap((a) => {
        if (!a) return []
        if (typeof a === "string") return a.split(" ")
        return [String(a)]
      })
      .filter(Boolean)
      .join(" ")

  function MotionDiv(props: any) {
    const {
      children,
      // explicitly remove framer-motion specific props to avoid React warnings
      whileHover,
      whileTap,
      whileFocus,
      whileDrag,
      initial,
      animate,
      exit,
      variants,
      transition,
      layout,
      layoutId,
      ...rest
    } = props
    // render a regular div but mark it so tests can assert it's from framer-motion
    return React.createElement("div", { "data-motion": "true", ...rest }, children)
  }

  // stable mocks for hook tests
  const mockFetchSuccess = vi.fn(async () => ({ data: { id: "1", value: "ok" }, error: null }))
  const mockFetchError = vi.fn(async () => ({ data: null, error: { message: "failed" } }))
  const mockMutate = vi.fn(async (payload: unknown) => ({ success: true, payload }))

  return { cnMock, MotionDiv, mockFetchSuccess, mockFetchError, mockMutate }
})

vi.mock("@/lib/utils", () => ({ cn: cnMock }))
vi.mock("framer-motion", () => ({ motion: { div: MotionDiv } }))

let GlowBadge: typeof import("./glow-badge").GlowBadge
beforeAll(async () => {
  const mod = await import("./glow-badge")
  GlowBadge = mod.GlowBadge
})

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  })

describe("GlowBadge component", () => {
  it("renders default variant and size and combines classes correctly", () => {
    render(React.createElement(GlowBadge, null, "Hello"))
    const el = screen.getByText("Hello")
    // component uses a motion.div mocked as a div with data-motion
    expect(el).toBeInstanceOf(HTMLElement)
    expect(el.getAttribute("data-motion")).toBe("true")
    const className = el.getAttribute("class") ?? ""
    // assert presence of default variant classes and size 'md' classes
    expect(className.includes("bg-muted")).toBe(true)
    expect(className.includes("text-muted-foreground")).toBe(true)
    expect(className.includes("text-sm")).toBe(true) // md size -> text-sm
    expect(className.includes("rounded-full")).toBe(true)
    expect(className.includes("transition-all")).toBe(true)
  })

  it("applies variant, size, glow, pulse and extra className props", () => {
    render(
      React.createElement(
        GlowBadge,
        { variant: "primary", size: "lg", pulse: true, glow: true, className: "extra-class" },
        "Primary"
      )
    )
    const el = screen.getByText("Primary")
    const className = el.getAttribute("class") ?? ""
    // variant primary
    expect(className.includes("bg-primary/10")).toBe(true)
    expect(className.includes("text-primary")).toBe(true)
    // glow should add variant's glow class
    expect(className.includes("shadow-glow-blue")).toBe(true)
    // pulse should add animate-pulse
    expect(className.includes("animate-pulse")).toBe(true)
    // size lg -> text-base
    expect(className.includes("text-base")).toBe(true)
    // custom className preserved
    expect(className.includes("extra-class")).toBe(true)
  })
})

describe("Auxiliary hook-like behaviors (renderHook with QueryClientProvider wrapper)", () => {
  const wrapper = ({ children }: { children?: React.ReactNode }) => {
    const qc = createTestQueryClient()
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }

  function useFakeFetch(fetchFn: () => Promise<{ data: unknown | null; error: unknown | null }>) {
    const [isLoading, setIsLoading] = React.useState(true)
    const [data, setData] = React.useState<unknown | null>(null)
    const [error, setError] = React.useState<unknown | null>(null)

    React.useEffect(() => {
      let cancelled = false
      ;(async () => {
        setIsLoading(true)
        try {
          const res = await fetchFn()
          if (cancelled) return
          setData(res.data ?? null)
          setError(res.error ?? null)
        } catch (err) {
          if (cancelled) return
          setError(err)
          setData(null)
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [fetchFn])

    return {
      isLoading,
      isError: Boolean(error),
      data,
      error
    }
  }

  it("shows loading then success with real data returned by the fetch mock", async () => {
    const { result } = renderHook(() => useFakeFetch(mockFetchSuccess), { wrapper })
    // initial loading
    expect(result.current.isLoading).toBe(true)
    // wait until settled
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // success: data matches the hoisted mock
    expect(result.current.data).toEqual({ id: "1", value: "ok" })
    expect(result.current.isError).toBe(false)
    expect(mockFetchSuccess).toHaveBeenCalledTimes(1)
  })

  it("reports error state when fetch mock returns an error payload", async () => {
    const { result } = renderHook(() => useFakeFetch(mockFetchError), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(true)
    expect((result.current.error as any)?.message).toBe("failed")
    expect(result.current.data).toBeNull()
    expect(mockFetchError).toHaveBeenCalledTimes(1)
  })

  it("executes a mutation and the mutation function is called with correct arguments", async () => {
    const { result } = renderHook(() => useMutation({ mutationFn: mockMutate }), { wrapper })
    // call mutateAsync to await completion
    await act(async () => {
      await result.current.mutateAsync({ id: "m1", value: 42 })
    })
    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith({ id: "m1", value: 42 })
  })
})