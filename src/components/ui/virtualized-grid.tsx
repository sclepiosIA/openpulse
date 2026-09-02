/**
 * VirtualizedGrid - Virtual scroll grid component for long lists
 * Uses @tanstack/react-virtual for performant rendering of large datasets
 */

import { useRef, ReactNode, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

interface VirtualizedGridProps<T> {
  /** Items to render */
  items: T[]
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode
  /** Number of columns */
  columns?: number
  /** Estimated height of each row in pixels */
  estimatedRowHeight?: number
  /** Gap between items in pixels */
  gap?: number
  /** Additional className for the container */
  className?: string
  /** Minimum items threshold to enable virtualization (default: 50) */
  virtualizationThreshold?: number
  /** Optional key extractor */
  getItemKey?: (item: T, index: number) => string | number
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  columns = 3,
  estimatedRowHeight = 280,
  gap = 16,
  className,
  virtualizationThreshold = 50,
  getItemKey,
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Calculate rows from items
  const rows = useMemo(() => {
    const result: T[][] = []
    for (let i = 0; i < items.length; i += columns) {
      result.push(items.slice(i, i + columns))
    }
    return result
  }, [items, columns])

  // Only virtualize if we have many items
  const shouldVirtualize = items.length >= virtualizationThreshold

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight + gap,
    overscan: 3,
  })

  // Simple grid for small datasets
  if (!shouldVirtualize) {
    return (
      <div
        className={cn(
          'grid gap-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 md:grid-cols-2',
          columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          className
        )}
        style={{ gap }}
      >
        {items.map((item, index) => (
          <div key={getItemKey?.(item, index) ?? index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    )
  }

  // Virtualized grid for large datasets
  return (
    <div
      ref={parentRef}
      className={cn('w-full overflow-auto h-full max-h-[calc(100vh-300px)]', className)}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowItems = rows[virtualRow.index]
          const startIndex = virtualRow.index * columns

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className={cn(
                  'grid w-full',
                  columns === 1 && 'grid-cols-1',
                  columns === 2 && 'grid-cols-1 md:grid-cols-2',
                  columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                  columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                )}
                style={{ gap }}
              >
                {rowItems.map((item, colIndex) => (
                  <div key={getItemKey?.(item, startIndex + colIndex) ?? startIndex + colIndex}>
                    {renderItem(item, startIndex + colIndex)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
