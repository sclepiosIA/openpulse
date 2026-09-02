import { LayoutGrid, List, BarChart3, GitBranch, Users } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ProductionView = 'grid' | 'list' | 'analytics' | 'timeline' | 'cohorts'

interface ProductionViewSelectorProps {
  currentView: ProductionView
  onViewChange: (view: ProductionView) => void
}

const VIEWS = [
  { value: 'grid', label: 'Grille', icon: LayoutGrid },
  { value: 'list', label: 'Liste', icon: List },
  { value: 'analytics', label: 'Analytique', icon: BarChart3 },
  { value: 'timeline', label: 'Chronologie', icon: GitBranch },
  { value: 'cohorts', label: 'Cohortes', icon: Users },
] as const

export function ProductionViewSelector({ currentView, onViewChange }: ProductionViewSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Vue:</span>
      <Tabs value={currentView} onValueChange={(v) => onViewChange(v as ProductionView)}>
        <TabsList>
          {VIEWS.map(view => {
            const Icon = view.icon
            return (
              <TabsTrigger key={view.value} value={view.value} className="gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{view.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}
