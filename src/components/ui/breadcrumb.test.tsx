import React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./breadcrumb"

const { STABLE_CN } = vi.hoisted(() => ({
  STABLE_CN: (...values: Array<string | undefined>) =>
    values.filter(Boolean).join(" "),
}))

vi.mock("@/lib/utils", () => {
  return {
    cn: STABLE_CN,
  }
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe("Breadcrumb components", () => {
  it("renders Breadcrumb as a nav with aria-label breadcrumb and forwards ref", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLElement>()

    render(
      <Wrapper>
        <Breadcrumb ref={ref} data-testid="breadcrumb-nav">
          Content
        </Breadcrumb>
      </Wrapper>
    )

    const nav = screen.getByTestId("breadcrumb-nav")
    expect(nav.tagName.toLowerCase()).toBe("nav")
    expect(nav).toHaveAttribute("aria-label", "breadcrumb")
    expect(ref.current).toBe(nav)
    expect(nav).toHaveTextContent("Content")
  })

  it("renders BreadcrumbList as ol with default and custom classes", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLOListElement>()

    render(
      <Wrapper>
        <BreadcrumbList
          ref={ref}
          data-testid="breadcrumb-list"
          className="custom-class"
        >
          <li>Item</li>
        </BreadcrumbList>
      </Wrapper>
    )

    const list = screen.getByTestId("breadcrumb-list")
    expect(list.tagName.toLowerCase()).toBe("ol")
    expect(list).toHaveTextContent("Item")
    expect(list.className).toContain("flex")
    expect(list.className).toContain("custom-class")
    expect(ref.current).toBe(list)
  })

  it("renders BreadcrumbItem as li with default and custom classes", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLLIElement>()

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbItem
            ref={ref}
            data-testid="breadcrumb-item"
            className="item-class"
          >
            Crumb
          </BreadcrumbItem>
        </BreadcrumbList>
      </Wrapper>
    )

    const item = screen.getByTestId("breadcrumb-item")
    expect(item.tagName.toLowerCase()).toBe("li")
    expect(item).toHaveTextContent("Crumb")
    expect(item.className).toContain("inline-flex")
    expect(item.className).toContain("item-class")
    expect(ref.current).toBe(item)
  })

  it("renders BreadcrumbLink as anchor by default with transition class", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLAnchorElement>()

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/home"
              ref={ref}
              data-testid="breadcrumb-link"
              className="link-class"
            >
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Wrapper>
    )

    const link = screen.getByTestId("breadcrumb-link")
    expect(link.tagName.toLowerCase()).toBe("a")
    expect(link).toHaveAttribute("href", "/home")
    expect(link).toHaveTextContent("Home")
    expect(link.className).toContain("transition-colors")
    expect(link.className).toContain("link-class")
    expect(ref.current).toBe(link)
  })

  it("renders BreadcrumbLink with asChild and forwards ref to custom component", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLButtonElement>()

    const Button = React.forwardRef<
      HTMLButtonElement,
      React.ComponentProps<"button">
    >((props, buttonRef) => <button ref={buttonRef} {...props} />)
    Button.displayName = "TestButton"

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              ref={ref}
              data-testid="breadcrumb-link-child"
            >
              <Button type="button" className="btn-class">
                Go
              </Button>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Wrapper>
    )

    const button = screen.getByTestId("breadcrumb-link-child")
    expect(button.tagName.toLowerCase()).toBe("button")
    expect(button).toHaveTextContent("Go")
    expect(button.className).toContain("transition-colors")
    expect(button.className).toContain("btn-class")
    expect(ref.current).toBe(button)
  })

  it("renders BreadcrumbPage as span with aria attributes and classes", () => {
    const Wrapper = createWrapper()
    const ref = React.createRef<HTMLSpanElement>()

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage
              ref={ref}
              data-testid="breadcrumb-page"
              className="page-class"
            >
              Current
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Wrapper>
    )

    const page = screen.getByTestId("breadcrumb-page")
    expect(page.tagName.toLowerCase()).toBe("span")
    expect(page).toHaveTextContent("Current")
    expect(page).toHaveAttribute("role", "link")
    expect(page).toHaveAttribute("aria-disabled", "true")
    expect(page).toHaveAttribute("aria-current", "page")
    expect(page.className).toContain("font-normal")
    expect(page.className).toContain("page-class")
    expect(ref.current).toBe(page)
  })

  it("renders BreadcrumbSeparator with default ChevronRight icon", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbSeparator data-testid="breadcrumb-separator" />
        </BreadcrumbList>
      </Wrapper>
    )

    const sep = screen.getByTestId("breadcrumb-separator")
    expect(sep.tagName.toLowerCase()).toBe("li")
    expect(sep).toHaveAttribute("role", "presentation")
    expect(sep).toHaveAttribute("aria-hidden", "true")
    expect(sep.querySelector("svg")).not.toBeNull()
  })

  it("renders BreadcrumbSeparator with custom children", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbSeparator data-testid="breadcrumb-separator-custom">
            <span data-testid="custom-separator-child">/</span>
          </BreadcrumbSeparator>
        </BreadcrumbList>
      </Wrapper>
    )

    const customChild = screen.getByTestId("custom-separator-child")
    expect(customChild).toHaveTextContent("/")
  })

  it("renders BreadcrumbEllipsis with MoreHorizontal icon and sr-only More label", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <BreadcrumbList>
          <BreadcrumbEllipsis
            data-testid="breadcrumb-ellipsis"
            className="ellipsis-class"
          />
        </BreadcrumbList>
      </Wrapper>
    )

    const ellipsis = screen.getByTestId("breadcrumb-ellipsis")
    expect(ellipsis.tagName.toLowerCase()).toBe("span")
    expect(ellipsis).toHaveAttribute("role", "presentation")
    expect(ellipsis).toHaveAttribute("aria-hidden", "true")
    expect(ellipsis.className).toContain("flex")
    expect(ellipsis.className).toContain("ellipsis-class")
    const svg = ellipsis.querySelector("svg")
    expect(svg).not.toBeNull()
    const srOnly = ellipsis.querySelector(".sr-only")
    expect(srOnly).not.toBeNull()
    if (srOnly) {
      expect(srOnly).toHaveTextContent("More")
    }
  })

  it("composes a full breadcrumb trail with separator between items", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <Breadcrumb data-testid="breadcrumb-root">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Root</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/section">Section</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Current Page</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Wrapper>
    )

    const root = screen.getByTestId("breadcrumb-root")
    expect(root.querySelectorAll("li").length).toBe(5)
    expect(screen.getByText("Root")).toBeInTheDocument()
    expect(screen.getByText("Section")).toBeInTheDocument()
    expect(screen.getByText("Current Page")).toBeInTheDocument()
  })
})