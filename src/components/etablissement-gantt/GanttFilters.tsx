import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { X, Search } from 'lucide-react'
import { GanttFilters as GanttFiltersType } from './hooks/useGanttFilters'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PHASE_GROUPS, PhaseKey } from '@/config/phases'

interface GanttFiltersProps {
  filters: GanttFiltersType
  onFilterChange: (key: keyof GanttFiltersType, value: any) => void
  onReset: () => void
  categories: Array<{ id: string; nom: string; couleur?: string }>
  statuts: string[]
  priorites: string[]
  etablissements?: Array<{ id: string; nom: string }>
  responsables?: Array<{ id: string; prenom: string; nom: string }>
}

export const GanttFiltersPanel = memo(({
  filters,
  onFilterChange,
  onReset,
  categories,
  statuts,
  priorites,
  etablissements = [],
  responsables = []
}: GanttFiltersProps) => {
  const toggleArrayFilter = (key: keyof GanttFiltersType, value: string) => {
    const current = (filters[key] as string[]) || []
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onFilterChange(key, newValue)
  }

  return (
    <div className="w-80 border-r border-border bg-background">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Filtres</h3>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Réinitialiser
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-6">
          {/* Recherche */}
          <div className="space-y-2">
            <Label>Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Titre ou description..."
                value={filters.searchTerm}
                onChange={(e) => onFilterChange('searchTerm', e.target.value)}
                className="pl-9"
              />
              {filters.searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => onFilterChange('searchTerm', '')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Phases d'établissement */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Phases</Label>
            {(Object.entries(PHASE_GROUPS) as [PhaseKey, typeof PHASE_GROUPS[PhaseKey]][]).map(([key, phase]) => {
              const Icon = phase.icon
              return (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`phase-${key}`}
                    checked={filters.phases?.includes(key) || false}
                    onCheckedChange={() => toggleArrayFilter('phases', key)}
                  />
                  <label
                    htmlFor={`phase-${key}`}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Icon className="h-4 w-4" style={{ color: phase.color }} />
                    {phase.label}
                  </label>
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Catégories */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Catégories</Label>
            {categories.map(category => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${category.id}`}
                  checked={filters.categories.includes(category.id)}
                  onCheckedChange={() => toggleArrayFilter('categories', category.id)}
                />
                <label
                  htmlFor={`cat-${category.id}`}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.couleur || '#888' }}
                  />
                  {category.nom}
                </label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Statuts */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Statuts</Label>
            {statuts.map(statut => (
              <div key={statut} className="flex items-center space-x-2">
                <Checkbox
                  id={`stat-${statut}`}
                  checked={filters.statuts.includes(statut)}
                  onCheckedChange={() => toggleArrayFilter('statuts', statut)}
                />
                <label
                  htmlFor={`stat-${statut}`}
                  className="text-sm cursor-pointer"
                >
                  {statut}
                </label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Priorités */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Priorités</Label>
            {priorites.map(priorite => (
              <div key={priorite} className="flex items-center space-x-2">
                <Checkbox
                  id={`prio-${priorite}`}
                  checked={filters.priorites.includes(priorite)}
                  onCheckedChange={() => toggleArrayFilter('priorites', priorite)}
                />
                <label
                  htmlFor={`prio-${priorite}`}
                  className="text-sm cursor-pointer"
                >
                  {priorite === 'high' ? 'Haute' : priorite === 'medium' ? 'Moyenne' : 'Basse'}
                </label>
              </div>
            ))}
          </div>

          {/* Établissements (si fournis) */}
          {etablissements.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Établissements</Label>
                {etablissements.map(etab => (
                  <div key={etab.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`etab-${etab.id}`}
                      checked={filters.etablissements?.includes(etab.id) || false}
                      onCheckedChange={() => toggleArrayFilter('etablissements', etab.id)}
                    />
                    <label
                      htmlFor={`etab-${etab.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {etab.nom}
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Responsables (si fournis) */}
          {responsables.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Responsables</Label>
                {responsables.map(resp => (
                  <div key={resp.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`resp-${resp.id}`}
                      checked={filters.responsables?.includes(resp.id) || false}
                      onCheckedChange={() => toggleArrayFilter('responsables', resp.id)}
                    />
                    <label
                      htmlFor={`resp-${resp.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {resp.prenom} {resp.nom}
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
})

GanttFiltersPanel.displayName = 'GanttFiltersPanel'
