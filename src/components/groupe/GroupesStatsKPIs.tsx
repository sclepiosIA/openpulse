import { Card, CardContent } from "@/components/ui/card"
import { Building2, Users, TrendingUp, Activity } from "lucide-react"
import { Groupe } from "@/hooks/crm/useGroupes"

interface GroupesStatsKPIsProps {
  groupes: Groupe[]
  totalGroupes: number
}

export function GroupesStatsKPIs({ groupes, totalGroupes }: GroupesStatsKPIsProps) {
  const totalEtablissements = groupes.reduce((sum, g) => sum + g.nombre_etablissements, 0)
  const progressionMoyenne = groupes.length > 0
    ? groupes.reduce((sum, g) => sum + g.progression_moyenne, 0) / groupes.length
    : 0
  const totalPassagesUrgences = groupes.reduce((sum, g) => sum + (g.total_passages_urgences_annuel || 0), 0)

  const kpis = [
    {
      label: "Groupes",
      value: `${groupes.length} / ${totalGroupes}`,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950"
    },
    {
      label: "Établissements",
      value: totalEtablissements.toString(),
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950"
    },
    {
      label: "Progression moyenne",
      value: `${progressionMoyenne.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950"
    },
    {
      label: "Passages urgences/an",
      value: totalPassagesUrgences > 0 ? totalPassagesUrgences.toLocaleString() : "N/A",
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950"
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
