import { LayoutGrid, Table, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ViewSelectorPartenairesProps {
  currentView: 'grid' | 'table' | 'list'
  onViewChange: (view: 'grid' | 'table' | 'list') => void
  variant?: 'default' | 'glassmorphism'
}

const VIEWS = [
  { value: 'grid' as const, icon: LayoutGrid, label: 'Vue grille' },
  { value: 'table' as const, icon: Table, label: 'Vue tableau' },
  { value: 'list' as const, icon: List, label: 'Vue liste' },
]

export function ViewSelectorPartenaires({
  currentView,
  onViewChange,
  variant = 'glassmorphism',
}: ViewSelectorPartenairesProps) {
  const isGlassmorphism = variant === 'glassmorphism'

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-0.5 p-0.5 rounded-lg shrink-0',
          isGlassmorphism
            ? 'bg-card/10 backdrop-blur-sm border border-white/20'
            : 'border bg-muted/50'
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
                    'h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-md transition-all',
                    isGlassmorphism
                      ? isActive
                        ? 'bg-card text-primary shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-card/10'
                      : isActive
                        ? 'bg-background shadow-sm'
                        : 'hover:bg-background/50'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {view.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
