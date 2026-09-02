import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<unknown>) =>
    args
      .flatMap((a) => {
        if (!a) return []
        if (typeof a === "string") return [a]
        if (Array.isArray(a)) return a.filter(Boolean).map(String)
        if (typeof a === "object") {
          return Object.entries(a as Record<string, unknown>)
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k)
        }
        return [String(a)]
      })
      .join(" "),
}))

vi.mock("lucide-react", () => ({
  Check: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-check", ...props }),
  ChevronRight: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-chevron-right", ...props }),
  Circle: (props: Record<string, unknown>) =>
    React.createElement("svg", { "data-testid": "icon-circle", ...props }),
}))

const menubarStable = vi.hoisted(() => {
  const handlers = {
    onOpenAutoFocus: vi.fn(),
    onCloseAutoFocus: vi.fn(),
    onInteractOutside: vi.fn(),
  }
  return { handlers }
})

vi.mock("@radix-ui/react-menubar", async () => {
  const ReactMod = await import("react")

  const Root = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement("div", { ref, "data-radix": "menubar-root", ...props }, children)
  )
  Root.displayName = "MenubarRoot"

  const Menu: React.FC<React.PropsWithChildren> = ({ children }) =>
    ReactMod.createElement(ReactMod.Fragment, null, children)

  const Group: React.FC<React.PropsWithChildren> = ({ children }) =>
    ReactMod.createElement("div", { "data-radix": "menubar-group" }, children)

  const Portal: React.FC<React.PropsWithChildren> = ({ children }) =>
    ReactMod.createElement(ReactMod.Fragment, null, children)

  const Trigger = ReactMod.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement(
        "button",
        { ref, type: "button", "data-radix": "menubar-trigger", ...props },
        children
      )
  )
  Trigger.displayName = "MenubarTrigger"

  const Content = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement(
        "div",
        { ref, role: "menu", "data-radix": "menubar-content", ...props },
        children
      )
  )
  Content.displayName = "MenubarContent"

  const Item = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement("div", { ref, role: "menuitem", tabIndex: -1, ...props }, children)
  )
  Item.displayName = "MenubarItem"

  const Separator = ReactMod.forwardRef<HTMLHRElement, React.ComponentPropsWithoutRef<"hr">>(
    (props, ref) => ReactMod.createElement("hr", { ref, role: "separator", ...props })
  )
  Separator.displayName = "MenubarSeparator"

  const Label = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement("div", { ref, "data-radix": "menubar-label", ...props }, children)
  )
  Label.displayName = "MenubarLabel"

  const ItemIndicator: React.FC<React.PropsWithChildren> = ({ children }) =>
    ReactMod.createElement("span", { "data-radix": "item-indicator" }, children)

  const CheckboxItem = ReactMod.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<"div"> & { checked?: boolean }
  >(({ children, checked, ...props }, ref) =>
    ReactMod.createElement(
      "div",
      {
        ref,
        role: "menuitemcheckbox",
        "aria-checked": checked ? "true" : "false",
        tabIndex: -1,
        ...props,
      },
      children
    )
  )
  CheckboxItem.displayName = "MenubarCheckboxItem"

  const RadioGroup: React.FC<React.PropsWithChildren> = ({ children }) =>
    ReactMod.createElement("div", { role: "group", "data-radix": "menubar-radio-group" }, children)

  const RadioItem = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement("div", { ref, role: "menuitemradio", tabIndex: -1, ...props }, children)
  )
  RadioItem.displayName = "MenubarRadioItem"

  const Sub: React.FC<React.PropsWithChildren> = ({ children }) =>
    ReactMod.createElement(ReactMod.Fragment, null, children)

  const SubTrigger = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement("div", { ref, role: "menuitem", tabIndex: -1, ...props }, children)
  )
  SubTrigger.displayName = "MenubarSubTrigger"

  const SubContent = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    ({ children, ...props }, ref) =>
      ReactMod.createElement("div", { ref, role: "menu", ...props }, children)
  )
  SubContent.displayName = "MenubarSubContent"

  return {
    Root,
    Menu,
    Group,
    Portal,
    Trigger,
    Content,
    Item,
    Separator,
    Label,
    ItemIndicator,
    CheckboxItem,
    RadioGroup,
    RadioItem,
    Sub,
    SubTrigger,
    SubContent,
    __handlers: menubarStable.handlers,
  }
})

import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
} from "./menubar"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("menubar.tsx", () => {
  it("Menubar applique les classes par défaut et concatène className", () => {
    renderWithClient(
      <Menubar data-testid="menubar" className="custom-menubar">
        content
      </Menubar>
    )
    const el = screen.getByTestId("menubar")
    expect(el).toHaveClass("flex")
    expect(el).toHaveClass("h-10")
    expect(el).toHaveClass("custom-menubar")
  })

  it("MenubarTrigger applique les classes et rend le contenu", () => {
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger data-testid="trigger" className="custom-trigger">
            File
          </MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    )
    const trigger = screen.getByTestId("trigger")
    expect(trigger).toHaveTextContent("File")
    expect(trigger).toHaveClass("px-3")
    expect(trigger).toHaveClass("custom-trigger")
  })

  it("MenubarContent utilise le Portal et les valeurs par défaut d'align/offset (pas crash), et concatène className", () => {
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Open</MenubarTrigger>
          <MenubarContent data-testid="content" className="custom-content">
            <MenubarItem>Item 1</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const content = screen.getByTestId("content")
    expect(content).toHaveAttribute("role", "menu")
    expect(content).toHaveClass("min-w-[12rem]")
    expect(content).toHaveClass("custom-content")
    expect(screen.getByText("Item 1")).toBeInTheDocument()
  })

  it("MenubarItem gère inset (pl-8) et className", () => {
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarContent>
            <MenubarItem data-testid="item" inset className="custom-item">
              New Tab
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )
    const item = screen.getByTestId("item")
    expect(item).toHaveTextContent("New Tab")
    expect(item).toHaveClass("pl-8")
    expect(item).toHaveClass("custom-item")
  })

  it("MenubarCheckboxItem rend l'indicateur (Check) et reflète checked via aria-checked", async () => {
    const user = userEvent.setup()
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarContent>
            <MenubarCheckboxItem data-testid="chk" checked>
              Show Status Bar
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const checkbox = screen.getByTestId("chk")
    expect(checkbox).toHaveAttribute("role", "menuitemcheckbox")
    expect(checkbox).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("icon-check")).toBeInTheDocument()

    await user.click(checkbox)
    expect(checkbox).toHaveTextContent("Show Status Bar")
  })

  it("MenubarRadioGroup + MenubarRadioItem rendent l'indicateur (Circle)", () => {
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarContent>
            <MenubarRadioGroup>
              <MenubarRadioItem data-testid="radio">Left</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )
    const radio = screen.getByTestId("radio")
    expect(radio).toHaveAttribute("role", "menuitemradio")
    expect(screen.getByTestId("icon-circle")).toBeInTheDocument()
  })

  it("MenubarSubTrigger rend le chevron et applique inset", () => {
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger data-testid="subtrigger" inset>
                Share
              </MenubarSubTrigger>
              <MenubarSubContent data-testid="subcontent">
                <MenubarItem>Link</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const subTrigger = screen.getByTestId("subtrigger")
    expect(subTrigger).toHaveTextContent("Share")
    expect(subTrigger).toHaveClass("pl-8")
    expect(screen.getByTestId("icon-chevron-right")).toBeInTheDocument()

    const subContent = screen.getByTestId("subcontent")
    expect(subContent).toHaveClass("min-w-[8rem]")
    expect(screen.getByText("Link")).toBeInTheDocument()
  })

  it("MenubarLabel et MenubarSeparator appliquent les classes attendues", () => {
    renderWithClient(
      <Menubar>
        <MenubarMenu>
          <MenubarContent>
            <MenubarLabel data-testid="label" inset className="custom-label">
              Edit
            </MenubarLabel>
            <MenubarSeparator data-testid="sep" className="custom-sep" />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    )

    const label = screen.getByTestId("label")
    expect(label).toHaveTextContent("Edit")
    expect(label).toHaveClass("font-semibold")
    expect(label).toHaveClass("pl-8")
    expect(label).toHaveClass("custom-label")

    const sep = screen.getByTestId("sep")
    expect(sep).toHaveAttribute("role", "separator")
    expect(sep).toHaveClass("h-px")
    expect(sep).toHaveClass("custom-sep")
  })

  it("MenubarShortcut applique les classes et rend son contenu", () => {
    renderWithClient(
      <Menubar>
        <MenubarGroup>
          <MenubarItem>
            Save <MenubarShortcut data-testid="sc" className="custom-sc">Ctrl+S</MenubarShortcut>
          </MenubarItem>
        </MenubarGroup>
      </Menubar>
    )
    const sc = screen.getByTestId("sc")
    expect(sc).toHaveTextContent("Ctrl+S")
    expect(sc).toHaveClass("ml-auto")
    expect(sc).toHaveClass("text-xs")
    expect(sc).toHaveClass("custom-sc")
  })

  it("export MenubarPortal est utilisable (smoke) et MenubarGroup rend ses enfants", () => {
    renderWithClient(
      <Menubar>
        <MenubarPortal>
          <MenubarGroup>
            <div data-testid="inside">X</div>
          </MenubarGroup>
        </MenubarPortal>
      </Menubar>
    )
    expect(screen.getByTestId("inside")).toHaveTextContent("X")
  })
})