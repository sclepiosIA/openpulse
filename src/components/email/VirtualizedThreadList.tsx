import { useVirtualizer } from '@tanstack/react-virtual'
import { EmailListItemModern, type EmailThreadActionHandlers } from './EmailListItemModern'
import type { ThreadEnrichedData } from '@/hooks/email/useThreadsEnrichedData'

interface VirtualizedThreadListProps {
  threads: any[]
  parentRef: React.RefObject<HTMLDivElement>
  selectedThreads: Set<string>
  newThreadIds: Set<string>
  enrichedData?: Map<string, ThreadEnrichedData>
  actionHandlers?: EmailThreadActionHandlers
  onSelect: (threadId: string, selected: boolean) => void
  onThreadSelect: (threadId: string, subject?: string) => void
}

export function VirtualizedThreadList({
  threads,
  parentRef,
  selectedThreads,
  newThreadIds,
  enrichedData,
  actionHandlers,
  onSelect,
  onThreadSelect,
}: VirtualizedThreadListProps) {
  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Hauteur fixe synchronisée avec h-[72px] dans EmailListItemModern
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualItem) => {
        const thread = threads[virtualItem.index]
        const enriched = enrichedData?.get(thread.id)
        const isSelected = selectedThreads.has(thread.id)
        const contextIds =
          isSelected && selectedThreads.size > 1 ? Array.from(selectedThreads) : [thread.id]

        return (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <EmailListItemModern
              thread={thread}
              selected={isSelected}
              isNew={newThreadIds.has(thread.id)}
              enrichedData={enriched}
              actionHandlers={actionHandlers}
              contextThreadIds={contextIds}
              onSelect={(selected) => onSelect(thread.id, selected)}
              onClick={() => onThreadSelect(thread.id, thread.subject)}
            />
          </div>
        )
      })}
    </div>
  )
}
