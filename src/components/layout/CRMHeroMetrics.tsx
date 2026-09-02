import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { EnhancedCard, EnhancedCardContent, AccentColor } from '@/components/ui/enhanced-card'
import { IconCircle, IconCircleColor, IconCircleVariant } from '@/components/ui/icon-circle'

export interface MetricConfig {
  id: string
  label: string
  value: string | number
  subValue?: string | ReactNode
  icon: LucideIcon
  iconColor?: IconCircleColor
  iconVariant?: IconCircleVariant
  accentColor?: AccentColor
  borderColor?: string // Legacy support
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  onClick?: () => void
}

interface CRMHeroMetricsProps {
  metrics: MetricConfig[]
  className?: string
  columns?: 2 | 3 | 4 | 5
}

// Map legacy borderColor to accentColor
function mapBorderToAccent(borderColor?: string): AccentColor {
  if (!borderColor) return 'blue';
  if (borderColor.includes('green') || borderColor.includes('emerald')) return 'green';
  if (borderColor.includes('orange') || borderColor.includes('amber') || borderColor.includes('warning')) return 'orange';
  if (borderColor.includes('red') || borderColor.includes('destructive')) return 'red';
  if (borderColor.includes('purple') || borderColor.includes('violet')) return 'purple';
  if (borderColor.includes('cyan') || borderColor.includes('teal') || borderColor.includes('success')) return 'cyan';
  return 'blue';
}

export function CRMHeroMetrics({ 
  metrics, 
  className,
  columns = 4
}: CRMHeroMetricsProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5'
  }

  return (
    <div className={cn("grid gap-3", gridCols[columns], className)}>
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        const accentColor = metric.accentColor || mapBorderToAccent(metric.borderColor)
        const iconColor = metric.iconColor || 'primary'
        const iconVariant = metric.iconVariant || 'gradient'
        
        return (
          <EnhancedCard 
            key={metric.id}
            accentColor={accentColor}
            accentPosition="left"
            hoverable={!!metric.onClick}
            glowOnHover={!!metric.onClick}
            className={cn("animate-card-enter")}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={metric.onClick}
          >
            <EnhancedCardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">
                    {metric.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-foreground">
                      {metric.value}
                    </p>
                    {metric.trend && (
                      <span className={cn(
                        "text-xs font-medium",
                        metric.trend.isPositive ? "text-success" : "text-destructive"
                      )}>
                        {metric.trend.value > 0 ? '+' : ''}{metric.trend.value}
                        {metric.trend.label && ` ${metric.trend.label}`}
                      </span>
                    )}
                  </div>
                  {metric.subValue && (
                    <p className="text-xs text-muted-foreground">
                      {metric.subValue}
                    </p>
                  )}
                </div>
                <IconCircle
                  icon={Icon}
                  variant={iconVariant}
                  color={iconColor}
                  size="lg"
                  animate={!!metric.onClick}
                />
              </div>
            </EnhancedCardContent>
          </EnhancedCard>
        )
      })}
    </div>
  )
}

// Helper to create a metric pipeline visualization
interface PipelineStage {
  id: string
  label: string
  count: number
  color: string
  onClick?: () => void
}

interface CRMPipelineMetricsProps {
  stages: PipelineStage[]
  className?: string
}

export function CRMPipelineMetrics({ stages, className }: CRMPipelineMetricsProps) {
  const total = stages.reduce((acc, stage) => acc + stage.count, 0)
  
  return (
    <EnhancedCard accentPosition="none" className={className}>
      <EnhancedCardContent className="p-4">
        {/* Stage buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={stage.onClick}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                "transition-all hover:scale-105",
                "bg-muted hover:bg-muted/80"
              )}
            >
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span>{stage.label}</span>
              <span className="text-muted-foreground">({stage.count})</span>
            </button>
          ))}
        </div>
        
        {/* Progress bar */}
        <div className="flex gap-0.5 w-full h-2 rounded-full overflow-hidden bg-muted">
          {stages.map(stage => (
            <div 
              key={stage.id}
              className="transition-all duration-500"
              style={{ 
                backgroundColor: stage.color,
                width: total > 0 ? `${(stage.count / total) * 100}%` : '0%'
              }}
            />
          ))}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  )
}
