import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDrilldown } from '@/hooks/analytics/useDrilldown'
import { DrilldownLevel } from '@/contexts/RapportsDrilldownContext'

interface DrilldownMetricProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  color?: string
  evolution?: number | null
  drilldownTarget?: DrilldownLevel
  className?: string
}

export function DrilldownMetric({
  title,
  value,
  description,
  icon: Icon,
  color = 'text-primary',
  evolution,
  drilldownTarget,
  className,
}: DrilldownMetricProps) {
  const { drillDown } = useDrilldown()

  const handleClick = () => {
    if (drilldownTarget) {
      drillDown(drilldownTarget)
    }
  }

  const isClickable = !!drilldownTarget

  // Color mapping for accent borders
  const getAccentColor = () => {
    if (color.includes('chart-1')) return 'border-t-primary'
    if (color.includes('chart-2')) return 'border-t-success'
    if (color.includes('chart-3')) return 'border-t-amber-500'
    if (color.includes('chart-4')) return 'border-t-blue-500'
    if (color.includes('chart-5')) return 'border-t-violet-500'
    if (color.includes('green')) return 'border-t-success'
    if (color.includes('orange')) return 'border-t-orange-500'
    if (color.includes('blue')) return 'border-t-blue-500'
    if (color.includes('purple')) return 'border-t-violet-500'
    if (color.includes('emerald')) return 'border-t-emerald-500'
    return 'border-t-primary'
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5',
        getAccentColor(),
        isClickable && 'cursor-pointer hover:border-primary/30',
        className
      )}
      onClick={handleClick}
    >
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="relative">
          <div
            className={cn(
              'absolute inset-0 rounded-full blur-md opacity-40',
              color.replace('text-', 'bg-')
            )}
          />
          <div
            className={cn(
              'relative h-10 w-10 rounded-full ring-2 flex items-center justify-center',
              color.includes('chart-1') &&
                'bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20',
              color.includes('chart-2') &&
                'bg-gradient-to-br from-success/20 to-success/5 ring-success/20',
              color.includes('chart-3') &&
                'bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-amber-500/20',
              color.includes('chart-4') &&
                'bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-blue-500/20',
              color.includes('chart-5') &&
                'bg-gradient-to-br from-violet-500/20 to-violet-500/5 ring-violet-500/20',
              color.includes('green') &&
                'bg-gradient-to-br from-green-500/20 to-green-500/5 ring-green-500/20',
              color.includes('orange') &&
                'bg-gradient-to-br from-orange-500/20 to-orange-500/5 ring-orange-500/20',
              color.includes('blue') &&
                'bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-blue-500/20',
              color.includes('purple') &&
                'bg-gradient-to-br from-purple-500/20 to-purple-500/5 ring-purple-500/20',
              color.includes('emerald') &&
                'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-emerald-500/20'
            )}
          >
            <Icon className={cn('h-5 w-5', color)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          {value}
        </div>
        <div className="flex items-center justify-between mt-2">
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {evolution !== null && evolution !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                evolution > 0
                  ? 'text-green-700 bg-green-100'
                  : evolution < 0
                    ? 'text-red-700 bg-red-100'
                    : 'text-muted-foreground bg-muted'
              )}
            >
              {evolution > 0 ? '↑' : evolution < 0 ? '↓' : '→'} {Math.abs(evolution)}%
            </div>
          )}
        </div>
        {isClickable && (
          <p className="text-xs text-primary mt-3 font-medium flex items-center gap-1">
            Cliquer pour voir le détail <span className="ml-1">→</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
