import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BulkAction {
  id: string
  label: string
  icon?: ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'ghost'
  onClick: () => void
  disabled?: boolean
}

interface CRMBulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  actions: BulkAction[]
  isLoading?: boolean
  className?: string
  /** Custom content to render instead of default actions */
  children?: ReactNode
}

export function CRMBulkActionsBar({
  selectedCount,
  onClearSelection,
  actions,
  isLoading = false,
  className,
  children
}: CRMBulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "animate-in slide-in-from-bottom-10 duration-300",
      className
    )}>
      <div className="bg-primary text-primary-foreground rounded-full shadow-lg px-6 py-3 flex items-center gap-4">
        {/* Counter */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="h-6 w-px bg-primary-foreground/20" />

        {/* Actions */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-primary-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Traitement...</span>
          </div>
        ) : children ? (
          children
        ) : (
          <div className="flex items-center gap-2">
            {actions.map(action => (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "text-primary-foreground hover:bg-primary-foreground/10",
                  action.variant === 'destructive' && "text-destructive hover:bg-destructive/10"
                )}
              >
                {action.icon}
                <span className="ml-2">{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        <div className="h-6 w-px bg-primary-foreground/20" />

        {/* Close */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-primary-foreground hover:bg-primary-foreground/10"
          disabled={isLoading}
          aria-label="Effacer la sélection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
