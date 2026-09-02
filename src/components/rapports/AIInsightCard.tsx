import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, AlertTriangle, Lightbulb, Search, ChevronRight, Sparkles, Eye, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIInsightModal } from './AIInsightModal'

interface AIInsightCardProps {
  type: 'trend' | 'alert' | 'recommendation' | 'anomaly'
  title: string
  description: string
  priority?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning'
  impact?: 'positive' | 'negative' | 'neutral'
  actions?: string[]
  insightId: string
  onDismiss?: (insightId: string) => void
}

const typeConfig = {
  trend: {
    icon: TrendingUp,
    gradient: 'from-blue-500/10 via-cyan-500/10 to-sky-500/10',
    glowColor: 'shadow-blue-500/20',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    iconColor: 'text-white',
    borderAccent: 'border-blue-500/30',
    label: 'Tendance',
    badgeVariant: 'outline' as const,
    badgeClass: 'border-blue-500/50 text-blue-700 dark:text-blue-300 bg-blue-500/5'
  },
  alert: {
    icon: AlertTriangle,
    gradient: 'from-red-500/10 via-rose-500/10 to-pink-500/10',
    glowColor: 'shadow-red-500/20',
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
    iconColor: 'text-white',
    borderAccent: 'border-red-500/30',
    label: 'Alerte',
    badgeVariant: 'outline' as const,
    badgeClass: 'border-red-500/50 text-red-700 dark:text-red-300 bg-red-500/5'
  },
  recommendation: {
    icon: Lightbulb,
    gradient: 'from-emerald-500/10 via-green-500/10 to-teal-500/10',
    glowColor: 'shadow-emerald-500/20',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconColor: 'text-white',
    borderAccent: 'border-emerald-500/30',
    label: 'Recommandation',
    badgeVariant: 'outline' as const,
    badgeClass: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5'
  },
  anomaly: {
    icon: Search,
    gradient: 'from-amber-500/10 via-orange-500/10 to-yellow-500/10',
    glowColor: 'shadow-amber-500/20',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconColor: 'text-white',
    borderAccent: 'border-amber-500/30',
    label: 'Anomalie',
    badgeVariant: 'outline' as const,
    badgeClass: 'border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/5'
  }
}

const priorityConfig = {
  critical: { 
    color: 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-0', 
    label: 'Critique',
    pulse: true 
  },
  high: { 
    color: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-0', 
    label: 'Élevé',
    pulse: false
  },
  medium: { 
    color: 'bg-gradient-to-r from-yellow-600 to-orange-500 text-white border-0', 
    label: 'Moyen',
    pulse: false
  },
  low: { 
    color: 'bg-muted text-muted-foreground border-border', 
    label: 'Faible',
    pulse: false
  },
  warning: { 
    color: 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-0', 
    label: 'Attention',
    pulse: false
  },
  info: { 
    color: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0', 
    label: 'Info',
    pulse: false
  }
}

const impactConfig = {
  positive: { 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10',
    label: '↑ Positif' 
  },
  negative: { 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-500/10',
    label: '↓ Négatif' 
  },
  neutral: { 
    color: 'text-muted-foreground', 
    bg: 'bg-muted/50',
    label: '→ Neutre' 
  }
}

export function AIInsightCard({
  type,
  title,
  description,
  priority,
  impact,
  actions,
  insightId,
  onDismiss
}: AIInsightCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const config = typeConfig[type]
  const Icon = config.icon
  const priorityInfo = priority ? priorityConfig[priority] : null
  
  // Détecter si le contenu est long
  const hasLongContent = description.length > 250 || (actions && actions.length > 2)

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDismiss) {
      onDismiss(insightId)
    }
  }

  return (
    <>
      {/* Modal pour affichage complet */}
      <AIInsightModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        insight={{ type, title, description, priority, impact, actions }}
      />
    <Card 
      className={cn(
        'group relative overflow-hidden border-2 transition-all duration-300',
        'hover:shadow-lg hover:-translate-y-1 animate-fade-in',
        config.borderAccent,
        config.glowColor,
        'bg-card/50 backdrop-blur-sm'
      )}
    >
      {/* Gradient Background */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50',
        config.gradient
      )} />
      
      {/* Animated sparkle for critical alerts */}
      {priorityInfo?.pulse && (
        <div className="absolute top-2 right-2 animate-pulse">
          <Sparkles className="w-4 h-4 text-red-500" />
        </div>
      )}

      <CardHeader className="relative pb-3">
        <div className="flex items-start gap-3">
          {/* Icon with gradient background */}
          <div className={cn(
            'p-2.5 rounded-xl shadow-lg flex-shrink-0 transform transition-transform group-hover:scale-110',
            config.iconBg
          )}>
            <Icon className={cn('w-5 h-5', config.iconColor)} />
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={config.badgeVariant} className={cn('text-xs font-medium', config.badgeClass)}>
                {config.label}
              </Badge>
              {priority && priorityInfo && (
                <Badge className={cn(
                  'text-xs font-medium shadow-sm',
                  priorityInfo.color,
                  priorityInfo.pulse && 'animate-pulse'
                )}>
                  {priorityInfo.label}
                </Badge>
              )}
              {impact && (
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  impactConfig[impact].color,
                  impactConfig[impact].bg
                )}>
                  {impactConfig[impact].label}
                </span>
              )}
            </div>
            
            {/* Title with truncation */}
            <CardTitle className="text-base sm:text-lg leading-tight line-clamp-2">
              {title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4 pt-0">
        {/* Description with proper overflow handling */}
        <CardDescription className="text-sm leading-relaxed line-clamp-4 whitespace-pre-line">
          {description}
        </CardDescription>
        
        {/* Actions preview */}
        {actions && actions.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              Actions suggérées ({actions.length})
            </p>
            <div className="space-y-1.5">
              {actions.slice(0, 2).map((action, index) => (
                <div
                  key={`action-${index}-${action.slice(0, 20)}`}
                  className={cn(
                    "flex items-start gap-2 text-xs py-2 px-3 rounded-lg",
                    "bg-muted/30 border border-border/50"
                  )}
                >
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <span className="text-left line-clamp-1 leading-snug text-foreground">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bouton "Voir le détail complet" - toujours visible */}
        <div className="pt-3 border-t border-border/50 mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 hover:bg-accent/50 transition-all"
            onClick={() => setIsModalOpen(true)}
          >
            <Eye className="w-4 h-4" />
            Voir le détail complet
          </Button>
          
          {/* Bouton rejeter */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Ne plus afficher cet insight"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            onClick={handleDismiss}
            title="Ne plus afficher cet insight"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  )
}
