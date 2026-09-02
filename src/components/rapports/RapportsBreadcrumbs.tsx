import { Button } from '@/components/ui/button'
import { ChevronRight, Home, X } from 'lucide-react'
import { useDrilldown } from '@/hooks/analytics/useDrilldown'
import { cn } from '@/lib/utils'

export function RapportsBreadcrumbs() {
  const { breadcrumbs, goToLevel, resetDrilldown } = useDrilldown()

  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-4 overflow-x-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={resetDrilldown}
        className="gap-2 flex-shrink-0"
      >
        <Home className="w-4 h-4" />
        <span className="hidden sm:inline">Réinitialiser</span>
      </Button>
      
      <div className="flex items-center gap-1 flex-wrap">
        {breadcrumbs.map((level, index) => (
          <div key={`crumb-${index}-${level.label}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <Button
              variant={index === breadcrumbs.length - 1 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => goToLevel(index)}
              className={cn(
                'flex-shrink-0',
                index === breadcrumbs.length - 1 && 'font-semibold'
              )}
            >
              {level.label}
            </Button>
          </div>
        ))}
      </div>

      {breadcrumbs.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={resetDrilldown}
          className="ml-auto flex-shrink-0" aria-label="Fermer">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
