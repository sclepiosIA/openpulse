import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FolderPlus } from 'lucide-react'
import { VirtualizedThreadList } from './VirtualizedThreadList'
import { MobileEmailListItem } from './MobileEmailListItem'
import { PullToRefresh } from '@/components/mobile/PullToRefresh'
import { MoveToFolderDialog } from './folders/MoveToFolderDialog'
import { updateThreadPriority } from '@/services/email/emailThreadMutations'
import type { EmailThreadActionHandlers } from './EmailListItemModern'

interface EmailInboxListViewProps {
  isMobile: boolean
  threads: any[]
  selectedThreads: Set<string>
  setSelectedThreads: (s: Set<string>) => void
  newThreadIds: Set<string>
  enrichedData: Map<string, any> | undefined
  actionHandlers: EmailThreadActionHandlers
  multiSelectMode: boolean
  parentRef: React.RefObject<HTMLDivElement>
  onThreadSelect: (threadId: string, subject?: string) => void
  handleToggleReadThread: (threadId: string) => void
  handleArchiveThread: (threadId: string) => void
  handleDeleteThread: (threadId: string) => void
  handleEnterMultiSelect: (threadId: string) => void
  handleSelectAll: () => void
  handleRefreshPull: () => Promise<void>
  optimisticUpdateThread: (id: string, patch: any) => void
}

export function EmailInboxListView({
  isMobile,
  threads,
  selectedThreads,
  setSelectedThreads,
  newThreadIds,
  enrichedData,
  actionHandlers,
  multiSelectMode,
  parentRef,
  onThreadSelect,
  handleToggleReadThread,
  handleArchiveThread,
  handleDeleteThread,
  handleEnterMultiSelect,
  handleSelectAll,
  handleRefreshPull,
  optimisticUpdateThread,
}: EmailInboxListViewProps) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)

  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefreshPull}>
        <div className="divide-y">
          {threads.map((thread) => (
            <MobileEmailListItem
              key={thread.id}
              thread={thread}
              enrichedData={enrichedData?.get(thread.id)}
              selected={selectedThreads.has(thread.id)}
              isNew={newThreadIds.has(thread.id)}
              onSelect={
                multiSelectMode
                  ? (selected) => {
                      const newSelected = new Set(selectedThreads)
                      if (selected) newSelected.add(thread.id)
                      else newSelected.delete(thread.id)
                      setSelectedThreads(newSelected)
                    }
                  : undefined
              }
              onClick={() => onThreadSelect(thread.id, thread.subject)}
              onToggleRead={handleToggleReadThread}
              onArchive={handleArchiveThread}
              onDelete={handleDeleteThread}
              onEnterMultiSelect={handleEnterMultiSelect}
              onMarkAsProcessed={actionHandlers.onMarkAsProcessed}
              onMarkAsSpam={actionHandlers.onMarkAsSpam}
              onToggleStar={(threadId, isStarred) => {
                const newPriority = isStarred ? 'medium' : 'high'
                optimisticUpdateThread(threadId, { priority: newPriority })
                void updateThreadPriority(threadId, newPriority)
              }}
            />
          ))}
        </div>
      </PullToRefresh>
    )
  }

  return (
    <Card className="overflow-x-clip w-full max-w-full">
      <div className="border-b bg-muted/30 px-3 sm:px-4 py-2 flex items-center gap-3 w-full max-w-full min-w-0 overflow-x-hidden">
        <input
          type="checkbox"
          checked={selectedThreads.size > 0 && selectedThreads.size === threads.length}
          onChange={handleSelectAll}
          className="h-4 w-4 rounded border-input"
        />
        <span className="text-sm text-muted-foreground">
          {selectedThreads.size > 0
            ? `${selectedThreads.size} sélectionné${selectedThreads.size > 1 ? 's' : ''}`
            : 'Tout sélectionner'}
        </span>
        {selectedThreads.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7"
            onClick={() => setMoveDialogOpen(true)}
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
            Ranger dans un dossier
          </Button>
        )}
      </div>

      <MoveToFolderDialog
        open={moveDialogOpen}
        onOpenChange={(o) => {
          setMoveDialogOpen(o)
          if (!o) setSelectedThreads(new Set())
        }}
        threadIds={Array.from(selectedThreads)}
      />

      <div
        ref={parentRef}
        className="w-full max-w-full min-w-0 overflow-x-clip overflow-y-auto"
        style={{ height: 'calc(100vh - var(--header-height) - var(--toolbar-height))' }}
      >
        <VirtualizedThreadList
          threads={threads}
          parentRef={parentRef}
          selectedThreads={selectedThreads}
          newThreadIds={newThreadIds}
          enrichedData={enrichedData}
          actionHandlers={actionHandlers}
          onSelect={(threadId: string, selected: boolean) => {
            const newSelected = new Set(selectedThreads)
            if (selected) newSelected.add(threadId)
            else newSelected.delete(threadId)
            setSelectedThreads(newSelected)
          }}
          onThreadSelect={onThreadSelect}
        />
      </div>
    </Card>
  )
}
