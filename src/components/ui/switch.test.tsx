// @vitest-environment jsdom

import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Switch } from "./switch"

const { cnMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(" ")
  ),
}))

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
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

describe("Switch", () => {
  it("renders with radix switch semantics and default unchecked state", () => {
    const Wrapper = createWrapper()

    render(<Switch aria-label="notifications" />, { wrapper: Wrapper })

    const control = screen.getByRole("switch", { name: "notifications" })

    expect(control).toBeInTheDocument()
    expect(control).toHaveAttribute("data-state", "unchecked")
    expect(control).toHaveAttribute("type", "button")
    expect(control).toHaveClass(
      "peer",
      "inline-flex",
      "h-6",
      "w-11",
      "rounded-full",
      "data-[state=checked]:bg-primary",
      "data-[state=unchecked]:bg-input"
    )
  })

  it("merges custom className with base classes via cn", () => {
    const Wrapper = createWrapper()

    render(<Switch aria-label="theme" className="custom-switch extra-class" />, {
      wrapper: Wrapper,
    })

    const control = screen.getByRole("switch", { name: "theme" })

    expect(cnMock).toHaveBeenCalled()
    expect(control.className).toContain("custom-switch")
    expect(control.className).toContain("extra-class")
    expect(control.className).toContain("inline-flex")
    expect(control.className).toContain("cursor-pointer")
  })

  it("supports controlled checked state and exposes checked state on the root", () => {
    const Wrapper = createWrapper()

    const { container } = render(<Switch aria-label="airplane mode" checked />, {
      wrapper: Wrapper,
    })

    const control = screen.getByRole("switch", { name: "airplane mode" })

    expect(control).toHaveAttribute("data-state", "checked")
    expect(control).toHaveAttribute("aria-checked", "true")
    expect(container.firstChild).toHaveAttribute("data-state", "checked")
  })

  it("calls onCheckedChange with the real toggled value when clicked in uncontrolled mode", () => {
    const Wrapper = createWrapper()
    const onCheckedChange = vi.fn()

    render(<Switch aria-label="wifi" defaultChecked={false} onCheckedChange={onCheckedChange} />, {
      wrapper: Wrapper,
    })

    const control = screen.getByRole("switch", { name: "wifi" })

    expect(control).toHaveAttribute("data-state", "unchecked")

    fireEvent.click(control)
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true)
    expect(control).toHaveAttribute("data-state", "checked")

    fireEvent.click(control)
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, false)
    expect(control).toHaveAttribute("data-state", "unchecked")
  })

  it("respects disabled prop and does not trigger changes", () => {
    const Wrapper = createWrapper()
    const onCheckedChange = vi.fn()

    render(
      <Switch aria-label="bluetooth" disabled onCheckedChange={onCheckedChange} />,
      { wrapper: Wrapper }
    )

    const control = screen.getByRole("switch", { name: "bluetooth" })

    expect(control).toBeDisabled()
    expect(control).toHaveAttribute("data-disabled", "")

    fireEvent.click(control)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("forwards refs to the underlying button element", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLButtonElement>()

    render(<Switch aria-label="location" ref={ref} />, { wrapper: Wrapper })

    const control = screen.getByRole("switch", { name: "location" })

    expect(ref.current).toBe(control)
    expect(ref.current?.tagName).toBe("BUTTON")
  })

  it("can be rendered inside the required query client wrapper", () => {
    const Wrapper = createWrapper()

    const { result } = renderHook(() => React.useMemo(() => "ready", []), {
      wrapper: Wrapper,
    })

    expect(result.current).toBe("ready")
  })
})