import { Card, CardContent } from "@/components/ui/card"
import { Users, TrendingUp } from "lucide-react"
import { TeamMemberCard } from "@/components/etablissement/TeamMemberCard"
import { Badge } from "@/components/ui/badge"

interface TeamMember {
  prenom: string
  nom: string
  email: string
  fonction?: string | null
}

interface EtablissementTeamProps {
  commercial?: TeamMember
  chef_projet?: TeamMember
  csm?: TeamMember
}

export function EtablissementTeam({ commercial, chef_projet, csm }: EtablissementTeamProps) {
  const hasTeamMembers = commercial || chef_projet || csm
  const teamMembersCount = [commercial, chef_projet, csm].filter(Boolean).length

  if (!hasTeamMembers) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucun membre d'équipe assigné</p>
          <p className="text-sm text-muted-foreground mt-1">
            Assignez des membres via la page de modification
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Overview Statistics */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{teamMembersCount}</h3>
                <p className="text-sm text-muted-foreground">
                  {teamMembersCount > 1 ? 'membres assignés' : 'membre assigné'}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="w-3 h-3" />
              Équipe complète
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Team Members Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {commercial && (
          <TeamMemberCard
            prenom={commercial.prenom}
            nom={commercial.nom}
            email={commercial.email}
            role="Commercial"
            roleColor="secondary"
            fonction={commercial.fonction}
          />
        )}
        {chef_projet && (
          <TeamMemberCard
            prenom={chef_projet.prenom}
            nom={chef_projet.nom}
            email={chef_projet.email}
            role="Chef de projet"
            roleColor="default"
            fonction={chef_projet.fonction}
          />
        )}
        {csm && (
          <TeamMemberCard
            prenom={csm.prenom}
            nom={csm.nom}
            email={csm.email}
            role="CSM"
            roleColor="outline"
            fonction={csm.fonction}
          />
        )}
      </div>
    </div>
  )
}