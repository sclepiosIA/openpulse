import { LayoutGrid, Table2, List, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

export type GroupeView = 'grid' | 'table' | 'list' | 'timeline'

interface ViewSelectorGroupesProps {
  currentView: GroupeView
  onViewChange: (view: GroupeView) => void
  variant?: 'default' | 'glassmorphism'
}

const VIEWS = [
  { value: 'grid' as const, label: 'Cartes', icon: LayoutGrid },
  { value: 'table' as const, label: 'Tableau', icon: Table2 },
  { value: 'list' as const, label: 'Liste', icon: List },
  { value: 'timeline' as const, label: 'Timeline', icon: MapPin },
]

export function ViewSelectorGroupes({
  currentView,
  onViewChange,
  variant = 'glassmorphism',
}: ViewSelectorGroupesProps) {
  const isGlassmorphism = variant === 'glassmorphism'

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-0.5 p-0.5 sm:p-1 rounded-lg',
          isGlassmorphism
            ? 'bg-card/10 backdrop-blur-sm border border-white/20'
            : 'bg-muted/50 border'
        )}
      >
        {VIEWS.map((view) => {
          const Icon = view.icon
          const isActive = currentView === view.value
          return (
            <Tooltip key={view.value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewChange(view.value)}
                  className={cn(
                    'h-6 px-2 sm:h-7 sm:px-2.5 gap-1 sm:gap-1.5 rounded-md transition-all',
                    isGlassmorphism
                      ? isActive
                        ? 'bg-card text-primary shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-card/10'
                      : isActive
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden md:inline text-xs">{view.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs md:hidden">
                {view.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
