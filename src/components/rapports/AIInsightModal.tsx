import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

interface AIInsightModalProps {
  open: boolean
  onClose: () => void
  insight: {
    type: 'trend' | 'alert' | 'recommendation' | 'anomaly'
    title: string
    description: string
    priority?: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info'
    impact?: 'positive' | 'negative' | 'neutral'
    actions?: string[]
  }
}

const typeConfig = {
  trend: {
    icon: TrendingUp,
    label: 'Tendance',
    gradient: 'from-primary/20 via-primary/10 to-transparent',
    iconColor: 'text-primary'
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerte',
    gradient: 'from-destructive/20 via-destructive/10 to-transparent',
    iconColor: 'text-destructive'
  },
  recommendation: {
    icon: Lightbulb,
    label: 'Recommandation',
    gradient: 'from-accent/20 via-accent/10 to-transparent',
    iconColor: 'text-accent-foreground'
  },
  anomaly: {
    icon: AlertCircle,
    label: 'Anomalie',
    gradient: 'from-warning/20 via-warning/10 to-transparent',
    iconColor: 'text-warning'
  }
}

const priorityConfig = {
  critical: { label: 'Critique', color: 'bg-destructive text-destructive-foreground' },
  high: { label: 'Élevée', color: 'bg-orange-500 text-white' },
  medium: { label: 'Moyenne', color: 'bg-accent text-accent-foreground' },
  low: { label: 'Faible', color: 'bg-muted text-muted-foreground' },
  warning: { label: 'Attention', color: 'bg-warning text-warning-foreground' },
  info: { label: 'Info', color: 'bg-primary/20 text-primary' }
}

const impactConfig = {
  positive: { label: 'Positif', color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  negative: { label: 'Négatif', color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  neutral: { label: 'Neutre', color: 'text-muted-foreground bg-muted' }
}

export function AIInsightModal({ open, onClose, insight }: AIInsightModalProps) {
  const config = typeConfig[insight.type]
  const Icon = config.icon

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        {/* Header avec gradient */}
        <div className={`bg-gradient-to-br ${config.gradient} p-6 border-b`}>
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-background/50 backdrop-blur-sm border shadow-lg`}>
                <Icon className={`w-6 h-6 ${config.iconColor}`} />
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-medium">
                    {config.label}
                  </Badge>
                  
                  {insight.priority && (
                    <Badge className={priorityConfig[insight.priority].color}>
                      {priorityConfig[insight.priority].label}
                    </Badge>
                  )}
                  
                  {insight.impact && (
                    <Badge variant="outline" className={impactConfig[insight.impact].color}>
                      {impactConfig[insight.impact].label}
                    </Badge>
                  )}
                </div>
                
                <DialogTitle className="text-2xl leading-tight">
                  {insight.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Contenu scrollable */}
        <ScrollArea className="max-h-[65vh] overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Description complète */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Analyse détaillée
              </h3>
              <DialogDescription className="text-base text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {insight.description}
              </DialogDescription>
            </div>

            {/* Actions suggérées */}
            {insight.actions && insight.actions.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Actions recommandées ({insight.actions.length})
                  </h3>
                  <ol className="space-y-3 list-none">
                    {insight.actions.map((action, index) => (
                      <li
                        key={`insight-action-${index}-${action.slice(0, 20)}`}
                        className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-primary/40 bg-muted/20"
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md border-2 border-primary/60 text-primary text-xs font-bold flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <p className="flex-1 text-sm leading-relaxed text-foreground break-words">
                          {action}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <Button 
            onClick={onClose} 
            className="w-full"
            variant="secondary"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
