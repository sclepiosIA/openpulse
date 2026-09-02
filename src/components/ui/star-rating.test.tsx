import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(" "),
}))

vi.mock("lucide-react", () => ({
  Star: ({ size, className }: { size?: number; className?: string }) => (
    <svg
      data-testid="star-icon"
      data-size={typeof size === "number" ? String(size) : ""}
      className={className}
    />
  ),
}))

import { StarRating } from "./star-rating"

describe("StarRating", () => {
  it("rend le bon nombre d'étoiles, reflète value par les classes, et affiche la valeur + label", () => {
    const onChange = vi.fn()
    render(
      <StarRating
        value={3}
        onChange={onChange}
        max={5}
        size={18}
        labels={["nul", "moyen", "bien", "très bien", "excellent"]}
      />
    )

    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(5)
    expect(screen.getByRole("button", { name: "1 étoile" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "2 étoiles" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "3 étoiles" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "4 étoiles" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "5 étoiles" })).toBeTruthy()

    const stars = screen.getAllByTestId("star-icon")
    expect(stars).toHaveLength(5)

    expect(stars[0].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars[1].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars[2].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars[3].getAttribute("class") || "").toContain("fill-none")
    expect(stars[4].getAttribute("class") || "").toContain("fill-none")

    expect(stars[0].getAttribute("data-size")).toBe("18")

    expect(screen.getByText("3/5")).toBeTruthy()
    expect(screen.getByText("- bien")).toBeTruthy()
  })

  it("affiche 'Non évalué' quand value=0 (showValue=true)", () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} max={5} />)

    expect(screen.getByText("Non évalué")).toBeTruthy()
    expect(screen.queryByText("0/5")).toBeNull()
  })

  it("cache l'affichage de la valeur quand showValue=false", () => {
    const onChange = vi.fn()
    render(<StarRating value={4} onChange={onChange} max={5} showValue={false} />)

    expect(screen.queryByText("Non évalué")).toBeNull()
    expect(screen.queryByText("4/5")).toBeNull()
  })

  it("survole: remplit temporairement selon hoverValue puis revient à value, et clique appelle onChange avec la valeur", () => {
    const onChange = vi.fn()
    render(<StarRating value={2} onChange={onChange} max={5} />)

    const star4Btn = screen.getByRole("button", { name: "4 étoiles" })
    const stars = () => screen.getAllByTestId("star-icon")

    expect(stars()[0].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[1].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[2].getAttribute("class") || "").toContain("fill-none")
    expect(stars()[3].getAttribute("class") || "").toContain("fill-none")

    fireEvent.mouseEnter(star4Btn)
    expect(stars()[0].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[1].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[2].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[3].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[4].getAttribute("class") || "").toContain("fill-none")

    fireEvent.mouseLeave(star4Btn)
    expect(stars()[0].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[1].getAttribute("class") || "").toContain("fill-yellow-500")
    expect(stars()[2].getAttribute("class") || "").toContain("fill-none")
    expect(stars()[3].getAttribute("class") || "").toContain("fill-none")

    fireEvent.click(star4Btn)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it("getLabel: borne l'index si labels plus courts que max", () => {
    const onChange = vi.fn()
    render(<StarRating value={5} onChange={onChange} max={7} labels={["a", "b", "c"]} />)

    expect(screen.getByText("5/7")).toBeTruthy()
    expect(screen.getByText("- c")).toBeTruthy()
  })

  it("getLabel: n'affiche pas de label quand labels est vide", () => {
    const onChange = vi.fn()
    render(<StarRating value={2} onChange={onChange} max={5} labels={[]} />)

    expect(screen.getByText("2/5")).toBeTruthy()
    expect(screen.queryByText(/- /)).toBeNull()
  })
})