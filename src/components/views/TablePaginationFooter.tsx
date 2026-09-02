import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { PageSizeOption } from '@/hooks/views/useTablePagination'

interface Props {
  page: number
  pageCount: number
  pageSize: PageSizeOption
  pageSizeOptions: PageSizeOption[]
  from: number
  to: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: PageSizeOption) => void
  /** Hide controls (used when grouping is active, since pages would break groups) */
  disabled?: boolean
}

export function TablePaginationFooter({
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
  from,
  to,
  total,
  onPageChange,
  onPageSizeChange,
  disabled,
}: Props) {
  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-2 py-1.5 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>
          {from.toLocaleString('fr-FR')}–{to.toLocaleString('fr-FR')} sur{' '}
          {total.toLocaleString('fr-FR')}
        </span>
        <span className="hidden sm:inline">·</span>
        <div className="hidden sm:flex items-center gap-1.5">
          <span>Lignes&nbsp;:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) =>
              onPageSizeChange(v === 'all' ? 'all' : (Number(v) as PageSizeOption))
            }
          >
            <SelectTrigger className="h-7 w-[78px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={String(opt)} value={String(opt)} className="text-xs">
                  {opt === 'all' ? 'Toutes' : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!disabled && pageSize !== 'all' && pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            aria-label="Première page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-1.5 tabular-nums text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(pageCount)}
            disabled={page >= pageCount}
            aria-label="Dernière page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
