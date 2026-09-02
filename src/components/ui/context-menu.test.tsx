// @vitest-environment jsdom
import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from "./context-menu"

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(" "),
}))

describe("context-menu", () => {
  it("exports all expected components", () => {
    expect(ContextMenu).toBeDefined()
    expect(ContextMenuTrigger).toBeDefined()
    expect(ContextMenuContent).toBeDefined()
    expect(ContextMenuItem).toBeDefined()
    expect(ContextMenuCheckboxItem).toBeDefined()
    expect(ContextMenuRadioItem).toBeDefined()
    expect(ContextMenuLabel).toBeDefined()
    expect(ContextMenuSeparator).toBeDefined()
    expect(ContextMenuShortcut).toBeDefined()
    expect(ContextMenuGroup).toBeDefined()
    expect(ContextMenuPortal).toBeDefined()
    expect(ContextMenuSub).toBeDefined()
    expect(ContextMenuSubContent).toBeDefined()
    expect(ContextMenuSubTrigger).toBeDefined()
    expect(ContextMenuRadioGroup).toBeDefined()
  })

  it("renders content with label, item, separator and shortcut on context menu open", async () => {
    const user = userEvent.setup()

    render(
      <ContextMenu>
        <ContextMenuTrigger>Open menu</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel inset>Actions</ContextMenuLabel>
          <ContextMenuItem inset>Rename</ContextMenuItem>
          <ContextMenuSeparator data-testid="separator" />
          <ContextMenuItem>
            Save
            <ContextMenuShortcut>⌘S</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )

    await user.pointer([{ keys: "[MouseRight]", target: screen.getByText("Open menu") }])

    expect(await screen.findByText("Actions")).toHaveClass("pl-8")
    expect(screen.getByText("Rename")).toHaveClass("pl-8")
    expect(screen.getByText("Save")).toBeInTheDocument()
    expect(screen.getByText("⌘S")).toHaveClass("ml-auto", "tracking-widest")
    expect(screen.getByTestId("separator")).toHaveClass("-mx-1", "bg-border")
  })

  it("renders checkbox and radio indicators when selected", async () => {
    const user = userEvent.setup()

    render(
      <ContextMenu>
        <ContextMenuTrigger>Open selectable menu</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuCheckboxItem checked>Checked item</ContextMenuCheckboxItem>
          <ContextMenuRadioGroup value="b">
            <ContextMenuRadioItem value="a">Option A</ContextMenuRadioItem>
            <ContextMenuRadioItem value="b">Option B</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>
    )

    await user.pointer([{ keys: "[MouseRight]", target: screen.getByText("Open selectable menu") }])

    const checkboxItem = await screen.findByRole("menuitemcheckbox", { name: "Checked item" })
    const radioItem = screen.getByRole("menuitemradio", { name: "Option B" })

    expect(checkboxItem).toHaveAttribute("data-state", "checked")
    expect(radioItem).toHaveAttribute("data-state", "checked")
    expect(document.querySelector("svg.lucide-check")).not.toBeNull()
    expect(document.querySelector("svg.lucide-circle")).not.toBeNull()
  })

  it("renders submenu trigger with chevron and submenu content", async () => {
    const user = userEvent.setup()

    render(
      <ContextMenu>
        <ContextMenuTrigger>Open nested menu</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger inset>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Duplicate</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    )

    await user.pointer([{ keys: "[MouseRight]", target: screen.getByText("Open nested menu") }])

    const subTrigger = await screen.findByText("More")
    expect(subTrigger).toHaveClass("pl-8")

    const triggerWithIcon = subTrigger.closest('[role="menuitem"]')
    expect(triggerWithIcon?.querySelector("svg.lucide-chevron-right")).not.toBeNull()

    await user.hover(subTrigger)

    expect(await screen.findByText("Duplicate")).toBeInTheDocument()
  })

  it("forwards refs to rendered primitives when menu is opened", async () => {
    const user = userEvent.setup()
    const itemRef = React.createRef<HTMLDivElement>()
    const labelRef = React.createRef<HTMLDivElement>()
    const separatorRef = React.createRef<HTMLDivElement>()
    const contentRef = React.createRef<HTMLDivElement>()

    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent ref={contentRef}>
          <ContextMenuLabel ref={labelRef}>Label</ContextMenuLabel>
          <ContextMenuItem ref={itemRef}>Item</ContextMenuItem>
          <ContextMenuSeparator ref={separatorRef} />
        </ContextMenuContent>
      </ContextMenu>
    )

    await user.pointer([{ keys: "[MouseRight]", target: screen.getByText("Trigger") }])
    await screen.findByText("Item")

    await waitFor(() => {
      expect(contentRef.current).toBeInstanceOf(HTMLDivElement)
      expect(labelRef.current).toBeInstanceOf(HTMLDivElement)
      expect(itemRef.current).toBeInstanceOf(HTMLDivElement)
      expect(separatorRef.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  it("applies custom className on composed components", async () => {
    const user = userEvent.setup()

    render(
      <ContextMenu>
        <ContextMenuTrigger>Styled trigger</ContextMenuTrigger>
        <ContextMenuContent className="custom-content">
          <ContextMenuLabel className="custom-label">Styled Label</ContextMenuLabel>
          <ContextMenuItem className="custom-item">Styled Item</ContextMenuItem>
          <ContextMenuSeparator className="custom-separator" data-testid="styled-separator" />
          <ContextMenuShortcut className="custom-shortcut">⇧⌘P</ContextMenuShortcut>
        </ContextMenuContent>
      </ContextMenu>
    )

    await user.pointer([{ keys: "[MouseRight]", target: screen.getByText("Styled trigger") }])

    expect((await screen.findByRole("menu")).className).toContain("custom-content")
    expect(screen.getByText("Styled Label")).toHaveClass("custom-label")
    expect(screen.getByText("Styled Item")).toHaveClass("custom-item")
    expect(screen.getByTestId("styled-separator")).toHaveClass("custom-separator")
    expect(screen.getByText("⇧⌘P")).toHaveClass("custom-shortcut")
  })
})