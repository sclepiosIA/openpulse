// @vitest-environment jsdom

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { PeopleMobileHeader } from "./PeopleMobileHeader"

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
    ariaLabel,
    "aria-label": ariaLabelProp,
    title,
    className,
    type = "button",
  }: {
    children?: React.ReactNode
    onClick?: () => void
    ariaLabel?: string
    "aria-label"?: string
    title?: string
    className?: string
    type?: "button" | "submit" | "reset"
  }) => (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabelProp ?? ariaLabel}
      title={title}
      className={className}
    >
      {children}
    </button>
  ),
}))

vi.mock("lucide-react", () => ({
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="users-icon" {...props} />,
  Menu: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="menu-icon" {...props} />,
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="search-icon" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="plus-icon" {...props} />,
}))

describe("PeopleMobileHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("affiche le titre, les statistiques et le rôle", () => {
    render(<PeopleMobileHeader stats={{ membres: 12 }} roleLabel="Admin" />)

    expect(screen.getByRole("heading", { name: "Ressources" })).toBeInTheDocument()
    expect(screen.getByText("12 membres")).toBeInTheDocument()
    expect(screen.getByText(/Admin/)).toBeInTheDocument()
    expect(screen.getByLabelText("Menu")).toBeInTheDocument()
    expect(screen.getByTestId("users-icon")).toBeInTheDocument()
  })

  it("ouvre le drawer mobile au clic sur le bouton menu", () => {
    render(<PeopleMobileHeader stats={{ membres: 3 }} />)

    fireEvent.click(screen.getByLabelText("Menu"))

    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it("affiche et déclenche les actions de recherche et d'ajout", () => {
    const onSearchClick = vi.fn()
    const onAddUser = vi.fn()

    render(
      <PeopleMobileHeader
        stats={{ membres: 8 }}
        onSearchClick={onSearchClick}
        onAddUser={onAddUser}
      />
    )

    fireEvent.click(screen.getByLabelText("Rechercher"))
    fireEvent.click(screen.getByLabelText("Ajouter un utilisateur"))

    expect(onSearchClick).toHaveBeenCalledTimes(1)
    expect(onAddUser).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("search-icon")).toBeInTheDocument()
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument()
  })

  it("n'affiche pas le menu global si showGlobalNav vaut false", () => {
    render(<PeopleMobileHeader stats={{ membres: 5 }} showGlobalNav={false} />)

    expect(screen.queryByLabelText("Menu")).not.toBeInTheDocument()
  })

  it("affiche la toolbar et les headerActions personnalisées", () => {
    render(
      <PeopleMobileHeader
        stats={{ membres: 21 }}
        toolbar={
          <>
            <button>Onglet A</button>
            <button>Onglet B</button>
          </>
        }
        headerActions={<button aria-label="Action custom">Action</button>}
      />
    )

    expect(screen.getByText("Onglet A")).toBeInTheDocument()
    expect(screen.getByText("Onglet B")).toBeInTheDocument()
    expect(screen.getByLabelText("Action custom")).toBeInTheDocument()
  })

  it("n'affiche pas le rôle quand roleLabel est absent et rend le texte métier exact", () => {
    render(<PeopleMobileHeader stats={{ membres: 0 }} />)

    expect(screen.getByText("0 membres")).toBeInTheDocument()
    expect(screen.queryByText(/•/)).not.toBeInTheDocument()
  })
})