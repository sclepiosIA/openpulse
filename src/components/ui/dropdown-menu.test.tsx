import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockCn } = vi.hoisted(() => ({
  mockCn: (...args: Array<string | false | null | undefined>) =>
    args.filter(Boolean).join(" "),
}))

vi.mock("@/lib/utils", () => ({ cn: mockCn }))

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu"

describe("dropdown-menu components", () => {
  it("renders trigger and opens menu content with items", async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item A</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          </DropdownMenuSub>
          <DropdownMenuCheckboxItem checked>Check me</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="r2">
            <DropdownMenuRadioItem value="r1">R1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="r2">R2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel inset>Section</DropdownMenuLabel>
          <DropdownMenuItem inset>Inset item</DropdownMenuItem>
          <DropdownMenuShortcut>Ctrl+K</DropdownMenuShortcut>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const trigger = screen.getByRole("button", { name: "Open" })
    await user.click(trigger)

    const menu = screen.getByRole("menu")
    expect(menu).toBeInTheDocument()

    const itemA = screen.getByRole("menuitem", { name: "Item A" })
    expect(itemA).toBeInTheDocument()

    const checkboxItem = screen.getByRole("menuitemcheckbox", { name: "Check me" })
    expect(checkboxItem).toHaveAttribute("aria-checked", "true")

    const radioR1 = screen.getByRole("menuitemradio", { name: "R1" })
    const radioR2 = screen.getByRole("menuitemradio", { name: "R2" })
    expect(radioR1).toHaveAttribute("aria-checked", "false")
    expect(radioR2).toHaveAttribute("aria-checked", "true")

    const label = screen.getByText("Section")
    expect(label).toHaveClass("pl-8")

    const insetItem = screen.getByRole("menuitem", { name: "Inset item" })
    expect(insetItem).toHaveClass("pl-8")

    const shortcut = screen.getByText("Ctrl+K")
    expect(shortcut).toHaveClass("ml-auto")
    expect(shortcut).toHaveClass("text-xs")
    expect(shortcut).toHaveClass("tracking-widest")
    expect(shortcut).toHaveClass("opacity-60")

    const subTrigger = screen.getByRole("menuitem", { name: "More" })
    const svgChevron = subTrigger.querySelector("svg.ml-auto.h-4.w-4")
    expect(svgChevron).toBeTruthy()
  })

  it("renders checkbox indicator and radio indicator presence correctly", async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked>Checked Box</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Unchecked Box</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="opt2">
            <DropdownMenuRadioItem value="opt1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="opt2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole("button", { name: "Open" }))

    const checkedBox = screen.getByRole("menuitemcheckbox", { name: "Checked Box" })
    const uncheckedBox = screen.getByRole("menuitemcheckbox", { name: "Unchecked Box" })

    expect(checkedBox).toHaveAttribute("aria-checked", "true")
    const checkedIndicator = checkedBox.querySelector("svg.h-4.w-4")
    expect(checkedIndicator).toBeTruthy()

    expect(uncheckedBox).toHaveAttribute("aria-checked", "false")
    const uncheckedIndicator = uncheckedBox.querySelector("svg.h-4.w-4")
    expect(uncheckedIndicator).toBeFalsy()

    const opt1 = screen.getByRole("menuitemradio", { name: "Option 1" })
    const opt2 = screen.getByRole("menuitemradio", { name: "Option 2" })

    expect(opt1).toHaveAttribute("aria-checked", "false")
    expect(opt2).toHaveAttribute("aria-checked", "true")

    const opt2Indicator = opt2.querySelector("svg.h-2.w-2.fill-current")
    expect(opt2Indicator).toBeTruthy()

    const opt1Indicator = opt1.querySelector("svg.h-2.w-2.fill-current")
    expect(opt1Indicator).toBeFalsy()
  })
})