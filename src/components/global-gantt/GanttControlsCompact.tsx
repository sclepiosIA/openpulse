import { ZoomIn, ArrowUpDown, Layers } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year'
type GroupByOption = 'etablissement' | 'categorie' | 'responsable' | 'statut'
type SortField = 'date_debut' | 'echeance' | 'titre' | 'priorite' | 'statut' | 'responsable'

interface GanttControlsCompactProps {
  zoomLevel: ZoomLevel
  onZoomChange: (zoom: ZoomLevel) => void
  groupBy: GroupByOption
  onGroupByChange: (group: GroupByOption) => void
  sortField: SortField
  onSortFieldChange: (field: SortField) => void
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Sem.' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trim.' },
]

const GROUP_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: 'etablissement', label: 'Étab.' },
  { value: 'categorie', label: 'Cat.' },
  { value: 'responsable', label: 'Resp.' },
  { value: 'statut', label: 'Statut' },
]

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date_debut', label: 'Début' },
  { value: 'echeance', label: 'Échéance' },
  { value: 'priorite', label: 'Priorité' },
  { value: 'statut', label: 'Statut' },
]

export function GanttControlsCompact({
  zoomLevel,
  onZoomChange,
  groupBy,
  onGroupByChange,
  sortField,
  onSortFieldChange,
}: GanttControlsCompactProps) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Zoom selector */}
      <Select value={zoomLevel} onValueChange={(v) => onZoomChange(v as ZoomLevel)}>
        <SelectTrigger className="w-[70px] h-6 px-2 text-xs bg-card/10 backdrop-blur-sm border-white/20 text-white rounded-lg">
          <ZoomIn className="h-3 w-3 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ZOOM_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-4 w-px bg-card/20" />

      {/* Group by selector */}
      <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupByOption)}>
        <SelectTrigger className="w-[70px] h-6 px-2 text-xs bg-card/10 backdrop-blur-sm border-white/20 text-white rounded-lg">
          <Layers className="h-3 w-3 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUP_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort selector */}
      <Select value={sortField} onValueChange={(v) => onSortFieldChange(v as SortField)}>
        <SelectTrigger className="w-[80px] h-6 px-2 text-xs bg-card/10 backdrop-blur-sm border-white/20 text-white rounded-lg">
          <ArrowUpDown className="h-3 w-3 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
