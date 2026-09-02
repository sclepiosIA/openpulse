import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { Toggle, toggleVariants } from "./toggle"

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: Array<string | null | undefined | false>) => inputs.filter(Boolean).join(" "),
}))

describe("toggle.tsx", () => {
  it("exports toggleVariants with default classes", () => {
    const classes = toggleVariants({})
    expect(classes).toContain("inline-flex")
    expect(classes).toContain("bg-transparent")
    expect(classes).toContain("h-10")
    expect(classes).toContain("px-3")
  })

  it("applies outline and sm variant classes", () => {
    const classes = toggleVariants({ variant: "outline", size: "sm" })
    expect(classes).toContain("border")
    expect(classes).toContain("border-input")
    expect(classes).toContain("h-9")
    expect(classes).toContain("px-2.5")
  })

  it("renders a button with default styling and children", () => {
    render(<Toggle aria-label="Bold">Bold</Toggle>)

    const button = screen.getByRole("button", { name: "Bold" })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent("Bold")
    expect(button.className).toContain("inline-flex")
    expect(button.className).toContain("bg-transparent")
    expect(button.className).toContain("h-10")
    expect(button.className).toContain("px-3")
  })

  it("merges custom className with variant classes", () => {
    render(
      <Toggle aria-label="Italic" variant="outline" size="lg" className="custom-class">
        Italic
      </Toggle>
    )

    const button = screen.getByRole("button", { name: "Italic" })
    expect(button.className).toContain("custom-class")
    expect(button.className).toContain("border")
    expect(button.className).toContain("h-11")
    expect(button.className).toContain("px-5")
  })

  it("toggles pressed state on click", () => {
    render(<Toggle aria-label="Underline">Underline</Toggle>)

    const button = screen.getByRole("button", { name: "Underline" })
    expect(button).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(button)
    expect(button).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(button)
    expect(button).toHaveAttribute("aria-pressed", "false")
  })

  it("supports controlled pressed state and onPressedChange", () => {
    const onPressedChange = vi.fn()

    function ControlledExample() {
      const [pressed, setPressed] = React.useState(false)
      return (
        <Toggle
          aria-label="Controlled toggle"
          pressed={pressed}
          onPressedChange={(nextPressed) => {
            onPressedChange(nextPressed)
            setPressed(nextPressed)
          }}
        >
          Controlled toggle
        </Toggle>
      )
    }

    render(<ControlledExample />)

    const button = screen.getByRole("button", { name: "Controlled toggle" })
    expect(button).toHaveAttribute("aria-pressed", "false")

    fireEvent.click(button)

    expect(onPressedChange).toHaveBeenCalledTimes(1)
    expect(onPressedChange).toHaveBeenCalledWith(true)
    expect(button).toHaveAttribute("aria-pressed", "true")
  })

  it("forwards ref to the underlying button element", () => {
    const ref = React.createRef<HTMLButtonElement>()

    render(
      <Toggle ref={ref} aria-label="Ref toggle">
        Ref toggle
      </Toggle>
    )

    const button = screen.getByRole("button", { name: "Ref toggle" })
    expect(ref.current).toBe(button)
    expect(ref.current?.tagName).toBe("BUTTON")
  })

  it("passes through disabled prop", () => {
    render(
      <Toggle aria-label="Disabled toggle" disabled>
        Disabled toggle
      </Toggle>
    )

    const button = screen.getByRole("button", { name: "Disabled toggle" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("data-disabled")
  })

  it("sets displayName from radix root", () => {
    expect(Toggle.displayName).toBeDefined()
    expect(typeof Toggle.displayName).toBe("string")
  })
})