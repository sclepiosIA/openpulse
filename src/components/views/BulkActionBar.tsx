import { Button } from '@/components/ui/button'
import { X, Download, Loader2, UserCog } from 'lucide-react'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState } from 'react'

export interface BulkActionOption {
  value: string
  label: string
}

export interface BulkOwnerField {
  /** Field key to update on each row (e.g. 'commercial_id'). */
  key: string
  /** Display label (e.g. 'Commercial'). */
  label: string
}

export interface BulkOwnerProfile {
  id: string
  label: string
}

interface BulkActionBarProps {
  count: number
  onClear: () => void
  onExportCsv?: () => void
  statusOptions?: BulkActionOption[]
  onApplyStatus?: (status: string) => Promise<void> | void
  /** Owner assignment: list of fields (commercial, CSM…) and profile list. */
  ownerFields?: BulkOwnerField[]
  ownerProfiles?: BulkOwnerProfile[]
  onAssignOwner?: (fieldKey: string, profileId: string | null) => Promise<void> | void
  extraActions?: React.ReactNode
}


/**
 * Sticky bottom bar shown when rows are selected.
 * Inspired by Twenty CRM bulk actions.
 */
export function BulkActionBar({
  count,
  onClear,
  onExportCsv,
  statusOptions,
  onApplyStatus,
  ownerFields,
  ownerProfiles,
  onAssignOwner,
  extraActions,
}: BulkActionBarProps) {
  const [applying, setApplying] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  if (count === 0) return null

  const handleApply = async (value: string) => {
    if (!onApplyStatus) return
    setPendingStatus(value)
    setApplying(true)
    try {
      await onApplyStatus(value)
    } finally {
      setApplying(false)
      setPendingStatus('')
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border bg-background shadow-lg px-3 py-2 animate-in fade-in-0 slide-in-from-bottom-2">
      <span className="text-sm font-medium px-2">
        {count} sélectionné{count > 1 ? 's' : ''}
      </span>
      <div className="h-5 w-px bg-border" />
      {statusOptions && onApplyStatus && (
        <Select value={pendingStatus} onValueChange={handleApply} disabled={applying}>
          <SelectTrigger className="h-8 w-[180px]" aria-label="Changer le statut">
            {applying ? (
              <span className="flex items-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Application…
              </span>
            ) : (
              <SelectValue placeholder="Changer le statut" />
            )}
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {ownerFields && ownerFields.length > 0 && onAssignOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8" disabled={assigning}>
              {assigning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <UserCog className="h-3.5 w-3.5 mr-1.5" />
              )}
              Assigner
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover">
            <DropdownMenuLabel>Assigner à…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ownerFields.map((f) => (
              <DropdownMenuSub key={f.key}>
                <DropdownMenuSubTrigger>{f.label}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto bg-popover">
                  <DropdownMenuItem
                    onClick={async () => {
                      setAssigning(true)
                      try {
                        await onAssignOwner(f.key, null)
                      } finally {
                        setAssigning(false)
                      }
                    }}
                    className="text-muted-foreground"
                  >
                    Aucun
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(ownerProfiles ?? []).map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={async () => {
                        setAssigning(true)
                        try {
                          await onAssignOwner(f.key, p.id)
                        } finally {
                          setAssigning(false)
                        }
                      }}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {onExportCsv && (
        <Button variant="outline" size="sm" onClick={onExportCsv} className="h-8">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Exporter CSV
        </Button>
      )}
      {extraActions}
      <div className="h-5 w-px bg-border" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-8 px-2"
        aria-label="Effacer la sélection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
