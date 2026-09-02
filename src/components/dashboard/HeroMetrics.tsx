import { Building2, Euro, AlertTriangle, TrendingUp, Ban, ArrowUp, ArrowDown } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn, formatNumber } from "@/lib/utils"
import { EnhancedCard, EnhancedCardContent, AccentColor } from "@/components/ui/enhanced-card"
import { IconCircle, IconCircleColor, IconCircleVariant } from "@/components/ui/icon-circle"
import { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"

interface HeroMetricsProps {
  totalEtablissements: number
  prospects: number
  contractuels: number
  production: number
  totalValeur: number
  urgentTasksCount: number
  conversionRate: number
  totalBloques?: number
  valeurBloquee?: number
}

interface MetricConfig {
  label: string
  value: string | number
  icon: LucideIcon
  description: string
  accentColor: AccentColor
  iconColor: IconCircleColor
  iconVariant: IconCircleVariant
  onClick: () => void
  trend?: { value: number; isPositive: boolean }
}

export function HeroMetrics({
  totalEtablissements,
  prospects,
  contractuels,
  production,
  totalValeur,
  urgentTasksCount,
  conversionRate,
  totalBloques = 0,
  valeurBloquee = 0,
}: HeroMetricsProps) {
  const navigate = useNavigate()

  const metrics: MetricConfig[] = [
    {
      label: "Total Établissements",
      value: totalEtablissements,
      icon: Building2,
      description: `${prospects} prospects • ${contractuels} contractuels • ${production} production`,
      accentColor: "blue",
      iconColor: "primary",
      iconVariant: "gradient",
      onClick: () => navigate('/etablissements'),
      trend: { value: 5, isPositive: true }
    },
    {
      label: "CA Potentiel Total",
      value: `${formatNumber(totalValeur)}€`,
      icon: Euro,
      description: "Valeur totale du pipeline",
      accentColor: "green",
      iconColor: "success",
      iconVariant: "gradient",
      onClick: () => navigate('/etablissements'),
      trend: { value: 12, isPositive: true }
    },
    {
      label: "Tâches Urgentes",
      value: urgentTasksCount,
      icon: AlertTriangle,
      description: "À faire dans les 7 prochains jours",
      accentColor: urgentTasksCount > 0 ? "orange" : "blue",
      iconColor: urgentTasksCount > 0 ? "warning" : "muted",
      iconVariant: urgentTasksCount > 0 ? "gradient" : "soft",
      onClick: () => navigate('/projets?filter=urgent'),
      trend: urgentTasksCount > 0 ? { value: 3, isPositive: false } : undefined
    },
    {
      label: "Taux de Conversion",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      description: "Prospect → Vendu",
      accentColor: "cyan",
      iconColor: "primary",
      iconVariant: "gradient",
      onClick: () => navigate('/etablissements'),
      trend: { value: 2.5, isPositive: true }
    },
    {
      label: "Établissements Bloqués",
      value: totalBloques.toString(),
      icon: Ban,
      description: valeurBloquee > 0 ? `${formatNumber(valeurBloquee)} € bloqués` : 'Aucune valeur bloquée',
      accentColor: "red",
      iconColor: "destructive",
      iconVariant: totalBloques > 0 ? "gradient" : "soft",
      onClick: () => navigate('/prospects'),
      trend: totalBloques > 0 ? { value: 1, isPositive: false } : undefined
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
        >
          <EnhancedCard
            accentColor={metric.accentColor}
            accentPosition="top"
            hoverable
            glowOnHover
            className="h-full group"
            onClick={metric.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                metric.onClick()
              }
            }}
          >
            <EnhancedCardContent className="p-3 sm:p-4 lg:p-5">
              <div className="flex items-start justify-between gap-2 mb-2 sm:mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">
                    {metric.label}
                  </p>
                </div>
                <IconCircle
                  icon={metric.icon}
                  variant={metric.iconVariant}
                  color={metric.iconColor}
                  size="sm"
                  animate
                  className="group-hover:scale-110 transition-transform duration-300 shrink-0"
                />
              </div>
              
              {/* Large impact value */}
              <div className="mb-2 sm:mb-3">
                <p className={cn(
                  "text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight truncate",
                  metric.accentColor === 'blue' && "text-primary",
                  metric.accentColor === 'green' && "text-success",
                  metric.accentColor === 'cyan' && "text-primary",
                  metric.accentColor === 'orange' && "text-accent",
                  metric.accentColor === 'red' && "text-destructive"
                )}>
                  {metric.value}
                </p>
                
                {/* Trend indicator */}
                {metric.trend && (
                  <div className={cn(
                    "flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-semibold",
                    metric.trend.isPositive ? "text-success" : "text-destructive"
                  )}>
                    {metric.trend.isPositive ? (
                      <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    ) : (
                      <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    )}
                    <span>{metric.trend.isPositive ? '+' : ''}{metric.trend.value}%</span>
                    <span className="text-muted-foreground font-normal ml-1 hidden sm:inline">ce mois</span>
                  </div>
                )}
              </div>
              
              {/* Description */}
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 break-words">
                {metric.description}
              </p>
              
              {/* Hover indicator line */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left",
                metric.accentColor === 'blue' && "bg-primary",
                metric.accentColor === 'green' && "bg-success",
                metric.accentColor === 'cyan' && "bg-success",
                metric.accentColor === 'orange' && "bg-accent",
                metric.accentColor === 'red' && "bg-destructive"
              )} />
            </EnhancedCardContent>
          </EnhancedCard>
        </motion.div>
      ))}
    </div>
  )
}
