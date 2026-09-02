import { Repeat, Zap } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { SOURCE_CONFIG } from './config'
import type { MonitorSource } from '@/hooks/monitoring/useMonitorLogs'

interface RecurringPattern {
  fingerprint: string
  source: MonitorSource
  message: string
  count: number
  firstSeen: string | number | Date
  lastSeen: string | number | Date
}

interface PatternsTabProps {
  recurringPatterns: RecurringPattern[]
}

export function PatternsTab({ recurringPatterns }: PatternsTabProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          Erreurs récurrentes ({recurringPatterns.length})
        </CardTitle>
        <CardDescription className="text-xs">
          Erreurs apparaissant au moins 2 fois — triées par fréquence
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recurringPatterns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun pattern récurrent détecté sur cette période
          </div>
        ) : (
          <div className="space-y-3">
            {recurringPatterns.slice(0, 30).map((pattern) => {
              const src = SOURCE_CONFIG[pattern.source]
              const maxCount = recurringPatterns[0]?.count || 1
              return (
                <div
                  key={pattern.fingerprint}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] gap-1', src.color)}>
                        <src.icon className="h-3 w-3" />
                        {src.label}
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-bold gap-1">
                        <Zap className="h-3 w-3" />
                        {pattern.count}x
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(pattern.lastSeen), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-foreground/80 line-clamp-2">
                    {pattern.message}
                  </p>
                  <Progress value={(pattern.count / maxCount) * 100} className="h-1.5" />
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>
                      Premier:{' '}
                      {format(new Date(pattern.firstSeen), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                    <span>
                      Dernier:{' '}
                      {format(new Date(pattern.lastSeen), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
