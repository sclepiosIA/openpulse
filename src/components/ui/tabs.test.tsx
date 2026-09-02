// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" "),
}))

describe("tabs.tsx", () => {
  it("exports the expected tab components", () => {
    expect(Tabs).toBeTypeOf("object")
    expect(TabsList).toBeTypeOf("object")
    expect(TabsTrigger).toBeTypeOf("object")
    expect(TabsContent).toBeTypeOf("object")
  })

  it("renders the list with base classes, custom class and scrolling styles", () => {
    render(
      <Tabs defaultValue="account">
        <TabsList data-testid="tabs-list" className="custom-list">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account content</TabsContent>
        <TabsContent value="password">Password content</TabsContent>
      </Tabs>
    )

    const list = screen.getByTestId("tabs-list")
    expect(list).toHaveClass("inline-flex")
    expect(list).toHaveClass("h-11")
    expect(list).toHaveClass("overflow-x-auto")
    expect(list).toHaveClass("scrollbar-hide")
    expect(list).toHaveClass("snap-x")
    expect(list).toHaveClass("touch-pan-x")
    expect(list).toHaveClass("custom-list")

    const style = list.getAttribute("style") ?? ""
    expect(style).toContain("-webkit-overflow-scrolling: touch")
    expect(style).toContain("scrollbar-width: none")
    expect((list as HTMLDivElement).style.msOverflowStyle).toBe("none")
  })

  it("renders triggers with default classes and applies active state through radix", async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account" data-testid="trigger-account" className="extra-trigger">
            Account
          </TabsTrigger>
          <TabsTrigger value="password" data-testid="trigger-password">
            Password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account content</TabsContent>
        <TabsContent value="password">Password content</TabsContent>
      </Tabs>
    )

    const account = screen.getByTestId("trigger-account")
    const password = screen.getByTestId("trigger-password")

    expect(account).toHaveClass("inline-flex")
    expect(account).toHaveClass("rounded-md")
    expect(account).toHaveClass("px-2.5")
    expect(account).toHaveClass("text-xs")
    expect(account).toHaveClass("min-h-9")
    expect(account).toHaveClass("shrink-0")
    expect(account).toHaveClass("snap-start")
    expect(account).toHaveClass("extra-trigger")

    expect(account).toHaveAttribute("data-state", "active")
    expect(password).toHaveAttribute("data-state", "inactive")

    await user.click(password)

    expect(account).toHaveAttribute("data-state", "inactive")
    expect(password).toHaveAttribute("data-state", "active")
  })

  it("renders content with base classes and shows only the active panel content", async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" data-testid="overview-content" className="custom-content">
          Overview panel
        </TabsContent>
        <TabsContent value="details" data-testid="details-content">
          Details panel
        </TabsContent>
      </Tabs>
    )

    const overviewContent = screen.getByTestId("overview-content")
    const detailsContent = screen.getByTestId("details-content")

    expect(overviewContent).toHaveClass("mt-2")
    expect(overviewContent).toHaveClass("animate-fade-in")
    expect(overviewContent).toHaveClass("custom-content")

    expect(overviewContent).toHaveAttribute("data-state", "active")
    expect(detailsContent).toHaveAttribute("data-state", "inactive")
    expect(screen.getByText("Overview panel")).toBeInTheDocument()
    expect(screen.queryByText("Details panel")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Details" }))

    expect(overviewContent).toHaveAttribute("data-state", "inactive")
    expect(detailsContent).toHaveAttribute("data-state", "active")
    expect(screen.queryByText("Overview panel")).not.toBeInTheDocument()
    expect(screen.getByText("Details panel")).toBeInTheDocument()
  })

  it("forwards refs to the underlying list, trigger and content elements", () => {
    const listRef = React.createRef<HTMLDivElement>()
    const triggerRef = React.createRef<HTMLButtonElement>()
    const contentRef = React.createRef<HTMLDivElement>()

    render(
      <Tabs defaultValue="one">
        <TabsList ref={listRef}>
          <TabsTrigger ref={triggerRef} value="one">
            One
          </TabsTrigger>
        </TabsList>
        <TabsContent ref={contentRef} value="one">
          Panel one
        </TabsContent>
      </Tabs>
    )

    expect(listRef.current).toBeInstanceOf(HTMLDivElement)
    expect(triggerRef.current).toBeInstanceOf(HTMLButtonElement)
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement)
    expect(triggerRef.current?.textContent).toBe("One")
    expect(contentRef.current?.textContent).toBe("Panel one")
  })

  it("preserves disabled trigger behavior from radix primitive", async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="enabled">
        <TabsList>
          <TabsTrigger value="enabled">Enabled</TabsTrigger>
          <TabsTrigger value="disabled" disabled>
            Disabled
          </TabsTrigger>
        </TabsList>
        <TabsContent value="enabled">Enabled content</TabsContent>
        <TabsContent value="disabled">Disabled content</TabsContent>
      </Tabs>
    )

    const enabled = screen.getByRole("tab", { name: "Enabled" })
    const disabled = screen.getByRole("tab", { name: "Disabled" })

    expect(disabled).toBeDisabled()
    expect(enabled).toHaveAttribute("data-state", "active")
    expect(disabled).toHaveAttribute("data-state", "inactive")

    await user.click(disabled)

    expect(enabled).toHaveAttribute("data-state", "active")
    expect(disabled).toHaveAttribute("data-state", "inactive")
    expect(screen.getByText("Enabled content")).toBeInTheDocument()
    expect(screen.queryByText("Disabled content")).not.toBeInTheDocument()
  })
})