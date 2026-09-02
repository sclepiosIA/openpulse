import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecordSidePeekProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  /** Click → navigate to full record page. */
  onOpenFull?: () => void
  openFullLabel?: string
  /** Tailwind width class. Defaults to a comfortable readable width. */
  widthClassName?: string
  children?: ReactNode
}

/**
 * Generic right-side preview panel (Sheet) for entity records.
 * Twenty-CRM-style "side peek" — preserve list context while exploring details.
 */
export function RecordSidePeek({
  open,
  onClose,
  title,
  subtitle,
  onOpenFull,
  openFullLabel = 'Ouvrir la fiche',
  widthClassName,
  children,
}: RecordSidePeekProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 flex flex-col gap-0',
          'w-full sm:max-w-xl md:max-w-2xl',
          widthClassName,
        )}
      >
        <SheetHeader className="px-5 py-4 border-b shrink-0 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-tight truncate">{title}</SheetTitle>
              {subtitle && (
                <SheetDescription className="text-xs mt-1 truncate">{subtitle}</SheetDescription>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onOpenFull && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenFull}
                  className="h-8 gap-1.5 mr-8"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{openFullLabel}</span>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
