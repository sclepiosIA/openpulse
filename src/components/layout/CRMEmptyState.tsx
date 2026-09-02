import { ReactNode } from "react"
import { LucideIcon, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CRMEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** Whether active filters are applied */
  hasFilters?: boolean
  /** Callback to reset filters */
  onResetFilters?: () => void
  /** Callback to create new item */
  onCreate?: () => void
  /** Label for create button */
  createLabel?: string
  /** Additional class name */
  className?: string
  /** Variant style */
  variant?: 'default' | 'compact' | 'inline'
  /** Custom action slot */
  children?: ReactNode
}

export function CRMEmptyState({
  icon: Icon,
  title,
  description,
  hasFilters,
  onResetFilters,
  onCreate,
  createLabel = "Créer",
  className,
  variant = 'default',
  children
}: CRMEmptyStateProps) {
  const isCompact = variant === 'compact'
  const isInline = variant === 'inline'

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      isInline ? "py-6 px-4" : isCompact ? "py-8 px-4" : "py-12 px-4",
      !isInline && "border rounded-lg bg-card",
      className
    )}>
      <div className={cn(
        "rounded-full bg-muted/50 flex items-center justify-center mb-4",
        isCompact ? "h-12 w-12" : "h-16 w-16"
      )}>
        <Icon className={cn(
          "text-muted-foreground",
          isCompact ? "h-6 w-6" : "h-8 w-8"
        )} />
      </div>
      
      <h3 className={cn(
        "font-semibold mb-2",
        isCompact ? "text-base" : "text-lg"
      )}>
        {title}
      </h3>
      <p className={cn(
        "text-muted-foreground max-w-sm",
        isCompact ? "text-xs mb-4" : "text-sm mb-6"
      )}>
        {description}
      </p>
      
      {children}

      {!children && (
        <div className="flex items-center gap-3">
          {hasFilters && onResetFilters && (
            <Button 
              variant="outline" 
              onClick={onResetFilters}
              size={isCompact ? "sm" : "default"}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser les filtres
            </Button>
          )}
          
          {!hasFilters && onCreate && (
            <Button 
              onClick={onCreate}
              size={isCompact ? "sm" : "default"}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
