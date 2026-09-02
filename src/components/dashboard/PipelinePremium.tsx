import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Target, TrendingUp, Activity, Zap, ChevronDown, ChevronRight, ArrowRight } from "lucide-react"
import { useAllEtablissements } from "@/hooks/crm/useProspects"
import { cn, formatNumber } from "@/lib/utils"
import { calculateEtablissementValue } from "@/lib/valueCalculations"
import { GlowBadge } from "@/components/ui/glow-badge"
import { LucideIcon } from "lucide-react"

const PHASE_DEFINITIONS = {
  prospection: {
    label: "Prospection",
    icon: TrendingUp,
    color: 'primary' as const,
    statuts: ['Prospect', 'Contacté', 'Attente RDV']
  },
  negociation: {
    label: "Négociation",
    icon: Activity,
    color: 'accent' as const,
    statuts: ['RDV pris', 'Attente post RDV', 'Dans les RDV', 'Etude émise', 'Dans les RDV post EME', 'Négociation', 'Contractualisation']
  },
  deploiement: {
    label: "Déploiement",
    icon: Zap,
    color: 'success' as const,
    statuts: ['Vendu', 'Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live', 'Production']
  }
}

const colorClasses = {
  primary: {
    bg: 'bg-primary',
    bgLight: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary',
    glow: 'shadow-glow-blue',
    gradient: 'from-primary to-primary-dark'
  },
  accent: {
    bg: 'bg-accent',
    bgLight: 'bg-accent/10',
    text: 'text-accent',
    border: 'border-accent',
    glow: 'shadow-glow-orange',
    gradient: 'from-accent to-warning'
  },
  success: {
    bg: 'bg-success',
    bgLight: 'bg-success/10',
    text: 'text-success',
    border: 'border-success',
    glow: 'shadow-glow-cyan',
    gradient: 'from-success to-primary-light'
  }
}

interface PhaseCardProps {
  phase: {
    key: string
    label: string
    icon: LucideIcon
    color: 'primary' | 'accent' | 'success'
    count: number
    value: number
    percentage: number
    statuts: string[]
  }
  substages: Array<{ name: string; count: number; value: number }>
  isExpanded: boolean
  onToggle: () => void
  onPhaseClick: (statuts: string[]) => void
  onStageClick: (stageName: string) => void
}

function PhaseCard({ phase, substages, isExpanded, onToggle, onPhaseClick, onStageClick }: PhaseCardProps) {
  const Icon = phase.icon
  const colors = colorClasses[phase.color]
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Timeline connector */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1.5 rounded-full transition-all duration-300",
        colors.bg,
        isExpanded && colors.glow
      )} />
      
      {/* Glowing dot */}
      <div className="absolute left-0 top-6 -translate-x-[calc(50%-3px)]">
        <div className={cn(
          "relative w-5 h-5 rounded-full border-2 border-background",
          colors.bg,
          "transition-all duration-300"
        )}>
          {isExpanded && (
            <motion.div
              className={cn("absolute inset-0 rounded-full", colors.bg)}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      </div>
      
      <div className="pl-8">
        <motion.div
          className={cn(
            "relative rounded-xl border-2 transition-all duration-300 overflow-hidden",
            "bg-card hover:shadow-card-hover",
            isExpanded ? colors.border : "border-border hover:" + colors.border
          )}
          whileHover={{ x: 4 }}
        >
          {/* Top accent line */}
          <div className={cn("h-1 w-full bg-gradient-to-r", colors.gradient)} />
          
          <div className="p-4 sm:p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  colors.bgLight,
                  "group-hover:scale-110"
                )}>
                  <Icon className={cn("h-5 w-5", colors.text)} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{phase.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(phase.value)}€ • {phase.percentage}% du pipeline
                  </p>
                </div>
              </div>
              
              <GlowBadge 
                variant={phase.color} 
                size="lg" 
                glow={isExpanded}
              >
                {phase.count}
              </GlowBadge>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-4">
              <motion.div
                className={cn("h-full rounded-full bg-gradient-to-r", colors.gradient)}
                initial={{ width: 0 }}
                animate={{ width: `${phase.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className={cn("flex-1", colors.text, "hover:" + colors.bgLight)}
                onClick={() => onPhaseClick(phase.statuts)}
              >
                Voir tous
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
              
              {substages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className={cn(colors.text)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Expanded substages */}
          <AnimatePresence>
            {isExpanded && substages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t"
              >
                <div className="p-4 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Détail par statut :
                  </p>
                  {substages.map((stage, idx) => (
                    <motion.div
                      key={stage.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => onStageClick(stage.name)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        "bg-background border cursor-pointer",
                        "hover:shadow-sm hover:border-primary/30",
                        "transition-all duration-200"
                      )}
                    >
                      <span className="text-sm font-medium">{stage.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(stage.value)}€
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {stage.count}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  )
}

export function PipelinePremium() {
  const { data: allEtablissements } = useAllEtablissements()
  const navigate = useNavigate()
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)

  const pipelineStats = useMemo(() => {
    if (!allEtablissements || allEtablissements.length === 0) {
      return { phases: [], substages: {}, total: { count: 0, value: 0 } }
    }

    const total = {
      count: allEtablissements.length,
      value: allEtablissements.reduce((sum, e) => sum + calculateEtablissementValue(e), 0)
    }

    const phases = Object.entries(PHASE_DEFINITIONS).map(([key, config]) => {
      const etablissements = allEtablissements.filter(e => 
        config.statuts.includes(e.statut)
      )
      
      const count = etablissements.length
      const value = etablissements.reduce((sum, e) => 
        sum + calculateEtablissementValue(e), 0
      )
      const percentage = total.count > 0 ? Math.round((count / total.count) * 100) : 0

      return { key, ...config, count, value, percentage }
    })

    const substages: Record<string, Array<{ name: string; count: number; value: number }>> = {}
    Object.entries(PHASE_DEFINITIONS).forEach(([key, config]) => {
      const stageStats = config.statuts.map(statut => {
        const etablissements = allEtablissements.filter(e => e.statut === statut)
        const count = etablissements.length
        const value = etablissements.reduce((sum, e) => 
          sum + calculateEtablissementValue(e), 0
        )
        return { name: statut, count, value }
      }).filter(s => s.count > 0)
      
      substages[key] = stageStats
    })

    return { phases, substages, total }
  }, [allEtablissements])

  const handlePhaseClick = (statuts: string[]) => {
    const statusQuery = statuts.join(',')
    navigate(`/etablissements?statut=${encodeURIComponent(statusQuery)}`)
  }

  const handleStageClick = (stageName: string) => {
    navigate(`/etablissements?statut=${encodeURIComponent(stageName)}`)
  }

  return (
    <Card className="overflow-hidden">
      {/* Premium header with gradient */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-success" />
      
      <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-success/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-primary-foreground">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Pipeline Commercial</CardTitle>
              <p className="text-sm text-muted-foreground">
                {pipelineStats.total.count} établissements • {formatNumber(pipelineStats.total.value)}€
              </p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/forecasting')}
            >
              Forecast
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/etablissements')}
            >
              Vue complète
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {/* Timeline layout */}
        <div className="space-y-6">
          {pipelineStats.phases.map((phase) => (
            <PhaseCard
              key={phase.key}
              phase={phase}
              substages={pipelineStats.substages[phase.key] || []}
              isExpanded={expandedPhase === phase.key}
              onToggle={() => setExpandedPhase(
                expandedPhase === phase.key ? null : phase.key
              )}
              onPhaseClick={handlePhaseClick}
              onStageClick={handleStageClick}
            />
          ))}
        </div>
        
        {/* Global progress bar */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Progression globale</span>
            <span>{pipelineStats.phases.reduce((sum, p) => sum + p.percentage, 0) > 0 ? '100%' : '0%'}</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {pipelineStats.phases.map((phase) => {
              const colors = colorClasses[phase.color]
              return (
                <motion.div
                  key={phase.key}
                  className={cn("h-full bg-gradient-to-r", colors.gradient)}
                  initial={{ width: 0 }}
                  animate={{ width: `${phase.percentage}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  title={`${phase.label}: ${phase.count} (${phase.percentage}%)`}
                />
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            {pipelineStats.phases.map((phase) => {
              const colors = colorClasses[phase.color]
              return (
                <div key={phase.key} className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", colors.bg)} />
                  <span className="text-xs text-muted-foreground">{phase.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
