import React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@/lib/utils", () => {
  return {
    cn: (...values: unknown[]) =>
      values
        .flat()
        .filter(Boolean)
        .join(" "),
  }
})

vi.mock("lucide-react", () => {
  const X = (props: React.SVGProps<SVGSVGElement>) => <svg data-icon="x" {...props} />
  return { X }
})

vi.mock("@radix-ui/react-toast", () => {
  const Provider: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({ children, ...props }) => (
    <div data-radix-provider="" {...props}>
      {children}
    </div>
  )
  const Viewport = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div data-radix-viewport="" ref={ref} {...props} />
  ))
  const Root = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div data-radix-root="" ref={ref} {...props} />
  ))
  const Action = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
    <button data-radix-action="" ref={ref} {...props} />
  ))
  const Close = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
    <button data-radix-close="" ref={ref} {...props} />
  ))
  const Title = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div data-radix-title="" ref={ref} {...props} />
  ))
  const Description = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div data-radix-description="" ref={ref} {...props} />
  ))
  return {
    Provider,
    Viewport,
    Root,
    Action,
    Close,
    Title,
    Description,
  }
})

import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./toast"

const createWrapper =
  () =>
  ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }

describe("toast module components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders ToastProvider children", () => {
    const Wrapper = createWrapper()
    render(
      <ToastProvider>
        <div data-testid="child">Hello</div>
      </ToastProvider>,
      { wrapper: Wrapper }
    )
    expect(screen.getByTestId("child").textContent).toBe("Hello")
  })

  it("ToastViewport applies default and custom classes, forwards ref", () => {
    const ref = React.createRef<HTMLDivElement>()
    const Wrapper = createWrapper()
    const { getByTestId } = render(<ToastViewport ref={ref} data-testid="viewport" className="extra-class" />, {
      wrapper: Wrapper,
    })
    const el = getByTestId("viewport")
    expect(el.className).toContain("fixed")
    expect(el.className).toContain("top-0")
    expect(el.className).toContain("md:max-w-[420px]")
    expect(el.className).toContain("extra-class")
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("DIV")
  })

  it("Toast renders with default variant classes and custom className", () => {
    const Wrapper = createWrapper()
    render(
      <Toast data-testid="toast" className="my-toast">
        Default toast
      </Toast>,
      { wrapper: Wrapper }
    )
    const toast = screen.getByTestId("toast")
    expect(toast.className).toContain("pointer-events-auto")
    expect(toast.className).toContain("border")
    expect(toast.className).toContain("bg-background")
    expect(toast.className).toContain("text-foreground")
    expect(toast.className).toContain("my-toast")
  })

  it("Toast renders destructive variant classes", () => {
    const Wrapper = createWrapper()
    render(
      <Toast variant="destructive" data-testid="toast-destructive">
        Destructive toast
      </Toast>,
      { wrapper: Wrapper }
    )
    const toast = screen.getByTestId("toast-destructive")
    expect(toast.className).toContain("destructive")
    expect(toast.className).toContain("group")
    expect(toast.className).toContain("bg-destructive")
    expect(toast.className).toContain("text-destructive-foreground")
  })

  it("ToastTitle applies expected classes and allows custom className", () => {
    const Wrapper = createWrapper()
    render(<ToastTitle data-testid="title" className="custom-title">Title</ToastTitle>, { wrapper: Wrapper })
    const title = screen.getByTestId("title")
    expect(title.textContent).toBe("Title")
    expect(title.className).toContain("text-sm")
    expect(title.className).toContain("font-semibold")
    expect(title.className).toContain("custom-title")
  })

  it("ToastDescription applies expected classes and allows custom className", () => {
    const Wrapper = createWrapper()
    render(
      <ToastDescription data-testid="desc" className="custom-desc">
        Description
      </ToastDescription>,
      { wrapper: Wrapper }
    )
    const desc = screen.getByTestId("desc")
    expect(desc.textContent).toBe("Description")
    expect(desc.className).toContain("text-sm")
    expect(desc.className).toContain("opacity-90")
    expect(desc.className).toContain("custom-desc")
  })

  it("ToastAction applies expected classes and forwards props", () => {
    const Wrapper = createWrapper()
    render(
      <Toast>
        <ToastAction data-testid="action" className="custom-action">
          OK
        </ToastAction>
      </Toast>,
      { wrapper: Wrapper }
    )
    const action = screen.getByTestId("action")
    expect(action.className).toContain("inline-flex")
    expect(action.className).toContain("h-8")
    expect(action.className).toContain("px-3")
    expect(action.className).toContain("text-sm")
    expect(action.className).toContain("custom-action")
    expect(action.tagName).toBe("BUTTON")
  })

  it("ToastClose has toast-close attribute and renders X icon", () => {
    const Wrapper = createWrapper()
    const { container } = render(
      <Toast>
        <ToastClose data-testid="close" />
      </Toast>,
      { wrapper: Wrapper }
    )
    const close = screen.getByTestId("close")
    expect(close.getAttribute("toast-close")).not.toBeNull()
    const icon = close.querySelector('svg[data-icon="x"]')
    expect(icon).not.toBeNull()
    expect(close.className).toContain("absolute")
    expect(close.className).toContain("right-2")
    expect(close.className).toContain("top-2")
  })

  it("Toast forwards ref to DOM element", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLDivElement>()
    render(
      <Toast ref={ref} data-testid="toast-ref">
        Ref test
      </Toast>,
      { wrapper: Wrapper }
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("DIV")
  })
})