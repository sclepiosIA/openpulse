/* @vitest-environment jsdom */
import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Label } from "./label"

const { cnMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ")),
}))

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}))

describe("Label", () => {
  it("rend un label avec le texte et les attributs transmis", () => {
    render(
      <Label htmlFor="email" data-testid="label">
        Email
      </Label>
    )

    const label = screen.getByTestId("label")
    expect(label.tagName).toBe("LABEL")
    expect(label).toHaveTextContent("Email")
    expect(label).toHaveAttribute("for", "email")
  })

  it("compose les classes de base avec className via cn", () => {
    render(
      <Label data-testid="label" className="custom-class">
        Nom
      </Label>
    )

    expect(cnMock).toHaveBeenCalledWith(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      "custom-class"
    )

    expect(screen.getByTestId("label")).toHaveClass(
      "text-sm",
      "font-medium",
      "leading-none",
      "peer-disabled:cursor-not-allowed",
      "peer-disabled:opacity-70",
      "custom-class"
    )
  })

  it("transmet les props natives au composant Radix sous-jacent", async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <div>
        <Label htmlFor="username" onClick={handleClick}>
          Username
        </Label>
        <input id="username" />
      </div>
    )

    await user.click(screen.getByText("Username"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("forward la ref vers l'élément label DOM", () => {
    const ref = React.createRef<HTMLLabelElement>()

    render(<Label ref={ref}>Téléphone</Label>)

    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
    expect(ref.current?.textContent).toBe("Téléphone")
  })

  it("définit displayName depuis LabelPrimitive.Root.displayName", () => {
    expect(Label.displayName).toBe("Label")
  })
})