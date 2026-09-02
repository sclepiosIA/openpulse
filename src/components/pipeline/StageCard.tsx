import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface PipelineStage {
  name: string
  count: number
  value: number
  color: string
  icon: React.ReactNode
  percentage: number
}

interface StageCardProps {
  stage: PipelineStage
  onClick: () => void
}

export function StageCard({ stage, onClick }: StageCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${stage.name} : ${stage.count} établissements, ${stage.percentage}% du pipeline, ${Math.round(stage.value/1000)}k€`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="group relative p-4 border-2 rounded-lg space-y-3 
                 hover:border-primary hover:shadow-lg hover:shadow-primary/20
                 hover:scale-[1.02] hover:-translate-y-1
                 transition-all duration-300 ease-out cursor-pointer
                 bg-card active:scale-[0.98] active:translate-y-0"
    >
      {/* Header avec icône et nom */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`p-2 rounded-lg ${stage.color} text-white flex-shrink-0
                          group-hover:scale-110 group-hover:rotate-3
                          transition-all duration-300 ease-out`}>
            {stage.icon}
          </div>
          <h4 className="font-semibold text-sm truncate
                         group-hover:text-primary transition-colors duration-200">
            {stage.name}
          </h4>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0
                               group-hover:text-primary group-hover:translate-x-2 
                               transition-all duration-300 ease-out" />
      </div>
      
      {/* Métriques principales */}
      <div className="space-y-2">
        <div className="flex justify-between items-center group/metric">
          <span className="text-xs text-muted-foreground transition-colors duration-200 group-hover/metric:text-foreground">
            Établissements
          </span>
          <span className="font-bold text-lg group-hover:text-primary transition-colors duration-200">
            {stage.count}
          </span>
        </div>
        
        <div className="flex justify-between items-center group/metric">
          <span className="text-xs text-muted-foreground transition-colors duration-200 group-hover/metric:text-foreground">
            Valeur pipeline
          </span>
          <span className="font-semibold text-sm text-primary group-hover:scale-105 transition-transform duration-200 inline-block">
            {Math.round(stage.value / 1000).toLocaleString('fr-FR')}k€
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Part du total</span>
          <Badge variant="secondary" className="text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
            {stage.percentage}%
          </Badge>
        </div>
      </div>
      
      {/* Barre de progression visuelle */}
      <div className="space-y-1">
        <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden group-hover:bg-secondary/70 transition-colors duration-200">
          <div 
            className={`h-2 rounded-full ${stage.color} transition-all duration-500 ease-out
                       group-hover:shadow-lg`}
            style={{ width: `${stage.percentage}%` }}
            aria-valuenow={stage.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-right group-hover:text-foreground transition-colors duration-200">
          {stage.percentage}% du pipeline
        </p>
      </div>
      
      {/* Indicateur hover avec glow effect */}
      <div className="absolute inset-0 rounded-lg border-2 border-primary 
                      opacity-0 group-hover:opacity-20 transition-all duration-300
                      blur-sm pointer-events-none" 
                      aria-hidden="true" />
      <div className="absolute inset-0 rounded-lg
                      bg-gradient-to-br from-primary/5 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300
                      pointer-events-none" 
                      aria-hidden="true" />
    </div>
  )
}
