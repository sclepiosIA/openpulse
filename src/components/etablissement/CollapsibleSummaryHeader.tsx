import { useState, useEffect, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronUp, Building2, TrendingUp, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface CollapsibleSummaryHeaderProps {
  etablissementId: string
  etablissementNom: string
  statut: string
  progression: number
  tasksCompleted: number
  tasksTotal: number
  children: ReactNode
  defaultExpanded?: boolean
}

const statusConfig: Record<string, { label: string; className: string }> = {
  Prospect: {
    label: 'Prospect',
    className: 'bg-slate-500/20 text-foreground dark:text-muted-foreground',
  },
  'Prospect Actif': {
    label: 'Prospect Actif',
    className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  },
  Contractuel: {
    label: 'Contractuel',
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  },
  Déploiement: {
    label: 'Déploiement',
    className: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  },
  Formation: {
    label: 'Formation',
    className: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  },
  Production: {
    label: 'Production',
    className: 'bg-green-500/20 text-green-700 dark:text-green-300',
  },
  Perdu: { label: 'Perdu', className: 'bg-red-500/20 text-red-700 dark:text-red-300' },
  Churned: { label: 'Churned', className: 'bg-red-500/20 text-red-700 dark:text-red-300' },
}

export function CollapsibleSummaryHeader({
  etablissementId,
  etablissementNom,
  statut,
  progression,
  tasksCompleted,
  tasksTotal,
  children,
  defaultExpanded = false,
}: CollapsibleSummaryHeaderProps) {
  const storageKey = `etablissement-header-expanded-${etablissementId}`

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? stored === 'true' : defaultExpanded
    }
    return defaultExpanded
  })

  useEffect(() => {
    localStorage.setItem(storageKey, String(isExpanded))
  }, [isExpanded, storageKey])

  const status = statusConfig[statut] || statusConfig['Prospect']

  // Couleur de bordure selon le statut
  const getBorderColor = () => {
    switch (statut) {
      case 'Production':
        return 'border-l-success'
      case 'Déploiement':
        return 'border-l-primary'
      case 'Formation':
        return 'border-l-accent'
      case 'Contractuel':
        return 'border-l-amber-500'
      case 'Prospect':
        return 'border-l-slate-400'
      case 'Prospect Actif':
        return 'border-l-blue-500'
      default:
        return 'border-l-primary'
    }
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      {/* Compact Header - Always visible - Glassmorphism style */}
      <div
        className={cn(
          'flex items-center justify-between gap-4 p-4 rounded-xl border border-primary/10 bg-card/80 backdrop-blur-sm transition-all border-l-4',
          getBorderColor(),
          !isExpanded && 'shadow-lg hover:shadow-xl'
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon avec gradient et glow */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md opacity-40" />
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/20">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-lg truncate">{etablissementNom}</h2>
              <Badge className={cn('text-xs backdrop-blur-sm shadow-sm', status.className)}>
                {status.label}
              </Badge>
            </div>

            {!isExpanded && (
              <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{progression}%</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="font-medium">
                    {tasksCompleted}/{tasksTotal}
                  </span>{' '}
                  tâches
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mini progress bar when collapsed - Glassmorphism */}
        {!isExpanded && (
          <div className="hidden sm:flex items-center gap-3 w-36 bg-card/50 rounded-lg p-2 backdrop-blur-sm">
            <Progress value={progression} className="h-2.5 flex-1" />
            <span className="text-sm font-bold text-primary">{progression}%</span>
          </div>
        )}

        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 rounded-xl hover:bg-primary/10 transition-all h-9"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Réduire</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Détails</span>
              </>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      {/* Expanded Content */}
      <CollapsibleContent className="mt-4 space-y-4 sm:space-y-6 animate-in slide-in-from-top-2 duration-200">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
