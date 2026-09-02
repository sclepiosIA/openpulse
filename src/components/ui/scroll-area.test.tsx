import React from "react"
import { render, screen } from "@testing-library/react"

const { mockCn, MockRoot, MockViewport, MockScrollbar, MockThumb, MockCorner } = vi.hoisted(() => {
  const mockCn = (...args: unknown[]) =>
    args
      .flat()
      .filter(Boolean)
      .join(" ")

  const MockRoot = ({ children, className, ...props }: any) => (
    <div data-testid="radix-root" className={className} {...props}>
      {children}
    </div>
  )
  const MockViewport = ({ children, className, ...props }: any) => (
    <div data-testid="radix-viewport" className={className} {...props}>
      {children}
    </div>
  )
  const MockScrollbar = ({ children, className, orientation, ...props }: any) => (
    <div data-testid="radix-scrollbar" className={className} data-orientation={orientation} {...props}>
      {children}
    </div>
  )
  const MockThumb = ({ className, ...props }: any) => (
    <div data-testid="radix-thumb" className={className} {...props} />
  )
  const MockCorner = ({ className, ...props }: any) => (
    <div data-testid="radix-corner" className={className} {...props} />
  )

  return { mockCn, MockRoot, MockViewport, MockScrollbar, MockThumb, MockCorner }
})

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}))

vi.mock("@radix-ui/react-scroll-area", () => ({
  Root: MockRoot,
  Viewport: MockViewport,
  ScrollAreaScrollbar: MockScrollbar,
  ScrollAreaThumb: MockThumb,
  Corner: MockCorner,
}))

import { ScrollArea, ScrollBar } from "./scroll-area"

describe("ScrollArea", () => {
  it("rend correctement la structure avec enfants et classes fusionnées", () => {
    render(
      <ScrollArea className="extra-class" data-qa="qa-attr">
        <div data-testid="child">content</div>
      </ScrollArea>
    )

    const root = screen.getByTestId("radix-root")
    const viewport = screen.getByTestId("radix-viewport")
    const scrollbar = screen.getByTestId("radix-scrollbar")
    const corner = screen.getByTestId("radix-corner")
    const child = screen.getByTestId("child")

    expect(root).toBeInTheDocument()
    expect(viewport).toBeInTheDocument()
    expect(scrollbar).toBeInTheDocument()
    expect(corner).toBeInTheDocument()
    expect(viewport).toContainElement(child)

    const rootClass = root.getAttribute("class") || ""
    expect(rootClass).toContain("relative")
    expect(rootClass).toContain("overflow-hidden")
    expect(rootClass).toContain("extra-class")

    expect(root).toHaveAttribute("data-qa", "qa-attr")
  })

  it("applique un ScrollBar vertical par défaut dans ScrollArea", () => {
    render(
      <ScrollArea>
        <div>ok</div>
      </ScrollArea>
    )
    const scrollbar = screen.getByTestId("radix-scrollbar")
    const className = scrollbar.getAttribute("class") || ""

    expect(scrollbar.getAttribute("data-orientation")).toBe("vertical")
    expect(className).toContain("h-full")
    expect(className).toContain("w-2.5")
    expect(className).toContain("border-l")
    expect(className).toContain("border-l-transparent")
    expect(className).toContain("p-[1px]")

    // le thumb interne est rendu
    const thumb = screen.getByTestId("radix-thumb")
    expect(thumb).toBeInTheDocument()
    const thumbClass = thumb.getAttribute("class") || ""
    expect(thumbClass).toContain("bg-border")
  })
})

describe("ScrollBar", () => {
  it("rend en orientation verticale par défaut avec classes appropriées", () => {
    render(<ScrollBar />)
    const scrollbar = screen.getByTestId("radix-scrollbar")
    const className = scrollbar.getAttribute("class") || ""

    expect(scrollbar.getAttribute("data-orientation")).toBe("vertical")
    expect(className).toContain("flex")
    expect(className).toContain("touch-none")
    expect(className).toContain("select-none")
    expect(className).toContain("transition-colors")
    expect(className).toContain("h-full")
    expect(className).toContain("w-2.5")
    expect(className).toContain("border-l")
    expect(className).toContain("border-l-transparent")
    expect(className).toContain("p-[1px]")
  })

  it("rend en orientation horizontale avec classes appropriées et fusionne className", () => {
    render(<ScrollBar orientation="horizontal" className="custom-x" />)
    const scrollbar = screen.getByTestId("radix-scrollbar")
    const className = scrollbar.getAttribute("class") || ""

    expect(scrollbar.getAttribute("data-orientation")).toBe("horizontal")
    expect(className).toContain("flex")
    expect(className).toContain("touch-none")
    expect(className).toContain("select-none")
    expect(className).toContain("transition-colors")
    expect(className).toContain("h-2.5")
    expect(className).toContain("flex-col")
    expect(className).toContain("border-t")
    expect(className).toContain("border-t-transparent")
    expect(className).toContain("p-[1px]")
    expect(className).toContain("custom-x")

    expect(className).not.toContain("h-full")
    expect(className).not.toContain("w-2.5")
  })
})