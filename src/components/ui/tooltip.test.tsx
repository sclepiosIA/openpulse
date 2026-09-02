import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { stableCn } = vi.hoisted(() => ({
  stableCn: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(" "),
}))

vi.mock("@/lib/utils", () => ({
  cn: stableCn,
}))

vi.mock("@radix-ui/react-tooltip", async () => {
  const ReactMod = (await import("react")) as typeof import("react")

  type CtxValue = {
    open: boolean
    setOpen: (v: boolean) => void
  }

  const TooltipCtx = ReactMod.createContext<CtxValue | null>(null)

  const Provider: ReactMod.FC<ReactMod.PropsWithChildren> = ({ children }) => <>{children}</>

  const Root: ReactMod.FC<ReactMod.PropsWithChildren> = ({ children }) => {
    const [open, setOpen] = ReactMod.useState(false)
    const value = ReactMod.useMemo(() => ({ open, setOpen }), [open])
    return <TooltipCtx.Provider value={value}>{children}</TooltipCtx.Provider>
  }

  const Trigger = ReactMod.forwardRef<
    HTMLButtonElement,
    ReactMod.ComponentPropsWithoutRef<"button">
  >(({ onMouseEnter, onMouseLeave, ...props }, ref) => {
    const ctx = ReactMod.useContext(TooltipCtx)
    return (
      <button
        ref={ref}
        {...props}
        onMouseEnter={(e) => {
          onMouseEnter?.(e)
          ctx?.setOpen(true)
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e)
          ctx?.setOpen(false)
        }}
      />
    )
  })
  Trigger.displayName = "TooltipTrigger"

  const Content = ReactMod.forwardRef<
    HTMLDivElement,
    ReactMod.ComponentPropsWithoutRef<"div"> & { sideOffset?: number }
  >(({ style, sideOffset, ...props }, ref) => {
    const ctx = ReactMod.useContext(TooltipCtx)
    if (!ctx?.open) return null

    const mergedStyle: ReactMod.CSSProperties = {
      ...(style ?? {}),
      ...(typeof sideOffset === "number" ? { margin: `${sideOffset}px` } : {}),
    }

    return <div ref={ref} style={mergedStyle} data-testid="radix-content" {...props} />
  })
  Content.displayName = "TooltipContent"

  return { Provider, Root, Trigger, Content }
})

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip"

describe("tooltip.tsx", () => {
  it("affiche le contenu au hover, applique la classe et conserve la classe de base", async () => {
    const user = userEvent.setup()

    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent className="custom-class" sideOffset={12}>
            Hello tooltip
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.queryByText("Hello tooltip")).toBeNull()

    await user.hover(screen.getByRole("button", { name: "Trigger" }))

    const content = screen.getByText("Hello tooltip")
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass("custom-class")
    expect(content.className).toContain("z-50")
    expect((content as HTMLDivElement).style.margin).toBe("12px")

    await user.unhover(screen.getByRole("button", { name: "Trigger" }))
    expect(screen.queryByText("Hello tooltip")).toBeNull()
  })

  it("forwardRef: expose le ref vers l'élément Content", async () => {
    const user = userEvent.setup()
    const ref = React.createRef<HTMLDivElement>()

    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Open</TooltipTrigger>
          <TooltipContent ref={ref}>Ref content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    await user.hover(screen.getByRole("button", { name: "Open" }))

    expect(ref.current).not.toBeNull()
    expect(ref.current?.textContent).toBe("Ref content")
  })
})