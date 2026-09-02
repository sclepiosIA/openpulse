import { Button } from '@/components/ui/button'
import {
  Reply,
  ReplyAll,
  Archive,
  ArchiveRestore,
  AlertOctagon,
  Keyboard,
  MoreVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EmailThread } from '@/types/email'

interface EmailThreadActionsProps {
  thread: EmailThread
  onReply: () => void
  onReplyAll: () => void
  onArchive: () => void
  onMarkSpam: () => void
  onShowShortcuts: () => void
  isArchiving: boolean
  isMarkingSpam: boolean
}

export function EmailThreadActions({
  thread,
  onReply,
  onReplyAll,
  onArchive,
  onMarkSpam,
  onShowShortcuts,
  isArchiving,
  isMarkingSpam,
}: EmailThreadActionsProps) {
  return (
    <>
      {/* Version desktop - Glassmorphism buttons */}
      <div className="hidden sm:flex flex-wrap gap-2">
        <Button
          onClick={onReply}
          size="sm"
          className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md rounded-xl font-medium"
        >
          <Reply className="h-4 w-4" />
          Répondre
        </Button>
        <Button
          onClick={onReplyAll}
          variant="ghost"
          size="sm"
          className="h-9 gap-2 bg-slate-100/80 hover:bg-slate-200/80 text-foreground border border-slate-200/50 rounded-xl backdrop-blur-sm"
        >
          <ReplyAll className="h-4 w-4" />
          Répondre à tous
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 bg-card/50 hover:bg-card/80 text-foreground border border-slate-200/50 rounded-xl backdrop-blur-sm"
            >
              <MoreVertical className="h-4 w-4" />
              Plus
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onClick={onArchive} disabled={isArchiving}>
              {thread.is_archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Désarchiver
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkSpam} disabled={isMarkingSpam}>
              <AlertOctagon className="h-4 w-4 mr-2" />
              {thread.is_spam ? 'Retirer du spam' : 'Marquer comme spam'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShowShortcuts}>
              <Keyboard className="h-4 w-4 mr-2" />
              Raccourcis clavier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Version mobile - Modern rounded buttons */}
      <div className="flex sm:hidden gap-2">
        <Button
          onClick={onReply}
          size="sm"
          className="flex-1 h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md rounded-xl font-medium"
        >
          <Reply className="h-4 w-4" />
          Répondre
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 bg-slate-100/80 hover:bg-slate-200/80 rounded-xl border border-slate-200/50"
              aria-label="Plus d'options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onClick={onReplyAll}>
              <ReplyAll className="h-4 w-4 mr-2" />
              Répondre à tous
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} disabled={isArchiving}>
              {thread.is_archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Désarchiver
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkSpam} disabled={isMarkingSpam}>
              <AlertOctagon className="h-4 w-4 mr-2" />
              {thread.is_spam ? 'Retirer du spam' : 'Marquer spam'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
