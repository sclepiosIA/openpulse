import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Check, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { getProcessingTypeLabel } from '@/hooks/ai/useAIUsageStats'
import type { MonitorLogEntry } from '@/hooks/monitoring/useMonitorLogs'
import { SOURCE_CONFIG, SEVERITY_CONFIG } from './config'

interface LogDetailDialogProps {
  log: MonitorLogEntry | null
  onClose: () => void
}

/**
 * Dialog de détail d'un log OpenPulse Monitor.
 * Extrait de MarqueMonitor.tsx — DEBT-02 (2026-06-03).
 */
export function LogDetailDialog({ log, onClose }: LogDetailDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyJson = () => {
    if (!log) return
    navigator.clipboard.writeText(JSON.stringify(log, null, 2)).then(() => {
      setCopied(true)
      toast.success('JSON copié dans le presse-papiers')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={!!log} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base flex-wrap">
            {log && (
              <>
                <Badge variant="outline" className={SOURCE_CONFIG[log.source].color}>
                  {SOURCE_CONFIG[log.source].label}
                </Badge>
                <Badge variant="outline" className={SEVERITY_CONFIG[log.severity].class}>
                  {SEVERITY_CONFIG[log.severity].label}
                </Badge>
                <span className="text-muted-foreground text-sm ml-auto">
                  {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                </span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        {log && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Type</p>
                <p className="text-sm">
                  {log.source === 'ai' ? getProcessingTypeLabel(log.type) : log.type}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Message</p>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md font-mono text-xs">
                  {log.message}
                </p>
              </div>
              {(log.userEmail || log.userId) && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Utilisateur</p>
                  <p className="text-sm">{log.userEmail || log.userId}</p>
                </div>
              )}
              {log.metadata && log.metadata['stack'] != null && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Stack Trace</p>
                  <pre className="text-[10px] bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                    {String(log.metadata['stack'])}
                  </pre>
                </div>
              )}
              {log.metadata && log.metadata['route'] != null && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Route</p>
                  <p className="text-sm font-mono">{String(log.metadata['route'])}</p>
                </div>
              )}
              {log.metadata && log.metadata['console_logs'] != null && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Console Logs</p>
                  <pre className="text-[10px] bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                    {JSON.stringify(log.metadata['console_logs'], null, 2)}
                  </pre>
                </div>
              )}
              {log.metadata &&
                Object.keys(log.metadata).filter(
                  (k) => !['stack', 'route', 'console_logs'].includes(k)
                ).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Métadonnées</p>
                    <pre className="text-[10px] bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(log.metadata).filter(
                            ([k]) => !['stack', 'route', 'console_logs'].includes(k)
                          )
                        ),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              <Separator />
              <Button size="sm" variant="outline" onClick={handleCopyJson} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copié !' : 'Copier le JSON'}
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
