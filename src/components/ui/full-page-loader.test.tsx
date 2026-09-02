import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach } from "vitest"
import { FullPageLoader } from "./full-page-loader"

vi.mock("lucide-react", () => {
  const React = require("react") as typeof import("react")
  return {
    Loader2: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-testid": "icon-loader" }),
    AlertTriangle: (props: React.SVGProps<SVGSVGElement>) =>
      React.createElement("svg", { ...props, "data-testid": "icon-alert" }),
  }
})

vi.mock("@/components/ui/button", () => {
  const React = require("react") as typeof import("react")
  type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }
  function Button({ children, variant, ...rest }: Props) {
    return React.createElement("button", { ...rest, "data-variant": variant ?? "default" }, children)
  }
  return { Button }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("FullPageLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("affiche l'état de chargement par défaut", () => {
    render(<FullPageLoader timeoutMs={8000} />)

    expect(screen.getByText("Chargement...")).toBeTruthy()
    expect(screen.queryByText("Le chargement prend trop de temps")).toBeNull()
    expect(screen.getByTestId("icon-loader")).toBeTruthy()
  })

  it("bascule sur l'état 'trop de temps' après le délai et propose les actions", async () => {
    render(<FullPageLoader timeoutMs={1000} />)

    expect(screen.getByText("Chargement...")).toBeTruthy()

    await vi.advanceTimersByTimeAsync(1000)

    expect(screen.queryByText("Chargement...")).toBeNull()
    expect(screen.getByText("Le chargement prend trop de temps")).toBeTruthy()
    expect(
      screen.getByText("Une ressource n'a pas pu se charger. Vérifiez votre connexion ou vos permissions, puis réessayez.")
    ).toBeTruthy()
    expect(screen.getByTestId("icon-alert")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Recharger la page" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Mode sûr" })).toBeTruthy()
  })

  it("bouton 'Recharger la page' appelle window.location.reload()", async () => {
    const reloadSpy = vi.fn()

    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })

    render(<FullPageLoader timeoutMs={1} />)
    await vi.advanceTimersByTimeAsync(1)

    fireEvent.click(screen.getByRole("button", { name: "Recharger la page" }))
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  })

  it("bouton 'Mode sûr' redirige vers /__safe", async () => {
    const originalLocation = window.location

    const setHref = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        get href() {
          return ""
        },
        set href(v: string) {
          setHref(v)
        },
      },
    })

    render(<FullPageLoader timeoutMs={1} />)
    await vi.advanceTimersByTimeAsync(1)

    fireEvent.click(screen.getByRole("button", { name: "Mode sûr" }))
    expect(setHref).toHaveBeenCalledWith("/__safe")

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  })

  it("timeoutMs=0 désactive l'état 'trop de temps'", async () => {
    render(<FullPageLoader timeoutMs={0} />)

    await vi.advanceTimersByTimeAsync(60000)

    expect(screen.getByText("Chargement...")).toBeTruthy()
    expect(screen.queryByText("Le chargement prend trop de temps")).toBeNull()
  })
})