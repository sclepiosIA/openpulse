import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as React from "react"

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: Array<unknown>) => inputs.filter(Boolean).join(" "),
}))

vi.mock("lucide-react", () => ({
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-down" {...props} />
  ),
}))

const radix = vi.hoisted(() => {
  const ReactNs = require("react") as typeof import("react")

  const Root = ReactNs.forwardRef<HTMLDivElement, ReactNs.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div data-testid="radix-root" ref={ref} {...props}>
        {children}
      </div>
    )
  )
  Root.displayName = "NavigationMenuRoot"

  const List = ReactNs.forwardRef<HTMLUListElement, ReactNs.HTMLAttributes<HTMLUListElement>>(
    ({ children, ...props }, ref) => (
      <ul data-testid="radix-list" ref={ref} {...props}>
        {children}
      </ul>
    )
  )
  List.displayName = "NavigationMenuList"

  const Item = ({ children, ...props }: ReactNs.HTMLAttributes<HTMLLIElement>) => (
    <li data-testid="radix-item" {...props}>
      {children}
    </li>
  )

  const Trigger = ReactNs.forwardRef<
    HTMLButtonElement,
    ReactNs.ButtonHTMLAttributes<HTMLButtonElement> & { "data-state"?: string }
  >(({ onClick, ...props }, ref) => {
    const [open, setOpen] = ReactNs.useState(false)
    const state = open ? "open" : "closed"
    return (
      <button
        data-testid="radix-trigger"
        data-state={state}
        ref={ref}
        onClick={(e) => {
          setOpen((v) => !v)
          onClick?.(e)
        }}
        {...props}
      />
    )
  })
  Trigger.displayName = "NavigationMenuTrigger"

  const Content = ReactNs.forwardRef<HTMLDivElement, ReactNs.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div data-testid="radix-content" ref={ref} {...props}>
        {children}
      </div>
    )
  )
  Content.displayName = "NavigationMenuContent"

  const Link = ReactNs.forwardRef<HTMLAnchorElement, ReactNs.AnchorHTMLAttributes<HTMLAnchorElement>>(
    ({ children, ...props }, ref) => (
      <a data-testid="radix-link" ref={ref} {...props}>
        {children}
      </a>
    )
  )
  Link.displayName = "NavigationMenuLink"

  const Viewport = ReactNs.forwardRef<HTMLDivElement, ReactNs.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div data-testid="radix-viewport" ref={ref} {...props}>
        {children}
      </div>
    )
  )
  Viewport.displayName = "NavigationMenuViewport"

  const Indicator = ReactNs.forwardRef<HTMLDivElement, ReactNs.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div data-testid="radix-indicator" ref={ref} {...props}>
        {children}
      </div>
    )
  )
  Indicator.displayName = "NavigationMenuIndicator"

  return { Root, List, Item, Trigger, Content, Link, Viewport, Indicator }
})

vi.mock("@radix-ui/react-navigation-menu", () => ({
  Root: radix.Root,
  List: radix.List,
  Item: radix.Item,
  Trigger: radix.Trigger,
  Content: radix.Content,
  Link: radix.Link,
  Viewport: radix.Viewport,
  Indicator: radix.Indicator,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("navigation-menu.tsx", () => {
  it("render NavigationMenu root, injects viewport, and merges classes", async () => {
    const mod = await import("./navigation-menu")
    renderWithClient(
      <mod.NavigationMenu className="custom-root">
        <div data-testid="child">Child</div>
      </mod.NavigationMenu>
    )

    const root = screen.getByTestId("radix-root")
    expect(root.className).toContain("relative z-10 flex max-w-max flex-1 items-center justify-center")
    expect(root.className).toContain("custom-root")

    expect(screen.getByTestId("child")).toBeInTheDocument()
    expect(screen.getByTestId("radix-viewport")).toBeInTheDocument()
  })

  it("NavigationMenuTrigger includes ChevronDown icon and applies trigger style classes; state toggles on click", async () => {
    const mod = await import("./navigation-menu")
    renderWithClient(
      <mod.NavigationMenu>
        <mod.NavigationMenuList>
          <mod.NavigationMenuItem>
            <mod.NavigationMenuTrigger className="custom-trigger">Open</mod.NavigationMenuTrigger>
          </mod.NavigationMenuItem>
        </mod.NavigationMenuList>
      </mod.NavigationMenu>
    )

    const trigger = screen.getByTestId("radix-trigger")
    expect(trigger).toHaveTextContent("Open")
    expect(trigger.className).toContain("group inline-flex h-10 w-max items-center justify-center rounded-md")
    expect(trigger.className).toContain("custom-trigger")

    const chevron = screen.getByTestId("chevron-down")
    expect(chevron).toHaveAttribute("aria-hidden", "true")
    expect(chevron.getAttribute("class") || "").toContain("group-data-[state=open]:rotate-180")

    expect(trigger.getAttribute("data-state")).toBe("closed")
    fireEvent.click(trigger)
    expect(trigger.getAttribute("data-state")).toBe("open")
  })

  it("NavigationMenuContent/List/Indicator/Viewport merge their base classes with custom className", async () => {
    const mod = await import("./navigation-menu")
    renderWithClient(
      <mod.NavigationMenu>
        <mod.NavigationMenuList className="custom-list">
          <mod.NavigationMenuItem>
            <mod.NavigationMenuTrigger>Menu</mod.NavigationMenuTrigger>
            <mod.NavigationMenuContent className="custom-content">
              <mod.NavigationMenuLink href="/x">Link</mod.NavigationMenuLink>
            </mod.NavigationMenuContent>
          </mod.NavigationMenuItem>
        </mod.NavigationMenuList>
        <mod.NavigationMenuIndicator className="custom-indicator" />
        <mod.NavigationMenuViewport className="custom-viewport" />
      </mod.NavigationMenu>
    )

    const list = screen.getByTestId("radix-list")
    expect(list.className).toContain("group flex flex-1 list-none items-center justify-center space-x-1")
    expect(list.className).toContain("custom-list")

    const content = screen.getByTestId("radix-content")
    expect(content.className).toContain("left-0 top-0 w-full data-[motion^=from-]:animate-in")
    expect(content.className).toContain("custom-content")

    const indicator = screen.getByTestId("radix-indicator")
    expect(indicator.className).toContain("top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden")
    expect(indicator.className).toContain("custom-indicator")

    const viewports = screen.getAllByTestId("radix-viewport")
    expect(viewports.some((v) => (v.getAttribute("class") || "").includes("custom-viewport"))).toBe(true)

    expect(screen.getByTestId("radix-link")).toHaveAttribute("href", "/x")
  })

  it("navigationMenuTriggerStyle returns base trigger class string", async () => {
    const mod = await import("./navigation-menu")
    const cls = mod.navigationMenuTriggerStyle()
    expect(typeof cls).toBe("string")
    expect(cls).toContain("group inline-flex h-10 w-max items-center justify-center")
    expect(cls).toContain("data-[state=open]:bg-accent/50")
  })
})