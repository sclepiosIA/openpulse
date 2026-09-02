import React from "react"
import { render, screen } from "@testing-library/react"

const { ICONS, cnMock, buttonVariantsMock } = vi.hoisted(() => ({
  ICONS: {
    ChevronLeft: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="chevron-left-icon" {...props} />
    ),
    ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="chevron-right-icon" {...props} />
    ),
    MoreHorizontal: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="more-horizontal-icon" {...props} />
    ),
  },
  cnMock: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(" "),
  buttonVariantsMock: (options: { variant?: string; size?: string }) =>
    `btn-variant-${options.variant ?? "ghost"} btn-size-${options.size ?? "default"}`,
}))

vi.mock("lucide-react", () => ({
  ChevronLeft: ICONS.ChevronLeft,
  ChevronRight: ICONS.ChevronRight,
  MoreHorizontal: ICONS.MoreHorizontal,
}))

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}))

vi.mock("@/components/ui/button", () => ({
  buttonVariants: buttonVariantsMock,
}))

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination"

describe("Pagination components", () => {
  it("renders Pagination as a nav with correct role, label and custom class", () => {
    render(<Pagination className="custom-nav-class" data-testid="pagination-nav" />)

    const nav = screen.getByTestId("pagination-nav")
    expect(nav.tagName.toLowerCase()).toBe("nav")
    expect(nav).toHaveAttribute("role", "navigation")
    expect(nav).toHaveAttribute("aria-label", "pagination")
    expect(nav.className).toContain("mx-auto")
    expect(nav.className).toContain("flex")
    expect(nav.className).toContain("justify-center")
    expect(nav.className).toContain("custom-nav-class")
  })

  it("renders PaginationContent as a list with default and custom classes", () => {
    render(
      <PaginationContent
        className="custom-ul-class"
        data-testid="pagination-content"
      />
    )

    const ul = screen.getByTestId("pagination-content")
    expect(ul.tagName.toLowerCase()).toBe("ul")
    expect(ul.className).toContain("flex")
    expect(ul.className).toContain("flex-row")
    expect(ul.className).toContain("items-center")
    expect(ul.className).toContain("gap-1")
    expect(ul.className).toContain("custom-ul-class")
  })

  it("renders PaginationItem as a list item and applies custom class", () => {
    render(
      <PaginationItem className="custom-li-class" data-testid="pagination-item">
        Item
      </PaginationItem>
    )

    const li = screen.getByTestId("pagination-item")
    expect(li.tagName.toLowerCase()).toBe("li")
    expect(li.className).toContain("custom-li-class")
    expect(li).toHaveTextContent("Item")
  })

  it("renders PaginationLink as anchor with button variants, not active by default", () => {
    render(
      <PaginationLink href="#page-1" data-testid="pagination-link">
        1
      </PaginationLink>
    )

    const link = screen.getByTestId("pagination-link")
    expect(link.tagName.toLowerCase()).toBe("a")
    expect(link).not.toHaveAttribute("aria-current")
    expect(link.className).toContain("btn-variant-ghost")
    expect(link.className).toContain("btn-size-icon")
    expect(link.textContent).toBe("1")
    expect(link).toHaveAttribute("href", "#page-1")
  })

  it("renders active PaginationLink with aria-current and outline variant", () => {
    render(
      <PaginationLink
        href="#page-2"
        isActive
        size="default"
        className="extra-class"
        data-testid="pagination-link-active"
      >
        2
      </PaginationLink>
    )

    const link = screen.getByTestId("pagination-link-active")
    expect(link).toHaveAttribute("aria-current", "page")
    expect(link.className).toContain("btn-variant-outline")
    expect(link.className).toContain("btn-size-default")
    expect(link.className).toContain("extra-class")
  })

  it("renders PaginationPrevious with label, icon and default size", () => {
    render(
      <PaginationPrevious
        href="#prev"
        className="prev-class"
        data-testid="pagination-previous"
      />
    )

    const prev = screen.getByTestId("pagination-previous")
    expect(prev.tagName.toLowerCase()).toBe("a")
    expect(prev).toHaveAttribute("aria-label", "Go to previous page")
    expect(prev).toHaveAttribute("href", "#prev")
    expect(prev.className).toContain("btn-size-default")
    expect(prev.className).toContain("gap-1")
    expect(prev.className).toContain("pl-2.5")
    expect(prev.className).toContain("prev-class")
    expect(screen.getByText("Previous")).toBeInTheDocument()
    expect(screen.getByTestId("chevron-left-icon")).toBeInTheDocument()
  })

  it("renders PaginationNext with label, icon and default size", () => {
    render(
      <PaginationNext
        href="#next"
        className="next-class"
        data-testid="pagination-next"
      />
    )

    const next = screen.getByTestId("pagination-next")
    expect(next.tagName.toLowerCase()).toBe("a")
    expect(next).toHaveAttribute("aria-label", "Go to next page")
    expect(next).toHaveAttribute("href", "#next")
    expect(next.className).toContain("btn-size-default")
    expect(next.className).toContain("gap-1")
    expect(next.className).toContain("pr-2.5")
    expect(next.className).toContain("next-class")
    expect(screen.getByText("Next")).toBeInTheDocument()
    expect(screen.getByTestId("chevron-right-icon")).toBeInTheDocument()
  })

  it("renders PaginationEllipsis as span with icon and sr-only text", () => {
    render(
      <PaginationEllipsis
        className="ellipsis-class"
        data-testid="pagination-ellipsis"
      />
    )

    const ellipsis = screen.getByTestId("pagination-ellipsis")
    expect(ellipsis.tagName.toLowerCase()).toBe("span")
    expect(ellipsis).toHaveAttribute("aria-hidden")
    expect(ellipsis.className).toContain("flex")
    expect(ellipsis.className).toContain("h-9")
    expect(ellipsis.className).toContain("w-9")
    expect(ellipsis.className).toContain("items-center")
    expect(ellipsis.className).toContain("justify-center")
    expect(ellipsis.className).toContain("ellipsis-class")
    expect(screen.getByTestId("more-horizontal-icon")).toBeInTheDocument()
    expect(screen.getByText("More pages")).toBeInTheDocument()
  })
})