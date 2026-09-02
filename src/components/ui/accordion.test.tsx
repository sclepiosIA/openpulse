import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: Array<unknown>) =>
    inputs
      .flatMap((i) => {
        if (!i) return []
        if (typeof i === "string") return [i]
        if (Array.isArray(i)) return i.filter((x): x is string => typeof x === "string")
        if (typeof i === "object") {
          return Object.entries(i as Record<string, unknown>)
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k)
        }
        return []
      })
      .join(" "),
}))

vi.mock("lucide-react", () => ({
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="chevron-down" {...props} />,
}))

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion"

describe("accordion.tsx", () => {
  it("renders an accessible accordion and toggles content visibility (single, collapsible)", async () => {
    const user = userEvent.setup()

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>
            <div>Content A</div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByRole("button", { name: /section a/i })
    expect(trigger).toHaveAttribute("data-state", "closed")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument()

    expect(screen.queryByText("Content A")).not.toBeInTheDocument()

    await user.click(trigger)

    expect(trigger).toHaveAttribute("data-state", "open")
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Content A")).toBeInTheDocument()

    await user.click(trigger)

    expect(trigger).toHaveAttribute("data-state", "closed")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Content A")).not.toBeInTheDocument()
  })

  it("merges className via cn for Item, Trigger and Content", async () => {
    const user = userEvent.setup()

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="custom-item" data-testid="item-1">
          <AccordionTrigger className="custom-trigger">Section B</AccordionTrigger>
          <AccordionContent className="custom-content">
            <div>Content B</div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const item = screen.getByTestId("item-1")
    expect(item.className).toContain("border-b")
    expect(item.className).toContain("custom-item")

    const trigger = within(item).getByRole("button", { name: /section b/i })
    expect(trigger.className).toContain("hover:underline")
    expect(trigger.className).toContain("custom-trigger")

    await user.click(trigger)
    const contentText = screen.getByText("Content B")
    const innerWrapper = contentText.parentElement
    expect(innerWrapper?.className ?? "").toContain("pb-4")
    expect(innerWrapper?.className ?? "").toContain("custom-content")
  })
})