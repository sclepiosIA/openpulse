import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"
import { motion } from "framer-motion"

interface StatusCardProps {
  statut: string
  count: number
  totalValue: number
  totalPassages: number
  percentage: number
  icon: React.ReactNode
  colorClasses: string
  onClick: () => void
  index?: number
}

// Map color classes to accent colors for border
const getAccentColor = (colorClasses: string) => {
  if (colorClasses.includes('destructive')) return 'border-t-destructive'
  if (colorClasses.includes('warning')) return 'border-t-accent'
  if (colorClasses.includes('success')) return 'border-t-success'
  if (colorClasses.includes('primary')) return 'border-t-primary'
  return 'border-t-muted-foreground'
}

const getGlowClass = (colorClasses: string) => {
  if (colorClasses.includes('destructive')) return 'hover:shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.3)]'
  if (colorClasses.includes('warning')) return 'hover:shadow-[0_0_20px_-4px_hsl(var(--accent)/0.3)]'
  if (colorClasses.includes('success')) return 'hover:shadow-glow-cyan'
  if (colorClasses.includes('primary')) return 'hover:shadow-glow-blue'
  return ''
}

export function StatusCard({
  statut,
  count,
  totalValue,
  totalPassages,
  percentage,
  icon,
  colorClasses,
  onClick,
  index = 0
}: StatusCardProps) {
  const accentColor = getAccentColor(colorClasses)
  const glowClass = getGlowClass(colorClasses)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border bg-card overflow-hidden",
        "cursor-pointer transition-all duration-300",
        "hover:scale-[1.02] hover:-translate-y-1",
        "active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "border-t-4",
        accentColor,
        glowClass
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`${statut}: ${count} établissements, ${Math.round(totalValue).toLocaleString('fr-FR')} euros`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110",
              colorClasses.replace('text-', 'bg-').split(' ')[0] + '/10'
            )}>
              {icon}
            </div>
            <span className="font-semibold text-sm">{statut}</span>
          </div>
          <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
        </div>

        {/* Impact number */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">{count}</span>
            <span className="text-xs text-muted-foreground">étab.</span>
          </div>

          {totalValue > 0 && (
            <div className="text-sm font-medium text-muted-foreground">
              {formatNumber(totalValue)}€
            </div>
          )}

          {totalPassages > 0 && (
            <div className="text-xs text-muted-foreground">
              {totalPassages.toLocaleString('fr-FR')} passages
            </div>
          )}

          {/* Progress bar with gradient */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                colorClasses.includes('destructive') && "bg-gradient-to-r from-destructive to-red-400",
                colorClasses.includes('warning') && "bg-gradient-to-r from-accent to-warning",
                colorClasses.includes('success') && "bg-gradient-to-r from-success to-primary-light",
                colorClasses.includes('primary') && "bg-gradient-to-r from-primary to-primary-light",
                !colorClasses.includes('destructive') && !colorClasses.includes('warning') && 
                !colorClasses.includes('success') && !colorClasses.includes('primary') && "bg-muted-foreground"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.6, delay: index * 0.05 }}
            />
          </div>
          <div className="text-xs text-muted-foreground">{percentage}% du total</div>
        </div>
      </div>
    </motion.div>
  )
}
