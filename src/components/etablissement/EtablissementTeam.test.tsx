import React from "react"
import { render, screen } from "@testing-library/react"

const { CardComp, CardContentComp, BadgeComp, mockTeamMemberCard, UsersComp, TrendingUpComp } = vi.hoisted(() => {
  const mockTeamMemberCard = vi.fn((props: {
    prenom: string
    nom: string
    email: string
    role: string
    roleColor: string
    fonction?: string | null | undefined
  }) => {
    return (
      <div
        data-testid={`team-member-${props.role}`}
        data-props={JSON.stringify({
          prenom: props.prenom,
          nom: props.nom,
          email: props.email,
          role: props.role,
          roleColor: props.roleColor,
          fonction: props.fonction ?? null,
        })}
      >
        {props.prenom} {props.nom}
      </div>
    )
  })

  const CardComp = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  )
  const CardContentComp = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  )
  const BadgeComp = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  )

  const UsersComp = () => <svg data-testid="icon-users" />
  const TrendingUpComp = () => <svg data-testid="icon-trending" />

  return { CardComp, CardContentComp, BadgeComp, mockTeamMemberCard, UsersComp, TrendingUpComp }
})

vi.mock("@/components/etablissement/TeamMemberCard", () => {
  return { TeamMemberCard: mockTeamMemberCard }
})

vi.mock("@/components/ui/card", () => {
  return { Card: CardComp, CardContent: CardContentComp }
})

vi.mock("@/components/ui/badge", () => {
  return { Badge: BadgeComp }
})

vi.mock("lucide-react", () => {
  return { Users: UsersComp, TrendingUp: TrendingUpComp }
})

import { EtablissementTeam } from "./EtablissementTeam"

describe("EtablissementTeam component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders empty state when no team members are provided", () => {
    render(<EtablissementTeam />)

    // Empty state text assertions
    expect(screen.getByText("Aucun membre d'équipe assigné")).toBeTruthy()
    expect(screen.getByText("Assignez des membres via la page de modification")).toBeTruthy()

    // The Users icon should be rendered in the empty state
    const usersIcon = screen.getByTestId("icon-users")
    expect(usersIcon).toBeTruthy()

    // No TeamMemberCard should be rendered (mock not called)
    expect(mockTeamMemberCard).toHaveBeenCalledTimes(0)
  })

  it("renders an overview and three team member cards when commercial, chef_projet and csm are provided", () => {
    const commercial = { prenom: "Alice", nom: "Dupont", email: "alice@example.test", fonction: "Ventes" }
    const chef_projet = { prenom: "Bob", nom: "Martin", email: "bob@example.test", fonction: null }
    const csm = { prenom: "Clara", nom: "Leroy", email: "clara@example.test", fonction: "Support" }

    render(<EtablissementTeam commercial={commercial} chef_projet={chef_projet} csm={csm} />)

    // Team members count: 3
    expect(screen.getByText("3")).toBeTruthy()

    // Plural label for multiple members
    expect(screen.getByText("membres assignés")).toBeTruthy()

    // Badge with 'Équipe complète' and trending icon rendered
    expect(screen.getByTestId("badge")).toBeTruthy()
    expect(screen.getByText("Équipe complète")).toBeTruthy()
    expect(screen.getByTestId("icon-trending")).toBeTruthy()

    // TeamMemberCard should be called three times with correct props
    expect(mockTeamMemberCard).toHaveBeenCalledTimes(3)

    const calls = mockTeamMemberCard.mock.calls as unknown as Array<[Record<string, unknown>]>
    const callProps = calls.map(call => call[0])

    // Find commercial call
    const commercialCall = callProps.find(p => p.role === "Commercial")
    expect(commercialCall).toBeTruthy()
    expect(commercialCall).toEqual(expect.objectContaining({
      prenom: "Alice",
      nom: "Dupont",
      email: "alice@example.test",
      role: "Commercial",
      roleColor: "secondary",
      fonction: "Ventes"
    }))

    // Find chef de projet call
    const chefCall = callProps.find(p => p.role === "Chef de projet")
    expect(chefCall).toBeTruthy()
    expect(chefCall).toEqual(expect.objectContaining({
      prenom: "Bob",
      nom: "Martin",
      email: "bob@example.test",
      role: "Chef de projet",
      roleColor: "default",
      fonction: null
    }))

    // Find CSM call
    const csmCall = callProps.find(p => p.role === "CSM")
    expect(csmCall).toBeTruthy()
    expect(csmCall).toEqual(expect.objectContaining({
      prenom: "Clara",
      nom: "Leroy",
      email: "clara@example.test",
      role: "CSM",
      roleColor: "outline",
      fonction: "Support"
    }))

    // Additionally ensure rendered DOM contains each mocked TeamMemberCard element
    expect(screen.getByTestId("team-member-Commercial")).toBeTruthy()
    expect(screen.getByTestId("team-member-Chef de projet")).toBeTruthy()
    expect(screen.getByTestId("team-member-CSM")).toBeTruthy()
  })

  it("renders singular member count and singular label when only one member is provided", () => {
    const commercial = { prenom: "Diane", nom: "Petit", email: "diane@example.test", fonction: undefined }

    render(<EtablissementTeam commercial={commercial} />)

    // Count should be 1
    expect(screen.getByText("1")).toBeTruthy()

    // Singular label
    expect(screen.getByText("membre assigné")).toBeTruthy()

    // TeamMemberCard called once with Commercial role
    expect(mockTeamMemberCard).toHaveBeenCalledTimes(1)
    const props = mockTeamMemberCard.mock.calls[0][0]
    expect(props).toEqual(expect.objectContaining({
      prenom: "Diane",
      nom: "Petit",
      email: "diane@example.test",
      role: "Commercial",
      roleColor: "secondary",
      fonction: undefined
    }))

    // Rendered DOM for that team member present
    expect(screen.getByTestId("team-member-Commercial")).toBeTruthy()
  })
})