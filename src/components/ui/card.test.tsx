import * as React from "react"
import { render } from "@testing-library/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card"

const { cn } = vi.hoisted(() => ({
  cn: (...parts: any[]) => parts.filter((p) => !!p).join(" "),
}))

vi.mock("@/lib/utils", () => ({
  cn,
}))

describe("Card component suite", () => {
  test("Card renders with base styles and children", () => {
    const { getByTestId } = render(
      <Card data-testid="card" className="extra">
        Hello
      </Card>
    )
    const el = getByTestId("card") as HTMLElement
    expect(el).toBeTruthy()
    expect(el.className).toContain("rounded-lg border")
    expect(el.className).toContain("bg-card")
    expect(el.className).toContain("text-card-foreground")
    expect(el.className).toContain("shadow-sm")
    expect(el.className).toContain("extra")
    expect(el.textContent).toContain("Hello")
  })

  test("CardHeader renders with its base classes", () => {
    const { getByTestId } = render(
      <CardHeader data-testid="head" className="extra">
        Header
      </CardHeader>
    )
    const el = getByTestId("head") as HTMLElement
    expect(el).toBeTruthy()
    expect(el.className).toContain("flex flex-col space-y-1.5 p-6")
    expect(el.textContent).toContain("Header")
  })

  test("CardTitle renders as an h3 and contains text", () => {
    const { getByTestId } = render(<CardTitle data-testid="title">My Title</CardTitle>)
    const el = getByTestId("title") as HTMLElement
    expect(el).toBeTruthy()
    expect(el.tagName).toBe("H3")
    expect(el.textContent).toBe("My Title")
  })

  test("CardDescription renders as a paragraph", () => {
    const { getByTestId } = render(
      <CardDescription data-testid="desc">Description</CardDescription>
    )
    const el = getByTestId("desc") as HTMLElement
    expect(el).toBeTruthy()
    expect(el.tagName).toBe("P")
    expect(el.textContent).toBe("Description")
  })

  test("CardContent renders with padding classes and children", () => {
    const { getByTestId } = render(
      <CardContent data-testid="content" className="custom">
        Content
      </CardContent>
    )
    const el = getByTestId("content") as HTMLElement
    expect(el).toBeTruthy()
    expect(el.className).toContain("p-6 pt-0")
    expect(el.textContent).toContain("Content")
  })

  test("CardFooter renders with its base classes", () => {
    const { getByTestId } = render(
      <CardFooter data-testid="foot" className="extra">
        Footer
      </CardFooter>
    )
    const el = getByTestId("foot") as HTMLElement
    expect(el).toBeTruthy()
    expect(el.className).toContain("flex items-center p-6 pt-0")
    expect(el.textContent).toContain("Footer")
  })
})