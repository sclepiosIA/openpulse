/* @vitest-environment jsdom */
import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(" "),
}))

vi.mock("@/components/ui/toggle", () => ({
  toggleVariants: ({
    variant,
    size,
  }: {
    variant?: string | null
    size?: string | null
  }) => `toggle variant-${variant ?? "default"} size-${size ?? "default"}`,
}))

describe("ToggleGroup", () => {
  it("rend le conteneur avec les classes de base et la classe personnalisée", () => {
    render(
      <ToggleGroup
        type="single"
        aria-label="formats"
        className="custom-group"
        data-testid="group"
      >
        <ToggleGroupItem value="bold" aria-label="Bold">
          B
        </ToggleGroupItem>
      </ToggleGroup>
    )

    const group = screen.getByTestId("group")
    expect(group).toHaveClass("flex")
    expect(group).toHaveClass("items-center")
    expect(group).toHaveClass("justify-center")
    expect(group).toHaveClass("gap-1")
    expect(group).toHaveClass("custom-group")
    expect(group).toHaveAttribute("role", "group")
  })

  it("propage variant et size du groupe aux items", () => {
    render(
      <ToggleGroup type="single" variant="outline" size="sm" aria-label="alignment">
        <ToggleGroupItem value="left" aria-label="Left">
          Left
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Center">
          Center
        </ToggleGroupItem>
      </ToggleGroup>
    )

    const left = screen.getByRole("radio", { name: "Left" })
    const center = screen.getByRole("radio", { name: "Center" })

    expect(left).toHaveClass("toggle")
    expect(left).toHaveClass("variant-outline")
    expect(left).toHaveClass("size-sm")

    expect(center).toHaveClass("toggle")
    expect(center).toHaveClass("variant-outline")
    expect(center).toHaveClass("size-sm")
  })

  it("utilise les props de l'item quand le groupe ne fournit pas de variant/size", () => {
    render(
      <ToggleGroup type="single" aria-label="view">
        <ToggleGroupItem value="grid" variant="ghost" size="lg" aria-label="Grid">
          Grid
        </ToggleGroupItem>
      </ToggleGroup>
    )

    const item = screen.getByRole("radio", { name: "Grid" })
    expect(item).toHaveClass("variant-ghost")
    expect(item).toHaveClass("size-lg")
  })

  it("priorise le contexte du groupe sur variant/size passés à l'item", () => {
    render(
      <ToggleGroup type="single" variant="default" size="sm" aria-label="devices">
        <ToggleGroupItem value="mobile" variant="ghost" size="lg" aria-label="Mobile">
          Mobile
        </ToggleGroupItem>
      </ToggleGroup>
    )

    const item = screen.getByRole("radio", { name: "Mobile" })
    expect(item).toHaveClass("variant-default")
    expect(item).toHaveClass("size-sm")
    expect(item).not.toHaveClass("variant-ghost")
    expect(item).not.toHaveClass("size-lg")
  })

  it("fusionne la classe personnalisée de l'item avec les variantes calculées", () => {
    render(
      <ToggleGroup type="single" variant="outline" size="default" aria-label="text style">
        <ToggleGroupItem value="italic" className="custom-item" aria-label="Italic">
          Italic
        </ToggleGroupItem>
      </ToggleGroup>
    )

    const item = screen.getByRole("radio", { name: "Italic" })
    expect(item).toHaveClass("custom-item")
    expect(item).toHaveClass("variant-outline")
    expect(item).toHaveClass("size-default")
  })

  it("relaie le comportement Radix et déclenche onValueChange avec la vraie valeur sélectionnée", () => {
    const onValueChange = vi.fn()

    render(
      <ToggleGroup type="single" aria-label="editor tools" onValueChange={onValueChange}>
        <ToggleGroupItem value="bold" aria-label="Bold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">
          I
        </ToggleGroupItem>
      </ToggleGroup>
    )

    fireEvent.click(screen.getByRole("radio", { name: "Bold" }))
    expect(onValueChange).toHaveBeenCalledWith("bold")

    fireEvent.click(screen.getByRole("radio", { name: "Italic" }))
    expect(onValueChange).toHaveBeenLastCalledWith("italic")
  })

  it("expose correctement la ref du groupe vers l'élément DOM racine", () => {
    const ref = React.createRef<HTMLDivElement>()

    render(
      <ToggleGroup ref={ref} type="single" aria-label="sizes">
        <ToggleGroupItem value="s" aria-label="S">
          S
        </ToggleGroupItem>
      </ToggleGroup>
    )

    expect(ref.current).toBeInstanceOf(HTMLElement)
    expect(ref.current?.getAttribute("role")).toBe("group")
  })

  it("expose correctement la ref d'un item vers le bouton DOM", () => {
    const ref = React.createRef<HTMLButtonElement>()

    render(
      <ToggleGroup type="single" aria-label="weight">
        <ToggleGroupItem ref={ref} value="bold" aria-label="Bold">
          Bold
        </ToggleGroupItem>
      </ToggleGroup>
    )

    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current?.textContent).toBe("Bold")
    expect(ref.current?.getAttribute("role")).toBe("radio")
  })
})