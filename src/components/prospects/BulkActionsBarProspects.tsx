import { X, Download, Trash2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export const PROSPECT_STATUSES = [
  'Prospect',
  'Contacté',
  'Attente RDV',
  'RDV pris',
  'Attente post RDV',
  'Dans les RDV',
  'Etude émise',
  'Dans les RDV post EME',
  'Négociation',
  'Contractualisation',
] as const

interface BulkActionsBarProspectsProps {
  selectedCount: number
  onClearSelection: () => void
  onExport: () => void
  onChangeStatus?: (status: string) => void
  onDelete?: () => void
  className?: string
}

export function BulkActionsBarProspects({
  selectedCount,
  onClearSelection,
  onExport,
  onChangeStatus,
  onDelete,
  className,
}: BulkActionsBarProspectsProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label="Actions sur la sélection"
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-3",
        "bg-background border rounded-xl shadow-lg",
        "animate-in slide-in-from-bottom-4 fade-in",
        className,
      )}
    >
      <span className="text-sm font-medium">
        {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
      </span>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport} aria-label="Exporter la sélection en CSV">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>

        {onChangeStatus && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Changer le statut">
                <Tag className="h-4 w-4 mr-2" />
                Changer statut
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="max-h-72 overflow-y-auto">
              {PROSPECT_STATUSES.map((status) => (
                <DropdownMenuItem key={status} onClick={() => onChangeStatus(status)}>
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            aria-label="Supprimer la sélection"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        )}
      </div>

      <div className="h-4 w-px bg-border" />

      <Button variant="ghost" size="sm" onClick={onClearSelection} aria-label="Désélectionner tout">
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
