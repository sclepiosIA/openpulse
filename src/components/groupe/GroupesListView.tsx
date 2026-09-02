import { Link } from "react-router-dom"
import { Groupe } from "@/hooks/crm/useGroupes"
import { GroupeBadge } from "@/components/ui/groupe-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Eye, MapPin, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { EntityAvatar } from "@/components/ui/EntityAvatar"

interface GroupesListViewProps {
  groupes: Groupe[]
}

export function GroupesListView({ groupes }: GroupesListViewProps) {
  if (groupes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun groupe trouvé</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groupes.map((groupe) => (
        <div
          key={groupe.id}
          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          {/* Avatar */}
          <EntityAvatar
            name={groupe.nom}
            logoUrl={groupe.logo_url}
            size="sm"
          />

          {/* Nom et type */}
          <div className="flex-1 min-w-0">
            <Link to={`/groupes/${groupe.id}`} className="hover:underline">
              <h3 className="font-semibold truncate">{groupe.nom}</h3>
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <GroupeBadge type={groupe.type} />
              {groupe.region && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {groupe.region}
                </span>
              )}
            </div>
          </div>

          {/* Établissements */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Établissements</p>
              <p className="text-sm font-semibold">{groupe.nombre_etablissements}</p>
            </div>
          </div>

          {/* Progression */}
          <div className="min-w-[180px] hidden md:block">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Progression</span>
              <span className="text-xs font-semibold ml-auto">
                {groupe.progression_moyenne.toFixed(1)}%
              </span>
            </div>
            <Progress value={groupe.progression_moyenne} className="h-1.5" />
          </div>

          {/* Modules */}
          <div className="hidden lg:flex items-center gap-1 min-w-[150px]">
            {groupe.modules_deployes && groupe.modules_deployes.length > 0 ? (
              <>
                {groupe.modules_deployes.slice(0, 2).map((module) => (
                  <Badge key={module} variant="outline" className="text-xs">
                    {module}
                  </Badge>
                ))}
                {groupe.modules_deployes.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{groupe.modules_deployes.length - 2}
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Aucun module</span>
            )}
          </div>

          {/* Action */}
          <Link to={`/groupes/${groupe.id}`} aria-label={`Voir le détail du groupe ${groupe.nom}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Eye className="h-4 w-4" />
              <span className="hidden md:inline text-xs">Voir détail</span>
            </Button>
          </Link>
        </div>
      ))}
    </div>
  )
}
