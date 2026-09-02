import { LayoutGrid, List, Table2, Kanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ProspectView = 'grid' | 'list' | 'table' | 'kanban'

interface ProspectsViewSelectorProps {
  currentView: ProspectView
  onViewChange: (view: ProspectView) => void
  variant?: 'default' | 'glassmorphism'
  /** Mode compact pour mobile */
  compact?: boolean
}

const views: { value: ProspectView; icon: typeof LayoutGrid; label: string; ariaLabel: string }[] =
  [
    {
      value: 'grid',
      icon: LayoutGrid,
      label: 'Grille',
      ariaLabel: 'Afficher les prospects en grille',
    },
    { value: 'list', icon: List, label: 'Liste', ariaLabel: 'Afficher les prospects en liste' },
    {
      value: 'table',
      icon: Table2,
      label: 'Tableau',
      ariaLabel: 'Afficher les prospects en tableau',
    },
    {
      value: 'kanban',
      icon: Kanban,
      label: 'Kanban',
      ariaLabel: 'Afficher les prospects en Kanban',
    },
  ]

export function ProspectsViewSelector({
  currentView,
  onViewChange,
  variant = 'glassmorphism',
  compact = false,
}: ProspectsViewSelectorProps) {
  const isGlassmorphism = variant === 'glassmorphism'

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-0.5 p-0.5 rounded-lg',
          isGlassmorphism
            ? 'bg-card/10 backdrop-blur-sm border border-white/20'
            : 'bg-muted/50 border'
        )}
      >
        {views.map(({ value, icon: Icon, label, ariaLabel }) => {
          const isActive = currentView === value
          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewChange(value)}
                  aria-label={ariaLabel}
                  aria-pressed={isActive}
                  className={cn(
                    'p-0 rounded-md transition-all',
                    compact ? 'h-6 w-6' : 'h-7 w-7',
                    isGlassmorphism
                      ? isActive
                        ? 'bg-card text-primary shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-card/10'
                      : isActive
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                  )}
                >
                  <Icon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
