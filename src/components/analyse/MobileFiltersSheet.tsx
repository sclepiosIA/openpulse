import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Filter, SlidersHorizontal } from 'lucide-react'
import { GeographicFilters } from './GeographicFilters'
import { GeographicFilters as GeoFiltersType } from '@/hooks/geography/useGeographicFilters'
import { cn } from '@/lib/utils'

interface MobileFiltersSheetProps {
  onFiltersChange: (filters: GeoFiltersType) => void
  activeCount: number
}

export function MobileFiltersSheet({ onFiltersChange, activeCount }: MobileFiltersSheetProps) {
  const [open, setOpen] = useState(false)

  const handleFiltersChange = (filters: GeoFiltersType) => {
    onFiltersChange(filters)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className={cn(
            'lg:hidden fixed bottom-20 right-4 z-50 shadow-xl gap-2 h-12 px-4 rounded-full',
            'bg-primary hover:bg-primary/90',
            activeCount > 0 && 'animate-pulse'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-medium">Filtres</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs font-bold bg-card text-primary ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] sm:w-[380px] p-0 overflow-hidden">
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <SheetTitle className="text-base font-semibold">Filtres avancés</SheetTitle>
            {activeCount > 0 && (
              <Badge className="text-xs bg-primary text-primary-foreground">{activeCount}</Badge>
            )}
          </div>
        </SheetHeader>
        <div className="h-[calc(100vh-80px)] overflow-auto p-4">
          <GeographicFilters onFiltersChange={handleFiltersChange} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
