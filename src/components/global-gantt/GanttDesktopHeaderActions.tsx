import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, AlertCircle, Plus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GanttAlert } from './globalGanttHelpers'

type GroupByOption = 'etablissement' | 'categorie' | 'responsable' | 'statut'
type SortField = 'date_debut' | 'echeance' | 'titre' | 'priorite' | 'statut' | 'responsable'
type SortDirection = 'asc' | 'desc'

interface GanttDesktopHeaderActionsProps {
  alerts: GanttAlert[]
  groupBy: GroupByOption
  onGroupByChange: (v: GroupByOption) => void
  sortField: SortField
  onSortFieldChange: (v: SortField) => void
  sortDirection: SortDirection
  onSortDirectionToggle: () => void
  onCreateTask: () => void
}

export function GanttDesktopHeaderActions({
  alerts,
  groupBy,
  onGroupByChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onSortDirectionToggle,
  onCreateTask,
}: GanttDesktopHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {alerts.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20 rounded-lg relative"
            >
              <Bell className="h-4 w-4" />
              <Badge
                variant={alerts.some((a) => a.type === 'critical') ? 'destructive' : 'default'}
                className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {alerts.length}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {alerts.map((alert) => (
              <DropdownMenuItem key={alert.id} className="text-xs">
                <AlertCircle
                  className={cn(
                    'h-3.5 w-3.5 mr-2',
                    alert.type === 'critical' && 'text-destructive',
                    alert.type === 'warning' && 'text-warning',
                    alert.type === 'info' && 'text-primary'
                  )}
                />
                {alert.message}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Select value={groupBy} onValueChange={(value) => onGroupByChange(value as GroupByOption)}>
        <SelectTrigger className="w-[100px] sm:w-[130px] h-9 bg-card/10 backdrop-blur-sm border-white/20 text-white text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="etablissement" className="text-xs">
            Établissement
          </SelectItem>
          <SelectItem value="categorie" className="text-xs">
            Catégorie
          </SelectItem>
          <SelectItem value="responsable" className="text-xs">
            Responsable
          </SelectItem>
          <SelectItem value="statut" className="text-xs">
            Statut
          </SelectItem>
        </SelectContent>
      </Select>

      <div className="hidden sm:flex items-center gap-0.5">
        <Select value={sortField} onValueChange={(v) => onSortFieldChange(v as SortField)}>
          <SelectTrigger className="w-[110px] h-9 bg-card/10 backdrop-blur-sm border-white/20 text-white text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1 flex-shrink-0" />
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_debut" className="text-xs">
              Date début
            </SelectItem>
            <SelectItem value="echeance" className="text-xs">
              Échéance
            </SelectItem>
            <SelectItem value="titre" className="text-xs">
              Titre
            </SelectItem>
            <SelectItem value="priorite" className="text-xs">
              Priorité
            </SelectItem>
            <SelectItem value="statut" className="text-xs">
              Statut
            </SelectItem>
            <SelectItem value="responsable" className="text-xs">
              Responsable
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20 rounded-lg p-0"
          onClick={onSortDirectionToggle}
          title={sortDirection === 'asc' ? 'Croissant' : 'Décroissant'}
        >
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Button
        size="sm"
        className="h-9 bg-card text-primary hover:bg-card/90 shadow-md"
        onClick={onCreateTask}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Tâche</span>
      </Button>
    </div>
  )
}
