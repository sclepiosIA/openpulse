import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Building2, Calendar, AlertOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { DeploymentHealthStatus } from '@/hooks/production/useDeploymentFilters'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { PHASE_GROUPS } from '@/config/phases'

interface DeploymentHeroMetricsProps {
  etablissements: Etablissement[]
  healthScores: Map<string, { score: number; status: DeploymentHealthStatus; reasons: string[] }>
  onPhaseClick?: (statut: string) => void
  activePhases?: string[]
}

// Build deployment phases from centralized config with colors
const DEPLOYMENT_PHASES = PHASE_GROUPS.deploiement.statuts.map((statut, index) => {
  const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-purple-500', 'bg-green-500', 'bg-emerald-500']
  return { value: statut, label: statut, color: colors[index] || 'bg-gray-500' }
})

export function DeploymentHeroMetrics({ etablissements, healthScores, onPhaseClick, activePhases = [] }: DeploymentHeroMetricsProps) {
  const stats = useMemo(() => {
    const total = etablissements.length
    
    // Compter par phase
    const phaseCounts = DEPLOYMENT_PHASES.map(phase => ({
      ...phase,
      count: etablissements.filter(e => e.statut === phase.value).length,
      percentage: total > 0 ? (etablissements.filter(e => e.statut === phase.value).length / total) * 100 : 0
    }))

    // Go-lives à venir
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const goLiveThisMonth = etablissements.filter(e => 
      e.statut === 'Go-Live' || e.statut === 'Formation'
    ).length

    // Alertes
    const delayed = Array.from(healthScores.values()).filter(h => h.status === 'delayed').length
    const blocked = Array.from(healthScores.values()).filter(h => h.status === 'blocked').length

    // CA estimé avec la fonction unifiée
    const totalCA = etablissements.reduce((sum, e) => 
      sum + calculateEtablissementValue(e),
    0)

    return {
      total,
      totalCA,
      goLiveThisMonth,
      delayed,
      blocked,
      phaseCounts
    }
  }, [etablissements, healthScores])

  return (
    <div className="space-y-4">
      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total actifs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total} étab.</div>
            <p className="text-xs text-muted-foreground">
              {(stats.totalCA / 1000000).toFixed(1)}M€ CA estimé
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Go-Live ce mois</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.goLiveThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              En formation ou Go-Live
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.delayed}</div>
            <p className="text-xs text-muted-foreground">
              En retard ⚠️
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgences</CardTitle>
            <AlertOctagon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blocked}</div>
            <p className="text-xs text-muted-foreground">
              Bloqués 🚨
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline visuel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline de déploiement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Barres de phase avec état actif */}
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {stats.phaseCounts.map((phase) => (
                <button
                  key={phase.value}
                  onClick={() => onPhaseClick?.(phase.value)}
                  className={cn(
                    "text-center p-2 sm:p-3 rounded-lg border transition-all",
                    activePhases.includes(phase.value)
                      ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                      : "bg-card hover:bg-accent/50"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground mb-1 truncate">
                    {phase.label}
                  </div>
                  <div className="text-xl sm:text-2xl font-bold">{phase.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {phase.percentage.toFixed(0)}%
                  </div>
                </button>
              ))}
            </div>

            {/* Barre de progression globale améliorée */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Répartition par phase</span>
                <span>{stats.total} établissements</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                {stats.phaseCounts.map((phase) => (
                  phase.count > 0 && (
                    <div
                      key={phase.value}
                      className={cn(phase.color, "transition-all cursor-pointer hover:opacity-80")}
                      style={{ width: `${phase.percentage}%` }}
                      title={`${phase.label}: ${phase.count}`}
                      onClick={() => onPhaseClick?.(phase.value)}
                    />
                  )
                ))}
              </div>
              {/* Légende interactive */}
              <div className="flex flex-wrap gap-2">
                {stats.phaseCounts.map((phase) => (
                  phase.count > 0 && (
                    <button
                      key={phase.value}
                      onClick={() => onPhaseClick?.(phase.value)}
                      className={cn(
                        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-all",
                        activePhases.includes(phase.value)
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className={cn("w-2.5 h-2.5 rounded-sm", phase.color)} />
                      <span className="text-muted-foreground">{phase.label}:</span>
                      <span className="font-medium">{phase.count}</span>
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
