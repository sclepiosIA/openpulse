import { LayoutGrid, Table2, List, Kanban } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type EtablissementView = 'grid' | 'table' | 'list' | 'kanban'

interface ViewSelectorProps {
  currentView: EtablissementView
  onViewChange: (view: EtablissementView) => void
}

const VIEWS = [
  { value: 'grid', label: 'Cartes', icon: LayoutGrid },
  { value: 'table', label: 'Tableau', icon: Table2 },
  { value: 'list', label: 'Liste', icon: List },
  { value: 'kanban', label: 'Kanban', icon: Kanban },
] as const

/**
 * Sélecteur de vue — implémenté en toggle-group `role="radiogroup"` plutôt
 * qu'en Radix Tabs, car le contenu réel de chaque "vue" est rendu ailleurs
 * dans la page (dans <Etablissements> selon `currentView`), sans <TabsContent>.
 * Utiliser Tabs génèrerait des `aria-controls` pointant vers des panels
 * inexistants → violation axe `aria-valid-attr-value`.
 */
export function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="radiogroup"
        aria-label="Type de vue"
        className="inline-flex h-8 sm:h-9 items-center gap-0.5 p-0.5 sm:p-1 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg sm:rounded-xl shadow-lg"
      >
        {VIEWS.map((view) => {
          const Icon = view.icon
          const active = currentView === view.value
          return (
            <Tooltip key={view.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={view.label}
                  onClick={() => onViewChange(view.value)}
                  className={cn(
                    'inline-flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg transition-all duration-200',
                    'text-white/70 hover:text-white hover:bg-card/10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                    active &&
                      'bg-card text-primary shadow-md ring-1 ring-primary/20 hover:bg-card hover:text-primary'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                  <span className="sr-only">{view.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="text-xs bg-slate-900/95 text-white border-slate-700 rounded-lg shadow-xl"
              >
                {view.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
