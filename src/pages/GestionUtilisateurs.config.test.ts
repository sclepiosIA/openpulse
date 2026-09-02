import { rolesConfig, teamsConfig, type AppRole, type TeamType } from "./GestionUtilisateurs.config"
import { Shield, Users, Briefcase, Headphones, Target } from "lucide-react"

describe("GestionUtilisateurs.config - types exports", () => {
  it("contient les types AppRole et TeamType utilisables", () => {
    const role: AppRole = "admin"
    const team: TeamType = "direction"
    expect(role).toBe("admin")
    expect(team).toBe("direction")
  })
})

describe("GestionUtilisateurs.config - rolesConfig", () => {
  it("expose exactement tous les rôles attendus", () => {
    const keys = Object.keys(rolesConfig).sort()
    expect(keys).toEqual(
      [
        "admin",
        "chef_projet",
        "commercial",
        "copil",
        "csm",
        "direction",
        "rh",
      ].sort(),
    )
  })

  it("définit une configuration cohérente pour le rôle direction", () => {
    const role = rolesConfig.direction
    expect(role.label).toBe("Direction")
    expect(role.team).toBe("direction")
    expect(role.color).toBe("text-purple-700 dark:text-purple-400")
    expect(role.bgColor).toBe("bg-purple-100 dark:bg-purple-900/30")
    expect(role.icon).toBe(Shield)
  })

  it("définit une configuration cohérente pour le rôle chef_projet", () => {
    const role = rolesConfig.chef_projet
    expect(role.label).toBe("Chef de projet")
    expect(role.team).toBe("technique")
    expect(role.color).toBe("text-blue-700 dark:text-blue-400")
    expect(role.bgColor).toBe("bg-blue-100 dark:bg-blue-900/30")
    expect(role.icon).toBe(Briefcase)
  })

  it("associe chaque rôle à une équipe existante", () => {
    ;(Object.keys(rolesConfig) as AppRole[]).forEach((key) => {
      const roleConfig = rolesConfig[key]
      expect(roleConfig.team in teamsConfig).toBe(true)
    })
  })

  it("utilise les bonnes icônes lucide pour certains rôles", () => {
    expect(rolesConfig.csm.icon).toBe(Headphones)
    expect(rolesConfig.commercial.icon).toBe(Target)
    expect(rolesConfig.copil.icon).toBe(Users)
    expect(rolesConfig.rh.icon).toBe(Users)
    expect(rolesConfig.admin.icon).toBe(Shield)
  })

  it("tous les rôles ont les propriétés requises non vides", () => {
    Object.values(rolesConfig).forEach((cfg) => {
      expect(typeof cfg.label).toBe("string")
      expect(cfg.label.length).toBeGreaterThan(0)

      expect(typeof cfg.team).toBe("string")
      expect(cfg.team.length).toBeGreaterThan(0)

      expect(typeof cfg.color).toBe("string")
      expect(cfg.color).toContain("text-")

      expect(typeof cfg.bgColor).toBe("string")
      expect(cfg.bgColor).toContain("bg-")

      expect(cfg.icon).toBeDefined()
    })
  })
})

describe("GestionUtilisateurs.config - teamsConfig", () => {
  it("expose exactement toutes les équipes attendues", () => {
    const keys = Object.keys(teamsConfig).sort()
    expect(keys).toEqual(
      [
        "csm",
        "commercial",
        "direction",
        "technique",
      ].sort(),
    )
  })

  it("définit une configuration cohérente pour l'équipe direction", () => {
    const team = teamsConfig.direction
    expect(team.label).toBe("Direction")
    expect(team.color).toBe("text-purple-700 dark:text-purple-400")
    expect(team.bgColor).toBe("bg-purple-100 dark:bg-purple-900/30")
    expect(team.description).toBe("Accès complet à tous les modules")
  })

  it("définit une configuration cohérente pour l'équipe technique", () => {
    const team = teamsConfig.technique
    expect(team.label).toBe("Technique")
    expect(team.color).toBe("text-blue-700 dark:text-blue-400")
    expect(team.bgColor).toBe("bg-blue-100 dark:bg-blue-900/30")
    expect(team.description).toBe("Déploiement, R&D, Support")
  })

  it("définit des descriptions explicites pour chaque équipe", () => {
    expect(teamsConfig.csm.description).toBe("Production, Santé client")
    expect(teamsConfig.commercial.description).toBe("Prospects, Pipeline commercial")
  })

  it("toutes les équipes ont les propriétés requises non vides", () => {
    Object.values(teamsConfig).forEach((cfg) => {
      expect(typeof cfg.label).toBe("string")
      expect(cfg.label.length).toBeGreaterThan(0)

      expect(typeof cfg.color).toBe("string")
      expect(cfg.color).toContain("text-")

      expect(typeof cfg.bgColor).toBe("string")
      expect(cfg.bgColor).toContain("bg-")

      expect(typeof cfg.description).toBe("string")
      expect(cfg.description.length).toBeGreaterThan(5)
    })
  })
})

describe("GestionUtilisateurs.config - cohérence globale", () => {
  it("chaque team utilisée par un rôle existe dans teamsConfig", () => {
    const usedTeams = new Set<TeamType>()
    Object.values(rolesConfig).forEach((cfg) => {
      usedTeams.add(cfg.team)
    })
    usedTeams.forEach((team) => {
      expect(Object.prototype.hasOwnProperty.call(teamsConfig, team)).toBe(true)
    })
  })

  it("tous les labels de rôles sont uniques", () => {
    const labels = Object.values(rolesConfig).map((cfg) => cfg.label)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })

  it("tous les labels d'équipes sont uniques", () => {
    const labels = Object.values(teamsConfig).map((cfg) => cfg.label)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })
})