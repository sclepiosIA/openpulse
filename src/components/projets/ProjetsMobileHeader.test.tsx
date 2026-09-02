// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProjetsMobileHeader } from "./ProjetsMobileHeader"

const { openMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
}))

vi.mock("@/contexts/MobileDrawerContext", () => ({
  useMobileDrawer: () => ({
    open: openMock,
  }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    "aria-label": ariaLabel,
    title,
    type,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    className?: string
    "aria-label"?: string
    title?: string
    type?: "button" | "submit" | "reset"
  }) => (
    <button
      type={type ?? "button"}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock("lucide-react", () => ({
  FolderKanban: ({ className }: { className?: string }) => <svg data-testid="folder-icon" className={className} />,
  Menu: ({ className }: { className?: string }) => <svg data-testid="menu-icon" className={className} />,
  Search: ({ className }: { className?: string }) => <svg data-testid="search-icon" className={className} />,
}))

describe("ProjetsMobileHeader", () => {
  beforeEach(() => {
    openMock.mockReset()
  })

  it("affiche le titre, les statistiques et le retard quand overdue > 0", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 12, completed: 5, inProgress: 4, overdue: 3 }}
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "Projets" })).toBeInTheDocument()
    expect(screen.getByText(/12 tâches • 5 ✓ • 4 en cours/i)).toBeInTheDocument()
    expect(screen.getByText(/• 3 retard/i)).toBeInTheDocument()
    expect(screen.getByLabelText("Menu")).toBeInTheDocument()
    expect(screen.getByLabelText("Rechercher")).toBeInTheDocument()
  })

  it("n'affiche pas le texte de retard quand overdue = 0", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 7, completed: 2, inProgress: 5, overdue: 0 }}
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
      />
    )

    expect(screen.getByText(/7 tâches • 2 ✓ • 5 en cours/i)).toBeInTheDocument()
    expect(screen.queryByText(/retard/i)).not.toBeInTheDocument()
  })

  it("ouvre le drawer mobile au clic sur le bouton menu", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 1, completed: 0, inProgress: 1, overdue: 0 }}
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
      />
    )

    fireEvent.click(screen.getByLabelText("Menu"))

    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it("déclenche la recherche au clic sur le bouton rechercher", () => {
    const onSearchClick = vi.fn()

    render(
      <ProjetsMobileHeader
        stats={{ total: 9, completed: 3, inProgress: 6, overdue: 0 }}
        onSearchClick={onSearchClick}
        onResetFilters={vi.fn()}
      />
    )

    fireEvent.click(screen.getByLabelText("Rechercher"))

    expect(onSearchClick).toHaveBeenCalledTimes(1)
  })

  it("affiche le bouton Reset et déclenche la remise à zéro si un filtre est actif", () => {
    const onResetFilters = vi.fn()

    render(
      <ProjetsMobileHeader
        stats={{ total: 9, completed: 3, inProgress: 6, overdue: 1 }}
        activeFilter="custom-filter"
        onSearchClick={vi.fn()}
        onResetFilters={onResetFilters}
      />
    )

    const resetButton = screen.getByRole("button", { name: "Reset" })
    expect(resetButton).toBeInTheDocument()
    expect(screen.getByText("custom-filter")).toBeInTheDocument()

    fireEvent.click(resetButton)

    expect(onResetFilters).toHaveBeenCalledTimes(1)
  })

  it("traduit le badge du filtre urgent", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 4, completed: 1, inProgress: 2, overdue: 1 }}
        activeFilter="urgent"
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
      />
    )

    expect(screen.getByText("🚨 Urgentes")).toBeInTheDocument()
  })

  it("traduit le badge du filtre my-tasks", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 8, completed: 2, inProgress: 5, overdue: 1 }}
        activeFilter="my-tasks"
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
      />
    )

    expect(screen.getByText("👤 Mes tâches")).toBeInTheDocument()
  })

  it("n'affiche pas le menu global quand showGlobalNav est false", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 5, completed: 1, inProgress: 4, overdue: 0 }}
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
        showGlobalNav={false}
      />
    )

    expect(screen.queryByLabelText("Menu")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Rechercher")).toBeInTheDocument()
  })

  it("affiche la toolbar si fournie", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 10, completed: 7, inProgress: 2, overdue: 1 }}
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
        toolbar={
          <>
            <button type="button">Tab A</button>
            <button type="button">Tab B</button>
          </>
        }
      />
    )

    expect(screen.getByRole("button", { name: "Tab A" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tab B" })).toBeInTheDocument()
  })

  it("n'affiche ni badge ni bouton Reset quand aucun filtre n'est actif", () => {
    render(
      <ProjetsMobileHeader
        stats={{ total: 6, completed: 2, inProgress: 4, overdue: 0 }}
        activeFilter={null}
        onSearchClick={vi.fn()}
        onResetFilters={vi.fn()}
      />
    )

    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument()
    expect(screen.queryByText("🚨 Urgentes")).not.toBeInTheDocument()
    expect(screen.queryByText("👤 Mes tâches")).not.toBeInTheDocument()
  })
})