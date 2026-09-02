// @vitest-environment jsdom
import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./resizable"

const { panelGroupMock, panelMock, panelResizeHandleMock, gripVerticalMock, cnMock } = vi.hoisted(() => ({
  panelGroupMock: vi.fn(),
  panelMock: vi.fn(),
  panelResizeHandleMock: vi.fn(),
  gripVerticalMock: vi.fn(),
  cnMock: vi.fn((...classes: Array<string | undefined | false | null>) => classes.filter(Boolean).join(" ")),
}))

vi.mock("lucide-react", () => ({
  GripVertical: (props: React.SVGProps<SVGSVGElement>) => {
    gripVerticalMock(props)
    return <svg data-testid="grip-icon" {...props} />
  },
}))

vi.mock("react-resizable-panels", () => ({
  PanelGroup: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    panelGroupMock({ children, className, ...props })
    return (
      <div data-testid="panel-group" className={className} {...props}>
        {children}
      </div>
    )
  },
  Panel: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    panelMock({ children, ...props })
    return (
      <div data-testid="panel" {...props}>
        {children}
      </div>
    )
  },
  PanelResizeHandle: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    panelResizeHandleMock({ children, className, ...props })
    return (
      <div data-testid="panel-resize-handle" className={className} {...props}>
        {children}
      </div>
    )
  },
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | undefined | false | null>) => cnMock(...args),
}))

describe("resizable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rend ResizablePanelGroup avec les classes métier et la className fournie", () => {
    render(
      <ResizablePanelGroup className="custom-group" data-orientation="horizontal">
        <span>content</span>
      </ResizablePanelGroup>
    )

    const group = screen.getByTestId("panel-group")
    expect(group).toBeInTheDocument()
    expect(group).toHaveClass("flex")
    expect(group).toHaveClass("h-full")
    expect(group).toHaveClass("w-full")
    expect(group).toHaveClass("data-[panel-group-direction=vertical]:flex-col")
    expect(group).toHaveClass("custom-group")
    expect(group).toHaveAttribute("data-orientation", "horizontal")
    expect(screen.getByText("content")).toBeInTheDocument()

    expect(cnMock).toHaveBeenCalledWith(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      "custom-group"
    )
    expect(panelGroupMock).toHaveBeenCalledTimes(1)
  })

  it("ré-exporte ResizablePanel et transmet les props au primitive Panel", () => {
    render(
      <ResizablePanel data-size="50" aria-label="main-panel">
        <button>inside panel</button>
      </ResizablePanel>
    )

    const panel = screen.getByTestId("panel")
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveAttribute("data-size", "50")
    expect(panel).toHaveAttribute("aria-label", "main-panel")
    expect(screen.getByRole("button", { name: "inside panel" })).toBeInTheDocument()
    expect(panelMock).toHaveBeenCalledTimes(1)
  })

  it("rend ResizableHandle sans poignée quand withHandle est falsy", () => {
    render(<ResizableHandle className="my-handle" data-state="idle" />)

    const handle = screen.getByTestId("panel-resize-handle")
    expect(handle).toBeInTheDocument()
    expect(handle).toHaveClass("relative")
    expect(handle).toHaveClass("flex")
    expect(handle).toHaveClass("w-px")
    expect(handle).toHaveClass("items-center")
    expect(handle).toHaveClass("justify-center")
    expect(handle).toHaveClass("bg-border")
    expect(handle).toHaveClass("my-handle")
    expect(handle).toHaveAttribute("data-state", "idle")
    expect(screen.queryByTestId("grip-icon")).not.toBeInTheDocument()

    expect(cnMock).toHaveBeenCalledWith(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      "my-handle"
    )
    expect(panelResizeHandleMock).toHaveBeenCalledTimes(1)
    expect(gripVerticalMock).not.toHaveBeenCalled()
  })

  it("rend ResizableHandle avec poignée visuelle quand withHandle est true", () => {
    render(<ResizableHandle withHandle className="visual-handle" />)

    const handle = screen.getByTestId("panel-resize-handle")
    expect(handle).toBeInTheDocument()
    expect(handle).toHaveClass("visual-handle")

    const icon = screen.getByTestId("grip-icon")
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass("h-2.5")
    expect(icon).toHaveClass("w-2.5")

    const wrapper = icon.parentElement
    expect(wrapper).not.toBeNull()
    expect(wrapper?.className).toContain("z-10")
    expect(wrapper?.className).toContain("h-4")
    expect(wrapper?.className).toContain("w-3")
    expect(wrapper?.className).toContain("rounded-sm")
    expect(wrapper?.className).toContain("border")
    expect(wrapper?.className).toContain("bg-border")

    expect(gripVerticalMock).toHaveBeenCalledTimes(1)
  })
})