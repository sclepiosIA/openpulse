import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface CRMToolbarProps {
  /** Left side content (usually search) */
  searchSlot?: ReactNode
  /** Unified filters component (combines quick + smart filters) - NEW */
  unifiedFilters?: ReactNode
  /** View selector component */
  viewSelector?: ReactNode
  /** Sort menu component */
  sortMenu?: ReactNode
  /** Quick filters component (legacy - prefer unifiedFilters) */
  quickFilters?: ReactNode
  /** Smart filters component (legacy - prefer unifiedFilters) */
  smartFilters?: ReactNode
  /** Advanced filters trigger */
  advancedFilters?: ReactNode
  /** Export button (legacy - prefer moreActions) */
  exportButton?: ReactNode
  /** More actions dropdown */
  moreActions?: ReactNode
  /** Additional actions (legacy - prefer moreActions) */
  extraActions?: ReactNode
  /** Additional className */
  className?: string
}

export function CRMToolbar({
  searchSlot,
  unifiedFilters,
  viewSelector,
  sortMenu,
  quickFilters,
  smartFilters,
  advancedFilters,
  exportButton,
  moreActions,
  extraActions,
  className
}: CRMToolbarProps) {
  // Si on utilise le nouveau unifiedFilters, afficher en mode compact
  if (unifiedFilters) {
    return (
      <div className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-3", className)}>
        {/* Search - Left */}
        {searchSlot && (
          <div className="w-full sm:w-auto sm:min-w-[200px] sm:max-w-[280px]">
            {searchSlot}
          </div>
        )}
        
        {/* Unified Filters - Center/Flexible */}
        <div className="flex-1 flex justify-start sm:justify-center">
          {unifiedFilters}
        </div>
        
        {/* Right side controls - compact with proper spacing */}
        <div className="flex items-center gap-2 ml-auto">
          {viewSelector}
          {sortMenu}
          {advancedFilters}
          {moreActions}
        </div>
      </div>
    )
  }

  // Mode legacy avec quickFilters/smartFilters séparés
  return (
    <div className={cn("space-y-3", className)}>
      {/* Row 1: Search + View Selector + Sort + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        {searchSlot && (
          <div className="flex-1 min-w-[200px] sm:min-w-[280px] max-w-md">
            {searchSlot}
          </div>
        )}
        
        {/* Right side controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewSelector}
          
          {viewSelector && sortMenu && (
            <div className="hidden sm:block h-6 w-px bg-border" />
          )}
          
          {sortMenu}
          
          {(viewSelector || sortMenu) && (advancedFilters || exportButton) && (
            <div className="hidden sm:block h-6 w-px bg-border" />
          )}
          
          {advancedFilters}
          {exportButton}
          {extraActions}
          {moreActions}
        </div>
      </div>

      {/* Row 2: Quick Filters + Smart Filters */}
      {(quickFilters || smartFilters) && (
        <div className="flex flex-wrap items-center gap-3">
          {quickFilters}
          
          {quickFilters && smartFilters && (
            <div className="hidden sm:block h-6 w-px bg-border" />
          )}
          
          {smartFilters}
        </div>
      )}
    </div>
  )
}
