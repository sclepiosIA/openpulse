import { useState, useCallback, useRef, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { EmailListPanel } from './EmailListPanel'
import { EmailDetailPanel } from './EmailDetailPanel'
const EmailComposer = lazy(() =>
  import('./EmailComposer').then((m) => ({ default: m.EmailComposer }))
)
import { EmailThreadPreviewOverlay } from './EmailThreadPreviewOverlay'
import { useEmailNavigation } from '@/hooks/email/useEmailNavigation'
import type { EmailThread } from '@/types/email'
import { toast } from 'sonner'

interface EmailMasterDetailProps {
  accountId: string
  onSyncNow?: () => void
  onFullSync?: () => void
  isSyncing?: boolean
  lastSyncAt?: string | null
}

const PANEL_SIZES_KEY = 'email-panel-sizes'
const DEFAULT_LEFT_SIZE = 35
const HOVER_OPEN_DELAY = 200
const HOVER_CLOSE_DELAY = 150

export function EmailMasterDetail({
  accountId,
  onSyncNow,
  onFullSync,
  isSyncing = false,
  lastSyncAt,
}: EmailMasterDetailProps) {
  const [leftPanelSize, setLeftPanelSize] = useState(() => {
    const saved = localStorage.getItem(PANEL_SIZES_KEY)
    if (saved) {
      try {
        return JSON.parse(saved).left || DEFAULT_LEFT_SIZE
      } catch {
        return DEFAULT_LEFT_SIZE
      }
    }
    return DEFAULT_LEFT_SIZE
  })

  // Hover preview state
  const [hoveredThread, setHoveredThread] = useState<EmailThread | null>(null)
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    selectedThread,
    composing,
    draftToEdit,
    selectThread,
    closeThread,
    startComposing,
    editDraft,
    goBack,
  } = useEmailNavigation()

  // Persist panel size
  const handlePanelResize = useCallback((sizes: number[]) => {
    const newLeftSize = sizes[0]
    setLeftPanelSize(newLeftSize)
    localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify({ left: newLeftSize }))
  }, [])

  const handleThreadSelect = useCallback(
    (threadId: string, subject?: string) => {
      // Clear hover preview when selecting a thread
      setHoveredThread(null)
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
      selectThread(threadId, subject)
    },
    [selectThread]
  )

  const handleComposeNew = useCallback(() => {
    startComposing()
  }, [startComposing])

  const handleComposerCancel = useCallback(() => {
    goBack()
  }, [goBack])

  const handleComposerSent = useCallback(() => {
    goBack()
    toast.success('Email envoyé avec succès')
  }, [goBack])

  // Handle thread hover with delays to prevent flickering
  const handleThreadHover = useCallback((thread: EmailThread | null) => {
    // Clear any pending timeouts
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current)
      openTimeoutRef.current = null
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    if (thread) {
      // Delay opening
      openTimeoutRef.current = setTimeout(() => {
        setHoveredThread(thread)
      }, HOVER_OPEN_DELAY)
    } else {
      // Delay closing
      closeTimeoutRef.current = setTimeout(() => {
        setHoveredThread(null)
      }, HOVER_CLOSE_DELAY)
    }
  }, [])

  const handleClosePreview = useCallback(() => {
    setHoveredThread(null)
    if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current)
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
  }, [])

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full min-h-0 flex-1 rounded-lg border"
      onLayout={handlePanelResize}
    >
      {/* Left Panel: Email List */}
      <ResizablePanel
        id="emails-list-panel"
        order={1}
        defaultSize={leftPanelSize}
        minSize={25}
        maxSize={50}
        className="bg-background relative"
      >
        <EmailListPanel
          accountId={accountId}
          selectedThreadId={selectedThread}
          onThreadSelect={handleThreadSelect}
          onComposeNew={handleComposeNew}
          onSyncNow={onSyncNow}
          isSyncing={isSyncing}
          lastSyncAt={lastSyncAt}
          onThreadHover={handleThreadHover}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Panel: Thread Detail or Composer */}
      <ResizablePanel
        id="emails-detail-panel"
        order={2}
        defaultSize={100 - leftPanelSize}
        minSize={40}
        className="bg-background relative"
      >
        {/* Hover Preview Overlay - à gauche du panneau de détail */}
        <EmailThreadPreviewOverlay
          thread={hoveredThread}
          onClose={handleClosePreview}
          onMouseEnterOverlay={() => {
            // Cancel close timeout when mouse enters overlay
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current)
              closeTimeoutRef.current = null
            }
          }}
        />

        {composing ? (
          <div className="h-full overflow-auto p-4">
            <Suspense
              fallback={<div className="p-4 text-sm text-muted-foreground">Chargement…</div>}
            >
              <EmailComposer
                accountId={accountId}
                onCancel={handleComposerCancel}
                onSent={handleComposerSent}
                initialDraft={draftToEdit || undefined}
              />
            </Suspense>
          </div>
        ) : (
          <EmailDetailPanel threadId={selectedThread} onComposeNew={handleComposeNew} />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
