import React from "react"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"

// Stable hoisted mocks and shared flags
const { IS_MOBILE, mockUseMediaQuery, mockCn } = vi.hoisted(() => {
  return {
    IS_MOBILE: { value: undefined as unknown as boolean | undefined | "throw" },
    mockUseMediaQuery: vi.fn((query: string) => {
      const v = IS_MOBILE.value
      if (v === "throw") {
        throw new Error("simulated-media-error")
      }
      return v
    }),
    mockCn: vi.fn((...parts: unknown[]) => parts.filter(Boolean).join(" ")),
  }
})

// Mock utilities and hooks used by the component
vi.mock("@/lib/utils", () => ({ cn: mockCn }))
vi.mock("@/hooks/shared/useMediaQuery", () => ({ useMediaQuery: mockUseMediaQuery }))

// Mock Tabs components with a simple context to allow TabsTrigger to call onValueChange
vi.mock("@/components/ui/tabs", () => {
  const React = require("react")
  const TabContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | undefined>(undefined)

  function Tabs(props: any) {
    const { value, onValueChange, children, className } = props
    return React.createElement(
      TabContext.Provider,
      { value: { value, onValueChange } },
      React.createElement("div", { "data-testid": "mock-tabs", className }, children)
    )
  }

  function TabsList(props: any) {
    return React.createElement("div", { "data-testid": "tabs-list" }, props.children)
  }

  function TabsTrigger(props: any) {
    const { value } = props
    const ctx = React.useContext(TabContext)
    return React.createElement(
      "button",
      {
        type: "button",
        "data-testid": `tabs-trigger-${value}`,
        onClick: () => {
          if (ctx && ctx.onValueChange) {
            ctx.onValueChange(value)
          }
        },
      },
      props.children
    )
  }

  function TabsContent(props: any) {
    return React.createElement("div", { "data-testid": "tabs-content" }, props.children)
  }

  return { Tabs, TabsList, TabsTrigger, TabsContent }
})

// Mock Select components with context so SelectItem can trigger onValueChange
vi.mock("@/components/ui/select", () => {
  const React = require("react")
  const SelectContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | undefined>(undefined)

  function Select(props: any) {
    const { value, onValueChange, children } = props
    return React.createElement(
      SelectContext.Provider,
      { value: { value, onValueChange } },
      React.createElement("div", { "data-testid": "mock-select" }, children)
    )
  }

  function SelectTrigger(props: any) {
    return React.createElement("div", { "data-testid": "select-trigger" }, props.children)
  }

  function SelectValue(props: any) {
    return React.createElement("div", { "data-testid": "select-value" }, props.children)
  }

  function SelectContent(props: any) {
    return React.createElement("div", { "data-testid": "select-content" }, props.children)
  }

  function SelectItem(props: any) {
    const { value } = props
    const ctx = React.useContext(SelectContext)
    return React.createElement(
      "div",
      {
        role: "option",
        "data-testid": `select-item-${value}`,
        onClick: () => {
          if (ctx && ctx.onValueChange) {
            ctx.onValueChange(value)
          }
        },
      },
      props.children
    )
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

// Now import the mocked hook (the vi.mock above is hoisted) and the component under test
import { useMediaQuery } from "@/hooks/shared/useMediaQuery"
import { ResponsiveTabs } from "./responsive-tabs"

const TABS = [
  { value: "tab1", label: "Tab One" },
  { value: "tab2", label: "Tab Two" },
]

describe("ResponsiveTabs component", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    IS_MOBILE.value = false
  })

  it("renders desktop tabs when useMediaQuery is false and clicking a tab triggers onValueChange", async () => {
    IS_MOBILE.value = false
    const onValueChange = vi.fn()

    render(
      <ResponsiveTabs tabs={TABS} value="tab1" onValueChange={onValueChange} className="extra-class">
        <div data-testid="child">ChildrenContent</div>
      </ResponsiveTabs>,
      { wrapper }
    )

    const list = screen.getByTestId("tabs-list")
    expect(list).toBeTruthy()

    const t1 = screen.getByTestId("tabs-trigger-tab1")
    const t2 = screen.getByTestId("tabs-trigger-tab2")
    expect(t1).toBeTruthy()
    expect(t2).toBeTruthy()
    expect(t1).toHaveTextContent("Tab One")
    expect(t2).toHaveTextContent("Tab Two")

    expect(screen.getByTestId("child")).toHaveTextContent("ChildrenContent")

    fireEvent.click(t2)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("tab2")
  })

  it("renders a select on mobile and selecting an item triggers onValueChange", async () => {
    IS_MOBILE.value = true
    const onValueChange = vi.fn()

    render(
      <ResponsiveTabs tabs={TABS} value="tab1" onValueChange={onValueChange}>
        <div data-testid="child-mobile">MobileChild</div>
      </ResponsiveTabs>,
      { wrapper }
    )

    const tabsList = screen.queryByTestId("tabs-list")
    expect(tabsList).toBeNull()

    const select = screen.getByTestId("mock-select")
    expect(select).toBeTruthy()
    const valueDisplay = screen.getByTestId("select-value")
    expect(valueDisplay).toHaveTextContent("Tab One")

    const item2 = screen.getByTestId("select-item-tab2")
    expect(item2).toBeTruthy()
    expect(item2).toHaveTextContent("Tab Two")

    fireEvent.click(item2)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("tab2")

    expect(screen.getByTestId("child-mobile")).toHaveTextContent("MobileChild")
  })

  it("useMediaQuery hook - transitions: loading -> value -> error", async () => {
    // initial "loading" state simulated by undefined
    IS_MOBILE.value = undefined

    const { result, rerender } = renderHook(
      () => {
        try {
          const v = useMediaQuery("(max-width:640px)")
          return { value: v as unknown as boolean | undefined, error: null as string | null }
        } catch (e: any) {
          return { value: null as unknown as boolean | null, error: String(e?.message ?? e) }
        }
      },
      { wrapper }
    )

    expect(result.current.value).toBeUndefined()
    expect(result.current.error).toBeNull()

    // transition to mobile=true
    await act(async () => {
      IS_MOBILE.value = true
      rerender()
    })

    expect(result.current.value).toBe(true)
    expect(result.current.error).toBeNull()

    // simulate an error thrown by the hook on next call
    mockUseMediaQuery.mockImplementationOnce(() => {
      throw new Error("simulated-media-error")
    })

    await act(async () => {
      IS_MOBILE.value = false
      rerender()
    })

    expect(result.current.value).toBeNull()
    expect(result.current.error).toContain("simulated-media-error")
  })
})