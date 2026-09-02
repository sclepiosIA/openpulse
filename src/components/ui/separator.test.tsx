// @vitest-environment jsdom

import * as React from "react"
import { render, screen } from "@testing-library/react"

const { cnMock, ROOT_DISPLAY_NAME } = vi.hoisted(() => ({
  cnMock: vi.fn((...inputs: Array<string | undefined | false | null>) =>
    inputs.filter(Boolean).join(" ")
  ),
  ROOT_DISPLAY_NAME: "SeparatorRoot",
}))

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}))

vi.mock("@radix-ui/react-separator", async () => {
  const ReactModule = await import("react")

  const Root = ReactModule.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
      orientation?: "horizontal" | "vertical"
      decorative?: boolean
    }
  >(({ orientation, decorative, className, ...props }, ref) => (
    <div
      ref={ref}
      data-testid="separator-root"
      data-orientation={orientation}
      data-decorative={String(decorative)}
      className={className}
      {...props}
    />
  ))

  Root.displayName = ROOT_DISPLAY_NAME

  return { Root }
})

import { Separator } from "./separator"

describe("Separator", () => {
  beforeEach(() => {
    cnMock.mockClear()
  })

  it("rend avec les props par défaut horizontal et decorative=true", () => {
    render(<Separator data-testid="sut" />)

    const element = screen.getByTestId("sut")
    expect(element).toBeInTheDocument()
    expect(element).toHaveAttribute("data-orientation", "horizontal")
    expect(element).toHaveAttribute("data-decorative", "true")
    expect(element).toHaveClass("shrink-0", "bg-border", "h-[1px]", "w-full")

    expect(cnMock).toHaveBeenCalledTimes(1)
    expect(cnMock).toHaveBeenCalledWith(
      "shrink-0 bg-border",
      "h-[1px] w-full",
      undefined
    )
  })

  it("rend en vertical et fusionne la className personnalisée", () => {
    render(<Separator orientation="vertical" className="custom-class" data-testid="sut" />)

    const element = screen.getByTestId("sut")
    expect(element).toHaveAttribute("data-orientation", "vertical")
    expect(element).toHaveAttribute("data-decorative", "true")
    expect(element).toHaveClass("shrink-0", "bg-border", "h-full", "w-[1px]", "custom-class")

    expect(cnMock).toHaveBeenCalledTimes(1)
    expect(cnMock).toHaveBeenLastCalledWith(
      "shrink-0 bg-border",
      "h-full w-[1px]",
      "custom-class"
    )
  })

  it("propage decorative=false et les autres props au composant racine", () => {
    render(
      <Separator
        decorative={false}
        role="separator"
        aria-label="section split"
        id="sep-id"
        data-testid="sut"
      />
    )

    const element = screen.getByTestId("sut")
    expect(element).toHaveAttribute("data-decorative", "false")
    expect(element).toHaveAttribute("role", "separator")
    expect(element).toHaveAttribute("aria-label", "section split")
    expect(element).toHaveAttribute("id", "sep-id")
  })

  it("forward correctement la ref vers l'élément rendu", () => {
    const ref = React.createRef<HTMLDivElement>()

    render(<Separator ref={ref} data-testid="sut" />)

    const element = screen.getByTestId("sut")
    expect(ref.current).toBe(element)
  })

  it("définit displayName depuis le primitive Root", () => {
    expect(Separator.displayName).toBe(ROOT_DISPLAY_NAME)
    expect(typeof Separator.displayName).toBe("string")
  })
})