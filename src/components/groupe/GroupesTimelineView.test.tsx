import React from "react"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { GroupesTimelineView } from "./GroupesTimelineView"

const { GROUPES, EMPTY_GROUPES } = vi.hoisted(() => ({
  GROUPES: [
    {
      id: "g1",
      nom: "Groupe Atlantique",
      type: "public",
      created_at: "2024-03-15T10:00:00.000Z",
      region: "Bretagne",
      nombre_etablissements: 12,
      progression_moyenne: 78.4,
      total_passages_urgences_annuel: 125000,
      modules_deployes: ["Urgences", "Bed management", "SMUR"],
    },
    {
      id: "g2",
      nom: "Groupe Rhône",
      type: "prive",
      created_at: "2024-01-10T09:00:00.000Z",
      region: null,
      nombre_etablissements: 4,
      progression_moyenne: 62,
      total_passages_urgences_annuel: null,
      modules_deployes: ["Pilotage"],
    },
    {
      id: "g3",
      nom: "Groupe Nord",
      type: "public",
      created_at: "2023-11-20T08:30:00.000Z",
      region: "Hauts-de-France",
      nombre_etablissements: 7,
      progression_moyenne: 91.2,
      total_passages_urgences_annuel: 98765,
      modules_deployes: [],
    },
  ],
  EMPTY_GROUPES: [],
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
}))

vi.mock("@/components/ui/groupe-badge", () => ({
  GroupeBadge: ({ type }: { type: string }) => <span data-testid="groupe-badge">{type}</span>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock("lucide-react", () => ({
  Building2: ({ className }: { className?: string }) => <svg data-testid="building-icon" className={className} />,
  MapPin: ({ className }: { className?: string }) => <svg data-testid="map-pin-icon" className={className} />,
}))

describe("GroupesTimelineView", () => {
  it("affiche un état vide quand aucun groupe n'est fourni", () => {
    render(
      <MemoryRouter>
        <GroupesTimelineView groupes={EMPTY_GROUPES} />
      </MemoryRouter>,
    )

    expect(screen.getByText("Aucun groupe trouvé")).toBeInTheDocument()
    expect(screen.getByTestId("building-icon")).toBeInTheDocument()
    expect(screen.queryByTestId("card")).not.toBeInTheDocument()
  })

  it("groupe les éléments par année, trie du plus récent au plus ancien et affiche les informations métier", () => {
    render(
      <MemoryRouter>
        <GroupesTimelineView groupes={GROUPES} />
      </MemoryRouter>,
    )

    const yearBadges = screen
      .getAllByTestId("badge")
      .map((node) => node.textContent)
      .filter((text) => text === "2024" || text === "2023")
    expect(yearBadges).toEqual(["2024", "2023"])

    expect(screen.getByText("2 groupes")).toBeInTheDocument()
    expect(screen.getByText("1 groupe")).toBeInTheDocument()

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute("href", "/groupes/g1")
    expect(links[1]).toHaveAttribute("href", "/groupes/g2")
    expect(links[2]).toHaveAttribute("href", "/groupes/g3")

    const firstCard = screen.getAllByTestId("card")[0]
    expect(within(firstCard).getByText("Groupe Atlantique")).toBeInTheDocument()
    expect(within(firstCard).getByText("Créé le 15 mars 2024")).toBeInTheDocument()
    expect(within(firstCard).getByText("Bretagne")).toBeInTheDocument()
    expect(within(firstCard).getByText("12")).toBeInTheDocument()
    expect(within(firstCard).getByText("78.4%")).toBeInTheDocument()
    expect(within(firstCard).getByText("125,000")).toBeInTheDocument()
    expect(within(firstCard).getByText("Urgences")).toBeInTheDocument()
    expect(within(firstCard).getByText("Bed management")).toBeInTheDocument()
    expect(within(firstCard).getByText("+1")).toBeInTheDocument()
    expect(within(firstCard).getByTestId("map-pin-icon")).toBeInTheDocument()

    const secondCard = screen.getAllByTestId("card")[1]
    expect(within(secondCard).getByText("Groupe Rhône")).toBeInTheDocument()
    expect(within(secondCard).getByText("Créé le 10 janvier 2024")).toBeInTheDocument()
    expect(within(secondCard).getByText("4")).toBeInTheDocument()
    expect(within(secondCard).getByText("62.0%")).toBeInTheDocument()
    expect(within(secondCard).getByText("Pilotage")).toBeInTheDocument()
    expect(within(secondCard).queryByText("Passages/an")).not.toBeInTheDocument()
    expect(within(secondCard).queryByTestId("map-pin-icon")).not.toBeInTheDocument()

    const thirdCard = screen.getAllByTestId("card")[2]
    expect(within(thirdCard).getByText("Groupe Nord")).toBeInTheDocument()
    expect(within(thirdCard).getByText("Créé le 20 novembre 2023")).toBeInTheDocument()
    expect(within(thirdCard).getByText("Hauts-de-France")).toBeInTheDocument()
    expect(within(thirdCard).getByText("98,765")).toBeInTheDocument()
    expect(within(thirdCard).queryByText("Modules")).not.toBeInTheDocument()
  })

  it("affiche un badge de type pour chaque groupe", () => {
    render(
      <MemoryRouter>
        <GroupesTimelineView groupes={GROUPES} />
      </MemoryRouter>,
    )

    const typeBadges = screen.getAllByTestId("groupe-badge")
    expect(typeBadges).toHaveLength(3)
    expect(typeBadges.map((node) => node.textContent)).toEqual(["public", "prive", "public"])
  })
})