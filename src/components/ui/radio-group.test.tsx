/* @vitest-environment jsdom */

import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { RadioGroup, RadioGroupItem } from "./radio-group"

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: Array<string | undefined | null | false>) => inputs.filter(Boolean).join(" "),
}))

describe("radio-group", () => {
  it("render RadioGroup avec les classes de base et les props", () => {
    render(
      <RadioGroup data-testid="group" className="custom-grid" aria-label="Options">
        <RadioGroupItem value="a" />
        <RadioGroupItem value="b" />
      </RadioGroup>
    )

    const group = screen.getByTestId("group")
    expect(group).toBeInTheDocument()
    expect(group).toHaveAttribute("role", "radiogroup")
    expect(group).toHaveAttribute("aria-label", "Options")
    expect(group).toHaveClass("grid")
    expect(group).toHaveClass("gap-2")
    expect(group).toHaveClass("custom-grid")
  })

  it("render RadioGroupItem avec les classes par défaut et la classe custom", () => {
    render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" className="custom-item" aria-label="Option A" />
      </RadioGroup>
    )

    const item = screen.getByRole("radio", { name: "Option A" })
    expect(item).toBeInTheDocument()
    expect(item).toHaveClass("aspect-square")
    expect(item).toHaveClass("h-4")
    expect(item).toHaveClass("w-4")
    expect(item).toHaveClass("rounded-full")
    expect(item).toHaveClass("border")
    expect(item).toHaveClass("border-primary")
    expect(item).toHaveClass("text-primary")
    expect(item).toHaveClass("ring-offset-background")
    expect(item).toHaveClass("focus:outline-none")
    expect(item).toHaveClass("focus-visible:ring-2")
    expect(item).toHaveClass("focus-visible:ring-ring")
    expect(item).toHaveClass("focus-visible:ring-offset-2")
    expect(item).toHaveClass("disabled:cursor-not-allowed")
    expect(item).toHaveClass("disabled:opacity-50")
    expect(item).toHaveClass("custom-item")
  })

  it("gère la sélection contrôlée via onValueChange", () => {
    const onValueChange = vi.fn()

    render(
      <RadioGroup aria-label="Choix" onValueChange={onValueChange}>
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    )

    const optionA = screen.getByRole("radio", { name: "Option A" })
    const optionB = screen.getByRole("radio", { name: "Option B" })

    expect(optionA).toHaveAttribute("aria-checked", "false")
    expect(optionB).toHaveAttribute("aria-checked", "false")

    fireEvent.click(optionB)

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("affiche l'état sélectionné avec defaultValue", () => {
    render(
      <RadioGroup aria-label="Choix" defaultValue="b">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    )

    const optionA = screen.getByRole("radio", { name: "Option A" })
    const optionB = screen.getByRole("radio", { name: "Option B" })

    expect(optionA).toHaveAttribute("aria-checked", "false")
    expect(optionB).toHaveAttribute("aria-checked", "true")
  })

  it("propage le disabled aux items", () => {
    render(
      <RadioGroup aria-label="Choix" disabled>
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    )

    const optionA = screen.getByRole("radio", { name: "Option A" })
    const optionB = screen.getByRole("radio", { name: "Option B" })

    expect(optionA).toBeDisabled()
    expect(optionB).toBeDisabled()
  })

  it("forward la ref du groupe vers l'élément DOM", () => {
    const ref = React.createRef<HTMLDivElement>()

    render(
      <RadioGroup ref={ref} aria-label="Choix">
        <RadioGroupItem value="a" aria-label="Option A" />
      </RadioGroup>
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.getAttribute("role")).toBe("radiogroup")
  })

  it("forward la ref de l'item vers l'élément bouton", () => {
    const ref = React.createRef<HTMLButtonElement>()

    render(
      <RadioGroup aria-label="Choix">
        <RadioGroupItem ref={ref} value="a" aria-label="Option A" />
      </RadioGroup>
    )

    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current?.getAttribute("role")).toBe("radio")
  })

  it("affiche l'indicator avec l'icône pour l'option sélectionnée", () => {
    const { container } = render(
      <RadioGroup aria-label="Choix" defaultValue="a">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    )

    const selectedItem = screen.getByRole("radio", { name: "Option A" })
    expect(selectedItem).toHaveAttribute("data-state", "checked")

    const indicator = container.querySelector('[data-state="checked"] span, [data-state="checked"]')
    expect(indicator).not.toBeNull()

    const svg = selectedItem.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass("h-2.5")
    expect(svg).toHaveClass("w-2.5")
    expect(svg).toHaveClass("fill-current")
    expect(svg).toHaveClass("text-current")
  })

  it("expose les displayName Radix", () => {
    expect(RadioGroup.displayName).toBeDefined()
    expect(RadioGroupItem.displayName).toBeDefined()
  })
})