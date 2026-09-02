import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  ArchiveRestore,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Brain,
  AlertOctagon,
  Keyboard,
  FolderPlus,
} from 'lucide-react'
import { sanitizeEmailSubject } from '@/lib/emailUtils'
import type { ThreadData } from './EmailThread.types'
import { MoveToFolderDialog } from './folders/MoveToFolderDialog'

interface EmailThreadStickyHeaderProps {
  thread: ThreadData
  sanitizedMessagesCount: number
  currentMessageIndex: number
  threadId: string
  processing: boolean
  isArchiving: boolean
  onBack: () => void
  onPreviousMessage: () => void
  onNextMessage: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onArchiveToggle: () => void
  onProcessAI: () => void
  onMarkSpam: () => void
  onShowShortcuts: () => void
}

export function EmailThreadStickyHeader({
  thread,
  sanitizedMessagesCount,
  currentMessageIndex,
  threadId,
  processing,
  isArchiving,
  onBack,
  onPreviousMessage,
  onNextMessage,
  onExpandAll,
  onCollapseAll,
  onReply,
  onReplyAll,
  onForward,
  onArchiveToggle,
  onProcessAI,
  onMarkSpam,
  onShowShortcuts,
}: EmailThreadStickyHeaderProps) {
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  return (
    <div
      className={cn(
        'sticky top-0 z-40 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 border-b',
        '-mx-4 md:-mx-6 px-4 md:px-6'
      )}
    >
      <div className="py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Back + Breadcrumb + Subject */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="flex-shrink-0 h-8 w-8 rounded-lg bg-card/50 hover:bg-card/80 text-foreground border border-transparent hover:border-slate-200/50"
              aria-label="Retour"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                <span>Messagerie</span>
                <span>/</span>
                <span>Conversation</span>
              </div>
              <h2 className="font-semibold truncate text-sm">
                {sanitizeEmailSubject((thread as any).ai_generated_title || thread.subject)}
              </h2>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {sanitizedMessagesCount > 1 && (
              <>
                <div className="hidden sm:flex items-center gap-1 mr-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg bg-slate-50/80 hover:bg-slate-100 text-foreground border border-transparent hover:border-slate-200/50"
                    onClick={onPreviousMessage}
                    disabled={currentMessageIndex === 0}
                    title="Message précédent"
                    aria-label="Précédent"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                    {currentMessageIndex + 1}/{sanitizedMessagesCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg bg-slate-50/80 hover:bg-slate-100 text-foreground border border-transparent hover:border-slate-200/50"
                    onClick={onNextMessage}
                    disabled={currentMessageIndex === sanitizedMessagesCount - 1}
                    title="Message suivant"
                    aria-label="Suivant"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100 text-foreground border border-transparent hover:border-slate-200/50"
              onClick={onExpandAll}
              title="Tout déplier (e)"
              aria-label="Replier"
            >
              <ChevronsDownUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100 text-foreground border border-transparent hover:border-slate-200/50"
              onClick={onCollapseAll}
              title="Tout replier (c)"
              aria-label="Déplier"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-5" />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10"
              onClick={onReply}
              title="Répondre (r)"
              aria-label="Répondre"
            >
              <Reply className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10"
              onClick={onReplyAll}
              title="Répondre à tous (R)"
              aria-label="Répondre à tous"
            >
              <ReplyAll className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10"
              onClick={onForward}
              title="Transférer (f)"
              aria-label="Transférer"
            >
              <Forward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg',
                thread.is_archived
                  ? 'bg-amber-100/80 text-amber-700 border border-amber-200/50'
                  : 'bg-slate-50/80 hover:bg-slate-100 text-foreground border border-transparent hover:border-slate-200/50'
              )}
              onClick={onArchiveToggle}
              disabled={isArchiving}
              title={thread.is_archived ? 'Restaurer (a)' : 'Archiver (a)'}
              aria-label={
                thread.is_archived
                  ? 'Restaurer le fil de discussion'
                  : 'Archiver le fil de discussion'
              }
            >
              {thread.is_archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100 text-foreground border border-transparent hover:border-slate-200/50"
                  aria-label="Plus d'options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFolderDialogOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Ranger dans un dossier…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onProcessAI} disabled={processing}>
                  <Brain className="mr-2 h-4 w-4" />
                  Réanalyser avec l'IA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onMarkSpam}>
                  <AlertOctagon className="mr-2 h-4 w-4" />
                  {thread.is_spam ? 'Retirer du spam' : 'Marquer comme spam'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onShowShortcuts}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  Raccourcis clavier
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <MoveToFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        threadIds={[threadId]}
      />
    </div>
  )
}
