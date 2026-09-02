import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { X, Download, Trash2, Edit, Tag, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  onExport: () => void
  onDelete: () => void
  onChangeStatut: () => void
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onExport,
  onDelete,
  onChangeStatut,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
      <div
        className={cn(
          'flex items-center gap-4 px-6 py-3 rounded-2xl shadow-2xl',
          'bg-gradient-to-r from-primary via-primary to-primary/90',
          'border border-primary-foreground/10 backdrop-blur-sm',
          'ring-4 ring-primary/20'
        )}
      >
        {/* Selection count with icon */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <CheckCircle2 className="h-5 w-5 text-primary-foreground/80" />
            <div className="absolute inset-0 bg-primary-foreground/20 rounded-full blur-md animate-pulse" />
          </div>
          <Badge
            variant="secondary"
            className="text-sm font-semibold bg-primary-foreground/20 text-primary-foreground border-0 rounded-lg px-3"
          >
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gradient-to-b from-transparent via-primary-foreground/30 to-transparent" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            className={cn(
              'h-9 px-3 rounded-xl text-primary-foreground/90',
              'hover:bg-primary-foreground/15 hover:text-primary-foreground',
              'transition-all duration-200'
            )}
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-9 px-3 rounded-xl text-primary-foreground/90',
                  'hover:bg-primary-foreground/15 hover:text-primary-foreground',
                  'transition-all duration-200'
                )}
              >
                <Edit className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl border-primary/10 shadow-xl bg-card/95 backdrop-blur-md">
              <DropdownMenuItem onClick={onChangeStatut} className="rounded-lg cursor-pointer">
                <Tag className="h-4 w-4 mr-2 text-primary" />
                Changer le statut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className={cn(
              'h-9 px-3 rounded-xl',
              'text-red-200 hover:bg-red-500/20 hover:text-red-100',
              'transition-all duration-200'
            )}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gradient-to-b from-transparent via-primary-foreground/30 to-transparent" />

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          aria-label="Annuler la sélection"
          title="Annuler la sélection"
          className={cn(
            'h-9 w-9 p-0 rounded-xl text-primary-foreground/70',
            'hover:bg-primary-foreground/15 hover:text-primary-foreground',
            'transition-all duration-200'
          )}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
