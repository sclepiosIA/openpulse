import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'

interface VirtualListProps<T> {
  items: T[]
  height: number
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
  dynamicHeight?: boolean
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className,
  overscan = 5,
  dynamicHeight = false
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
    measureElement: dynamicHeight ? (element) => {
      return element.getBoundingClientRect().height
    } : undefined,
  })

  // Recalculate when items change or dynamic mode toggles
  useLayoutEffect(() => {
    if (dynamicHeight) {
      virtualizer.measure()
    }
  }, [items.length, dynamicHeight, virtualizer])

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ height }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            ref={dynamicHeight ? virtualizer.measureElement : undefined}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: dynamicHeight ? undefined : virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
              paddingBottom: '8px',
              boxSizing: 'border-box',
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Hook pour la virtualisation avec pagination infinie
export function useVirtualInfiniteList<T>({
  items,
  height,
  itemHeight,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  overscan = 10
}: {
  items: T[]
  height: number
  itemHeight: number
  hasNextPage?: boolean
  fetchNextPage?: () => void
  isFetchingNextPage?: boolean
  overscan?: number
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: hasNextPage ? items.length + 1 : items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Loader item is taller
      return index === items.length ? itemHeight * 1.5 : itemHeight
    },
    overscan,
  })

  // Trigger fetch when user scrolls near the end
  const virtualItems = virtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]

  if (
    lastItem &&
    lastItem.index >= items.length - 1 &&
    hasNextPage &&
    !isFetchingNextPage
  ) {
    fetchNextPage?.()
  }

  return {
    parentRef,
    virtualizer,
    virtualItems,
  }
}