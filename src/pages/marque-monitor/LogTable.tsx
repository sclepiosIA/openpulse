import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getProcessingTypeLabel } from '@/hooks/ai/useAIUsageStats'
import type { MonitorLogEntry } from '@/hooks/monitoring/useMonitorLogs'
import { SOURCE_CONFIG, SEVERITY_CONFIG } from './config'

interface LogTableProps {
  logs: MonitorLogEntry[]
  isLoading: boolean
  totalCount: number
  hasMore: boolean
  onLoadMore: () => void
  onSelect: (log: MonitorLogEntry) => void
  isMobile: boolean
}

/**
 * Table d'événements unifiée pour OpenPulse Monitor.
 * Extrait de MarqueMonitor.tsx — DEBT-02 (2026-06-03).
 */
export function LogTable({
  logs,
  isLoading,
  totalCount,
  hasMore,
  onLoadMore,
  onSelect,
  isMobile,
}: LogTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Événements ({totalCount})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="p-3 rounded-full bg-emerald-50">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-foreground">Système opérationnel</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Aucun événement trouvé sur cette période
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead className="w-[90px]">Source</TableHead>
                    <TableHead className="w-[100px]">Sévérité</TableHead>
                    <TableHead className="w-[130px]">Type</TableHead>
                    <TableHead>Message</TableHead>
                    {!isMobile && <TableHead className="w-[140px]">Utilisateur</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const src = SOURCE_CONFIG[log.source]
                    const sev = SEVERITY_CONFIG[log.severity]
                    return (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onSelect(log)}
                      >
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {format(new Date(log.timestamp), 'dd/MM HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px] gap-1', src.color)}>
                            <src.icon className="h-3 w-3" />
                            {src.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[10px]', sev.class)}>
                            {sev.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.source === 'ai' ? getProcessingTypeLabel(log.type) : log.type}
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">
                          {log.message}
                        </TableCell>
                        {!isMobile && (
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {log.userEmail || log.userId?.slice(0, 8) || '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {hasMore && (
              <div className="flex justify-center py-4 border-t">
                <Button variant="outline" size="sm" onClick={onLoadMore} className="gap-1.5">
                  Charger plus ({totalCount - logs.length} restants)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
