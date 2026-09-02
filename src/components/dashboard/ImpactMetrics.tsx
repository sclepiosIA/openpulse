import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface ImpactMetric {
  value: string | number
  label: string
  sublabel?: string
  trend?: number
  icon?: LucideIcon
  color?: 'primary' | 'success' | 'warning' | 'accent'
}

interface ImpactMetricsProps {
  metrics: ImpactMetric[]
  title?: string
  className?: string
}

const colorClasses = {
  primary: {
    text: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    glow: 'shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]'
  },
  success: {
    text: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    glow: 'shadow-[0_0_30px_-5px_hsl(var(--success)/0.3)]'
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    glow: 'shadow-[0_0_30px_-5px_hsl(var(--warning)/0.3)]'
  },
  accent: {
    text: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/20',
    glow: 'shadow-[0_0_30px_-5px_hsl(var(--accent)/0.3)]'
  }
}

export function ImpactMetrics({ metrics, title, className }: ImpactMetricsProps) {
  return (
    <motion.section 
      className={cn("py-4", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {title && (
        <h2 className="text-xl font-bold text-center mb-8 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
          {title}
        </h2>
      )}
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          const colors = colorClasses[metric.color || 'primary']
          
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={cn(
                "relative group",
                "p-6 rounded-2xl",
                "bg-card border-2",
                colors.border,
                "hover:scale-105 hover:-translate-y-1",
                "transition-all duration-300 ease-out",
                "hover:" + colors.glow
              )}
            >
              {/* Decorative gradient overlay */}
              <div className={cn(
                "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                "bg-gradient-to-br from-transparent via-transparent",
                metric.color === 'primary' ? 'to-primary/5' :
                metric.color === 'success' ? 'to-success/5' :
                metric.color === 'warning' ? 'to-warning/5' :
                'to-accent/5'
              )} />
              
              <div className="relative z-10">
                {/* Icon header */}
                {Icon && (
                  <div className={cn(
                    "w-12 h-12 rounded-xl mb-4 flex items-center justify-center",
                    colors.bg,
                    "group-hover:scale-110 transition-transform duration-300"
                  )}>
                    <Icon className={cn("h-6 w-6", colors.text)} />
                  </div>
                )}
                
                {/* Value with trend */}
                <div className="flex items-baseline gap-3 mb-2">
                  <span className={cn(
                    "text-4xl sm:text-5xl font-black tracking-tight",
                    colors.text
                  )}>
                    {typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value}
                  </span>
                  
                  {metric.trend !== undefined && metric.trend !== 0 && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className={cn(
                        "flex items-center text-sm font-bold px-2 py-1 rounded-full",
                        metric.trend > 0 
                          ? "text-success bg-success/10" 
                          : "text-destructive bg-destructive/10"
                      )}
                    >
                      {metric.trend > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 mr-1" />
                      )}
                      {Math.abs(metric.trend)}%
                    </motion.span>
                  )}
                </div>
                
                {/* Label */}
                <p className="text-base font-semibold text-foreground">
                  {metric.label}
                </p>
                
                {/* Sublabel */}
                {metric.sublabel && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {metric.sublabel}
                  </p>
                )}
              </div>
              
              {/* Bottom accent line */}
              <div className={cn(
                "absolute bottom-0 left-4 right-4 h-1 rounded-full",
                colors.bg,
                "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              )} />
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}