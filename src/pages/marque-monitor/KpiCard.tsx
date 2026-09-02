import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  bgColor: string
  className?: string
}

/**
 * Carte KPI compacte pour OpenPulse Monitor.
 * Extrait de MarqueMonitor.tsx — DEBT-02 (2026-06-03).
 */
export function KpiCard({ title, value, icon: Icon, color, bgColor, className }: KpiCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{title}</p>
            <p className={cn('text-lg sm:text-2xl font-bold mt-0.5', color)}>{value}</p>
          </div>
          <div className={cn('p-2 rounded-lg', bgColor)}>
            <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
