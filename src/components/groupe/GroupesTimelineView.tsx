import { useMemo } from "react"
import { Groupe } from "@/hooks/crm/useGroupes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GroupeBadge } from "@/components/ui/groupe-badge"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Building2, MapPin } from "lucide-react"
import { Link } from "react-router-dom"

interface GroupesTimelineViewProps {
  groupes: Groupe[]
}

export function GroupesTimelineView({ groupes }: GroupesTimelineViewProps) {
  const timelineData = useMemo(() => {
    const sorted = [...groupes].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const grouped = sorted.reduce((acc, groupe) => {
      const year = format(parseISO(groupe.created_at), 'yyyy')
      if (!acc[year]) acc[year] = []
      acc[year].push(groupe)
      return acc
    }, {} as Record<string, Groupe[]>)

    return Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a))
  }, [groupes])

  if (groupes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun groupe trouvé</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {timelineData.map(([year, yearGroupes]) => (
        <div key={year}>
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="text-lg font-bold px-3 py-1">
              {year}
            </Badge>
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">
              {yearGroupes.length} groupe{yearGroupes.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-4 ml-6">
            {yearGroupes.map((groupe) => (
              <Card key={groupe.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Link to={`/groupes/${groupe.id}`}>
                          <CardTitle className="text-lg hover:underline">
                            {groupe.nom}
                          </CardTitle>
                        </Link>
                        <GroupeBadge type={groupe.type} />
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                          Créé le {format(parseISO(groupe.created_at), 'dd MMMM yyyy', { locale: fr })}
                        </span>
                        {groupe.region && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {groupe.region}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Établissements</p>
                      <p className="text-lg font-semibold">{groupe.nombre_etablissements}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Progression</p>
                      <p className="text-lg font-semibold">{groupe.progression_moyenne.toFixed(1)}%</p>
                    </div>
                    {groupe.total_passages_urgences_annuel && (
                      <div>
                        <p className="text-xs text-muted-foreground">Passages/an</p>
                        <p className="text-lg font-semibold">
                          {groupe.total_passages_urgences_annuel.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {groupe.modules_deployes && groupe.modules_deployes.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Modules</p>
                        <div className="flex flex-wrap gap-1">
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
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
