import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Target, TrendingUp, Activity, Zap, ChevronDown, ArrowRight } from "lucide-react"
import { useAllEtablissements } from "@/hooks/crm/useProspects"
import { cn, formatNumber } from "@/lib/utils"
import { calculateEtablissementValue } from "@/lib/valueCalculations"

const PHASE_DEFINITIONS = {
  debut_cycle: {
    label: "Prospection",
    icon: TrendingUp,
    color: "text-primary",
    bgColor: "bg-primary/10",
    statuts: ['Prospect', 'Contacté', 'Attente RDV'] as string[]
  },
  phase_active: {
    label: "Négociation",
    icon: Activity,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    statuts: ['RDV pris', 'Attente post RDV', 'Dans les RDV', 'Etude émise', 'Dans les RDV post EME', 'Négociation', 'Contractualisation'] as string[]
  },
  phase_finale: {
    label: "Contractuel",
    icon: Zap,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
    statuts: ['Vendu', 'Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live', 'Production'] as string[]
  }
}

export function UnifiedPipeline() {
  const { data: allEtablissements } = useAllEtablissements()
  const navigate = useNavigate()
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)

  const pipelineStats = useMemo(() => {
    if (!allEtablissements || allEtablissements.length === 0) {
      return { phases: [], substages: {} }
    }

    const phases = Object.entries(PHASE_DEFINITIONS).map(([key, config]) => {
      const etablissements = allEtablissements.filter(e => 
        config.statuts.includes(e.statut)
      )
      
      const count = etablissements.length
      const value = etablissements.reduce((sum, e) => 
        sum + calculateEtablissementValue(e), 0
      )

      return { key, ...config, count, value }
    })

    // Calculer les substages pour chaque phase
    type SubstageStats = { name: string; count: number; value: number; percentage: number };
    const substages: Record<string, SubstageStats[]> = {}
    Object.entries(PHASE_DEFINITIONS).forEach(([key, config]) => {
      const stageStats = config.statuts.map(statut => {
        const etablissements = allEtablissements.filter(e => e.statut === statut)
        const count = etablissements.length
        const value = etablissements.reduce((sum, e) => 
          sum + calculateEtablissementValue(e), 0
        )
        return { name: statut, count, value, percentage: 0 }
      }).filter(s => s.count > 0)
      
      substages[key] = stageStats
    })

    return { phases, substages }
  }, [allEtablissements])

  const totalCount = pipelineStats.phases.reduce((sum, p) => sum + p.count, 0)
  const totalValue = pipelineStats.phases.reduce((sum, p) => sum + p.value, 0)

  const handlePhaseClick = (statuts: string[]) => {
    const statusQuery = statuts.join(',')
    navigate(`/etablissements?statut=${encodeURIComponent(statusQuery)}`)
  }

  const handleStageClick = (stageName: string) => {
    navigate(`/etablissements?statut=${encodeURIComponent(stageName)}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Pipeline Commercial
        </CardTitle>
        <CardDescription>
          {totalCount} établissements • {formatNumber(totalValue)} € de valeur totale
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 3 Phases Principales - Desktop */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          {pipelineStats.phases.map((phase) => {
            const Icon = phase.icon
            const percentage = totalCount > 0 ? Math.round((phase.count / totalCount) * 100) : 0
            const isExpanded = expandedPhase === phase.key
            
            return (
              <Collapsible
                key={phase.key}
                open={isExpanded}
                onOpenChange={(open) => setExpandedPhase(open ? phase.key : null)}
              >
                <Card className={cn(
                  "transition-all duration-300 border-2",
                  isExpanded && "ring-2 ring-offset-2 ring-primary"
                )}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={cn("p-2 rounded-lg", phase.bgColor)}>
                        <Icon className={cn("h-5 w-5", phase.color)} />
                      </div>
                      <Badge variant="secondary" className="text-lg px-3">
                        {phase.count}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg">{phase.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(phase.value)}€ • {percentage}%
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePhaseClick(phase.statuts)}
                      >
                        Voir tout
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                      {pipelineStats.substages[phase.key]?.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    <CollapsibleContent className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Détail des statuts :</p>
                      {pipelineStats.substages[phase.key]?.map((stage) => (
                        <div
                          key={stage.name}
                          onClick={() => handleStageClick(stage.name)}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        >
                          <span className="text-sm">{stage.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {stage.count}
                          </Badge>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            )
          })}
        </div>

        {/* Mobile - Vue compacte */}
        <div className="block md:hidden space-y-2">
          {pipelineStats.phases.map((phase) => {
            const Icon = phase.icon
            return (
              <div
                key={phase.key}
                onClick={() => handlePhaseClick(phase.statuts)}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", phase.bgColor)}>
                    <Icon className={cn("h-5 w-5", phase.color)} />
                  </div>
                  <div>
                    <div className="font-medium">{phase.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(phase.value)}€
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{phase.count}</Badge>
              </div>
            )
          })}
        </div>

        {/* Barre de progression globale */}
        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
          {pipelineStats.phases.map((phase) => {
            const percentage = totalCount > 0 ? (phase.count / totalCount) * 100 : 0
            return (
              <div
                key={phase.key}
                className={cn("transition-all", phase.bgColor)}
                style={{ width: `${percentage}%` }}
                title={`${phase.label}: ${phase.count} (${Math.round(percentage)}%)`}
              />
            )
          })}
        </div>
        
        {/* Légende responsive */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-muted-foreground">
          {pipelineStats.phases.map((phase) => (
            <div key={phase.key} className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full shrink-0", phase.bgColor)} />
              <span className="truncate max-w-[70px] sm:max-w-none">{phase.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
