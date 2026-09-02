import { memo, useCallback } from 'react'
import { Document, Page } from 'react-pdf'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PDFThumbnailsProps {
  fileUrl: string
  numPages: number
  currentPage: number
  onPageClick: (page: number) => void
  className?: string
}

const ThumbnailPage = memo(
  ({
    pageNumber,
    isActive,
    onClick,
  }: {
    pageNumber: number
    isActive: boolean
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors w-full',
        'hover:bg-muted/80',
        isActive && 'bg-primary/10 ring-2 ring-primary'
      )}
    >
      <div className="relative bg-card rounded shadow-sm overflow-hidden">
        <Page
          pageNumber={pageNumber}
          width={80}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={
            <div className="w-20 h-28 flex items-center justify-center bg-muted">
              <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          }
        />
      </div>
      <span
        className={cn('text-xs', isActive ? 'text-primary font-medium' : 'text-muted-foreground')}
      >
        {pageNumber}
      </span>
    </button>
  )
)

ThumbnailPage.displayName = 'ThumbnailPage'

export function PDFThumbnails({
  fileUrl,
  numPages,
  currentPage,
  onPageClick,
  className,
}: PDFThumbnailsProps) {
  const handlePageClick = useCallback(
    (page: number) => {
      onPageClick(page)
    },
    [onPageClick]
  )

  return (
    <div className={cn('w-[120px] border-r bg-muted/30 flex-shrink-0', className)}>
      <div className="p-2 border-b bg-background">
        <h3 className="text-xs font-medium text-muted-foreground text-center">Pages</h3>
      </div>
      <ScrollArea className="h-[calc(100%-37px)]">
        <div className="p-2 space-y-2">
          <Document file={fileUrl} loading={null} error={null}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <ThumbnailPage
                key={pageNum}
                pageNumber={pageNum}
                isActive={pageNum === currentPage}
                onClick={() => handlePageClick(pageNum)}
              />
            ))}
          </Document>
        </div>
      </ScrollArea>
    </div>
  )
}
