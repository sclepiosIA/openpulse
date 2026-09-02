import { useCallback, useMemo } from "react";
import { useEmailThreadActions } from "@/hooks/email/useEmailThreadActions";
import type { EmailThread } from "@/types/email";

interface UseEmailListPanelActionHandlersArgs {
  setThreads: React.Dispatch<React.SetStateAction<EmailThread[]>>;
  setSelectedThreads: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export interface EmailListPanelActionHandlers {
  onToggleRead: (threadId: string, isUnread: boolean) => void;
  onToggleStar: (threadId: string, isStarred: boolean) => void;
  onToggleProcessed: (threadId: string, isProcessed: boolean) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onMarkAsSpam: (threadId: string) => void;
  onUpdateTags: (threadId: string, tags: string[]) => void;
}

/**
 * Hook compagnon de `useEmailInboxActionHandlers` (mobile), dédié à `EmailListPanel`
 * (desktop) — gère `toggleStar` (priority high) en plus, et utilise des handlers
 * de toggle qui prennent l'état courant (`isUnread`/`isStarred`/`isProcessed`).
 *
 * Extrait en session 94 pour réduire la duplication ~60 % avec EmailInbox.
 */
export function useEmailListPanelActionHandlers({
  setThreads,
  setSelectedThreads,
}: UseEmailListPanelActionHandlersArgs): {
  actionHandlers: EmailListPanelActionHandlers;
  optimisticUpdateThread: (threadId: string, patch: Partial<EmailThread>) => void;
  optimisticRemoveThread: (threadId: string) => void;
} {
  const {
    markAsRead,
    toggleStar,
    markAsProcessed,
    archiveThread,
    deleteThread,
    markAsSpam,
    updateTags,
  } = useEmailThreadActions();

  const optimisticUpdateThread = useCallback(
    (threadId: string, patch: Partial<EmailThread>) => {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, ...patch } : t)));
    },
    [setThreads],
  );

  const optimisticRemoveThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setSelectedThreads((prev) => {
        const next = new Set(prev);
        next.delete(threadId);
        return next;
      });
    },
    [setThreads, setSelectedThreads],
  );

  const actionHandlers = useMemo<EmailListPanelActionHandlers>(
    () => ({
      onToggleRead: (threadId, isUnread) => {
        optimisticUpdateThread(threadId, { unread_count: isUnread ? 0 : 1 });
        markAsRead({ threadId, read: isUnread });
      },
      onToggleStar: (threadId, isStarred) => {
        const nextStarred = !isStarred;
        optimisticUpdateThread(threadId, { priority: nextStarred ? "high" : null });
        toggleStar({ threadId, starred: nextStarred });
      },
      onToggleProcessed: (threadId, isProcessed) => {
        const nextProcessed = !isProcessed;
        optimisticUpdateThread(threadId, {
          is_processed: nextProcessed,
          ...(nextProcessed ? { unread_count: 0 } : {}),
        });
        markAsProcessed({ threadId, processed: nextProcessed });
      },
      onArchive: (threadId) => {
        optimisticRemoveThread(threadId);
        archiveThread({ threadId, archived: true });
      },
      onDelete: (threadId) => {
        optimisticRemoveThread(threadId);
        deleteThread({ threadId });
      },
      onMarkAsSpam: (threadId) => {
        optimisticRemoveThread(threadId);
        markAsSpam({ threadId, isSpam: true });
      },
      onUpdateTags: (threadId, tags) => {
        optimisticUpdateThread(threadId, { tags });
        updateTags({ threadId, tags });
      },
    }),
    [
      markAsRead,
      toggleStar,
      markAsProcessed,
      archiveThread,
      deleteThread,
      markAsSpam,
      updateTags,
      optimisticUpdateThread,
      optimisticRemoveThread,
    ],
  );

  return { actionHandlers, optimisticUpdateThread, optimisticRemoveThread };
}
