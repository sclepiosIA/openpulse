import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { GroupesStatsKPIs } from "./GroupesStatsKPIs"

const { MOCK_GROUPES, EMPTY_GROUPES } = vi.hoisted(() => ({
  MOCK_GROUPES: [
    {
      id: "g1",
      nom: "Groupe A",
      nombre_etablissements: 3,
      progression_moyenne: 12.4,
      total_passages_urgences_annuel: 1200,
    },
    {
      id: "g2",
      nom: "Groupe B",
      nombre_etablissements: 5,
      progression_moyenne: 7.6,
      total_passages_urgences_annuel: 800,
    },
    {
      id: "g3",
      nom: "Groupe C",
      nombre_etablissements: 2,
      progression_moyenne: 10,
      total_passages_urgences_annuel: 0,
    },
  ],
  EMPTY_GROUPES: [],
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("lucide-react", () => ({
  Building2: ({ className }: { className?: string }) => <svg data-testid="icon-building2" className={className} />,
  Users: ({ className }: { className?: string }) => <svg data-testid="icon-users" className={className} />,
  TrendingUp: ({ className }: { className?: string }) => <svg data-testid="icon-trendingup" className={className} />,
  Activity: ({ className }: { className?: string }) => <svg data-testid="icon-activity" className={className} />,
}))

describe("GroupesStatsKPIs", () => {
  it("affiche les 4 KPI avec les valeurs métier calculées correctement", () => {
    render(<GroupesStatsKPIs groupes={MOCK_GROUPES} totalGroupes={10} />)

    expect(screen.getByText("Groupes")).toBeInTheDocument()
    expect(screen.getByText("Établissements")).toBeInTheDocument()
    expect(screen.getByText("Progression moyenne")).toBeInTheDocument()
    expect(screen.getByText("Passages urgences/an")).toBeInTheDocument()

    expect(screen.getByText("3 / 10")).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("10.0%")).toBeInTheDocument()
    expect(screen.getByText("2,000")).toBeInTheDocument()

    expect(screen.getAllByTestId("card")).toHaveLength(4)
    expect(screen.getByTestId("icon-building2")).toBeInTheDocument()
    expect(screen.getByTestId("icon-users")).toBeInTheDocument()
    expect(screen.getByTestId("icon-trendingup")).toBeInTheDocument()
    expect(screen.getByTestId("icon-activity")).toBeInTheDocument()
  })

  it("affiche des valeurs par défaut cohérentes quand la liste est vide", () => {
    render(<GroupesStatsKPIs groupes={EMPTY_GROUPES} totalGroupes={12} />)

    expect(screen.getByText("0 / 12")).toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getByText("0.0%")).toBeInTheDocument()
    expect(screen.getByText("N/A")).toBeInTheDocument()
  })

  it("traite les passages aux urgences absents comme 0 dans le total", () => {
    const groupesAvecValeurManquante = [
      {
        id: "g1",
        nom: "Groupe A",
        nombre_etablissements: 1,
        progression_moyenne: 5,
      },
      {
        id: "g2",
        nom: "Groupe B",
        nombre_etablissements: 2,
        progression_moyenne: 15,
        total_passages_urgences_annuel: 300,
      },
    ]

    render(<GroupesStatsKPIs groupes={groupesAvecValeurManquante} totalGroupes={2} />)

    expect(screen.getByText("2 / 2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("10.0%")).toBeInTheDocument()
    expect(screen.getByText("300")).toBeInTheDocument()
  })
})