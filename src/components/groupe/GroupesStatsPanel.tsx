import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Groupe } from "@/hooks/crm/useGroupes"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { ChevronDown, Building2, MapPin, TrendingUp, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

interface GroupesStatsPanelProps {
  groupes: Groupe[]
  totalGroupes?: number
}

const COLORS = {
  GHT: 'hsl(var(--chart-1))',
  'Groupe Cliniques': 'hsl(var(--chart-2))',
  'Consortium': 'hsl(var(--chart-3))',
  'Autre': 'hsl(var(--chart-4))'
}

export function GroupesStatsPanel({ groupes, totalGroupes }: GroupesStatsPanelProps) {
  const [showDetails, setShowDetails] = useState(false)

  const stats = useMemo(() => {
    const byType = groupes.reduce((acc, g) => {
      acc[g.type] = (acc[g.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byRegion = groupes.reduce((acc, g) => {
      if (g.region) {
        acc[g.region] = (acc[g.region] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const topRegions = Object.entries(byRegion)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const allModules = groupes.flatMap(g => g.modules_deployes || [])
    const modulesCounts = allModules.reduce((acc, m) => {
      acc[m] = (acc[m] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topModules = Object.entries(modulesCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const progressionMoyenne = groupes.length > 0
      ? groupes.reduce((sum, g) => sum + g.progression_moyenne, 0) / groupes.length
      : 0

    const totalEtablissements = groupes.reduce((sum, g) => sum + g.nombre_etablissements, 0)

    return {
      byType,
      topRegions,
      topModules,
      progressionMoyenne,
      totalEtablissements,
      regionsCount: Object.keys(byRegion).length
    }
  }, [groupes])

  const typeChartData = Object.entries(stats.byType).map(([name, value]) => ({
    name,
    value
  }))

  const maxRegionCount = Math.max(...stats.topRegions.map(([, count]) => count), 1)
  const maxModuleCount = Math.max(...stats.topModules.map(([, count]) => count), 1)

  return (
    <Card>
      <CardContent className="p-4">
        {/* KPIs compacts - toujours visibles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{groupes.length}</div>
              <div className="text-xs text-muted-foreground">Groupes</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-chart-1/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.byType.GHT || 0}</div>
              <div className="text-xs text-muted-foreground">GHT</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.progressionMoyenne.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Progression</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.regionsCount}</div>
              <div className="text-xs text-muted-foreground">Régions</div>
            </div>
          </div>
        </div>

        {/* Détails dépliables */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-4 text-muted-foreground">
              {showDetails ? 'Masquer les détails' : 'Voir les détails'}
              <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", showDetails && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Graphique par type */}
              <div>
                <h4 className="text-sm font-medium mb-3">Répartition par type</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {typeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top régions */}
              <div>
                <h4 className="text-sm font-medium mb-3">Top 5 régions</h4>
                <div className="space-y-2">
                  {stats.topRegions.map(([region, count]) => (
                    <div key={region} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{region}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{count}</span>
                      </div>
                      <Progress value={(count / maxRegionCount) * 100} className="h-1.5" />
                    </div>
                  ))}
                  {stats.topRegions.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune région renseignée</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modules les plus déployés */}
            <div>
              <h4 className="text-sm font-medium mb-3">Modules les plus déployés</h4>
              <div className="flex flex-wrap gap-2">
                {stats.topModules.map(([module, count]) => (
                  <Badge key={module} variant="secondary" className="gap-1.5">
                    {module}
                    <span className="text-muted-foreground">({count})</span>
                  </Badge>
                ))}
                {stats.topModules.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun module déployé</p>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
