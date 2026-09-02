// @vitest-environment jsdom
import * as React from "react"
import "@testing-library/jest-dom/vitest"
import { render, screen, cleanup, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "./drawer"

const {
  ROOT_PROPS,
  CONTENT_PROPS,
  TITLE_PROPS,
  DESCRIPTION_PROPS,
} = vi.hoisted(() => ({
  ROOT_PROPS: [] as Array<Record<string, unknown>>,
  CONTENT_PROPS: [] as Array<Record<string, unknown>>,
  TITLE_PROPS: [] as Array<Record<string, unknown>>,
  DESCRIPTION_PROPS: [] as Array<Record<string, unknown>>,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" "),
}))

vi.mock("vaul", async () => {
  const ReactModule = await import("react")

  const Root = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    ROOT_PROPS.push(props)
    return (
      <div data-testid="drawer-root" data-should-scale={String(props.shouldScaleBackground)}>
        {children}
      </div>
    )
  }
  Root.displayName = "VaulRoot"

  const Trigger = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button data-testid="drawer-trigger" {...props}>
      {children}
    </button>
  )
  Trigger.displayName = "VaulTrigger"

  const Portal = ({ children }: React.PropsWithChildren) => (
    <div data-testid="drawer-portal">{children}</div>
  )
  Portal.displayName = "VaulPortal"

  const Close = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button data-testid="drawer-close" {...props}>
      {children}
    </button>
  )
  Close.displayName = "VaulClose"

  const Overlay = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} data-testid="drawer-overlay" {...props}>
        {children}
      </div>
    ),
  )
  Overlay.displayName = "VaulOverlay"

  const Content = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => {
      CONTENT_PROPS.push(props)
      return (
        <div ref={ref} data-testid="drawer-content" {...props}>
          {children}
        </div>
      )
    },
  )
  Content.displayName = "VaulContent"

  const Title = ReactModule.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ children, ...props }, ref) => {
      TITLE_PROPS.push(props)
      return (
        <h2 ref={ref} data-testid="drawer-title" {...props}>
          {children}
        </h2>
      )
    },
  )
  Title.displayName = "VaulTitle"

  const Description = ReactModule.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => {
      DESCRIPTION_PROPS.push(props)
      return (
        <p ref={ref} data-testid="drawer-description" {...props}>
          {children}
        </p>
      )
    },
  )
  Description.displayName = "VaulDescription"

  return {
    Drawer: {
      Root,
      Trigger,
      Portal,
      Close,
      Overlay,
      Content,
      Title,
      Description,
    },
  }
})

describe("drawer", () => {
  afterEach(() => {
    cleanup()
    ROOT_PROPS.length = 0
    CONTENT_PROPS.length = 0
    TITLE_PROPS.length = 0
    DESCRIPTION_PROPS.length = 0
    document.body.removeAttribute("data-scroll-locked")
  })

  it("exports primitive aliases and applies default root behavior", () => {
    render(
      <Drawer>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerClose>Close</DrawerClose>
      </Drawer>,
    )

    expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-should-scale", "true")
    expect(ROOT_PROPS[0]).toMatchObject({ shouldScaleBackground: true })
    expect(screen.getByTestId("drawer-trigger")).toHaveTextContent("Open")
    expect(screen.getByTestId("drawer-close")).toHaveTextContent("Close")
    expect(DrawerPortal).toBeDefined()
    expect(DrawerTrigger).toBeDefined()
    expect(DrawerClose).toBeDefined()
  })

  it("allows overriding shouldScaleBackground on Drawer root", () => {
    render(<Drawer shouldScaleBackground={false}>Body</Drawer>)

    expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-should-scale", "false")
    expect(ROOT_PROPS[0]).toMatchObject({ shouldScaleBackground: false })
  })

  it("renders content inside portal with overlay, handle, children and merged classes", () => {
    render(
      <DrawerContent className="custom-content" aria-label="drawer panel">
        <span>Panel body</span>
      </DrawerContent>,
    )

    const portal = screen.getByTestId("drawer-portal")
    const overlay = within(portal).getByTestId("drawer-overlay")
    const content = within(portal).getByTestId("drawer-content")

    expect(portal).toBeInTheDocument()
    expect(overlay).toHaveClass("fixed", "inset-0", "z-50", "bg-black/80")
    expect(content).toHaveClass(
      "fixed",
      "inset-x-0",
      "bottom-0",
      "z-50",
      "mt-24",
      "flex",
      "h-auto",
      "flex-col",
      "rounded-t-[10px]",
      "border",
      "bg-background",
      "custom-content",
    )
    expect(content).toHaveAttribute("aria-label", "drawer panel")
    expect(content).toHaveTextContent("Panel body")
    const handle = content.firstElementChild
    expect(handle).not.toBeNull()
    expect(handle).toHaveClass("mx-auto", "mt-4", "h-2", "w-[100px]", "rounded-full", "bg-muted")
  })

  it("cleans scroll lock attribute on DrawerContent unmount", async () => {
    document.body.setAttribute("data-scroll-locked", "1")

    const view = render(<DrawerContent>Content</DrawerContent>)
    expect(document.body).toHaveAttribute("data-scroll-locked", "1")

    view.unmount()

    await waitFor(() => {
      expect(document.body.hasAttribute("data-scroll-locked")).toBe(false)
    })
  })

  it("renders header and footer with expected class names and custom class merge", () => {
    render(
      <>
        <DrawerHeader className="header-extra" data-testid="header">
          Heading
        </DrawerHeader>
        <DrawerFooter className="footer-extra" data-testid="footer">
          Actions
        </DrawerFooter>
      </>,
    )

    expect(screen.getByTestId("header")).toHaveClass("grid", "gap-1.5", "p-4", "text-center", "sm:text-left", "header-extra")
    expect(screen.getByTestId("header")).toHaveTextContent("Heading")
    expect(screen.getByTestId("footer")).toHaveClass("mt-auto", "flex", "flex-col", "gap-2", "p-4", "footer-extra")
    expect(screen.getByTestId("footer")).toHaveTextContent("Actions")
  })

  it("renders title and description with forwarded props and merged classes", () => {
    render(
      <>
        <DrawerTitle className="title-extra" aria-label="main title">
          Settings
        </DrawerTitle>
        <DrawerDescription className="desc-extra" aria-label="main description">
          Configure drawer options
        </DrawerDescription>
      </>,
    )

    const title = screen.getByTestId("drawer-title")
    const description = screen.getByTestId("drawer-description")

    expect(title).toHaveTextContent("Settings")
    expect(title).toHaveClass("text-lg", "font-semibold", "leading-none", "tracking-tight", "title-extra")
    expect(title).toHaveAttribute("aria-label", "main title")

    expect(description).toHaveTextContent("Configure drawer options")
    expect(description).toHaveClass("text-sm", "text-muted-foreground", "desc-extra")
    expect(description).toHaveAttribute("aria-label", "main description")
  })

  it("supports ref forwarding for overlay, content, title and description", () => {
    const overlayRef = React.createRef<HTMLDivElement>()
    const contentRef = React.createRef<HTMLDivElement>()
    const titleRef = React.createRef<HTMLHeadingElement>()
    const descriptionRef = React.createRef<HTMLParagraphElement>()

    render(
      <>
        <DrawerOverlay ref={overlayRef} />
        <DrawerContent ref={contentRef}>Body</DrawerContent>
        <DrawerTitle ref={titleRef}>Title</DrawerTitle>
        <DrawerDescription ref={descriptionRef}>Description</DrawerDescription>
      </>,
    )

    const allOverlays = screen.getAllByTestId("drawer-overlay")
    expect(overlayRef.current).toBe(allOverlays[0])
    expect(contentRef.current).toBe(screen.getByTestId("drawer-content"))
    expect(titleRef.current).toBe(screen.getByTestId("drawer-title"))
    expect(descriptionRef.current).toBe(screen.getByTestId("drawer-description"))
  })

  it("provides a valid QueryClientProvider wrapper for jsdom test environment", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(
      <Wrapper>
        <Drawer>Wrapped</Drawer>
      </Wrapper>,
    )

    expect(screen.getByTestId("drawer-root")).toHaveTextContent("Wrapped")
  })
})