import { useCallback } from "react";
import { useEmailThreadActions } from "@/hooks/email/useEmailThreadActions";
import type { EmailThreadActionHandlers } from "../EmailListItemModern";

interface UseEmailInboxActionHandlersArgs {
  setThreads: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedThreads: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * Encapsule les handlers d'action sur les threads avec mise à jour optimiste
 * de la liste locale `threads` (et nettoyage de la sélection en cas de suppression).
 *
 * Extrait de `EmailInbox.tsx` (session 91) pour réduire la taille du fichier
 * et faciliter le test des comportements optimistes.
 */
export function useEmailInboxActionHandlers({
  setThreads,
  setSelectedThreads,
}: UseEmailInboxActionHandlersArgs): {
  actionHandlers: EmailThreadActionHandlers;
  optimisticUpdateThread: (threadId: string, patch: Record<string, unknown>) => void;
  optimisticRemoveThread: (threadId: string) => void;
} {
  const {
    markAsProcessed,
    markAsRead,
    markAsSpam,
    updateTags,
    archiveThread,
    deleteThread,
  } = useEmailThreadActions();

  const optimisticUpdateThread = useCallback(
    (threadId: string, patch: Record<string, unknown>) => {
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

  const actionHandlers: EmailThreadActionHandlers = {
    onMarkAsProcessed: useCallback(
      (threadId: string, processed: boolean) => {
        optimisticUpdateThread(threadId, {
          is_processed: processed,
          ...(processed ? { unread_count: 0 } : {}),
        });
        markAsProcessed({ threadId, processed });
      },
      [markAsProcessed, optimisticUpdateThread],
    ),
    onMarkAsRead: useCallback(
      (threadId: string, read: boolean) => {
        optimisticUpdateThread(threadId, { unread_count: read ? 0 : 1 });
        markAsRead({ threadId, read });
      },
      [markAsRead, optimisticUpdateThread],
    ),
    onMarkAsSpam: useCallback(
      (threadId: string) => {
        optimisticRemoveThread(threadId);
        markAsSpam({ threadId, isSpam: true });
      },
      [markAsSpam, optimisticRemoveThread],
    ),
    onUpdateTags: useCallback(
      (threadId: string, tags: string[]) => {
        optimisticUpdateThread(threadId, { tags });
        updateTags({ threadId, tags });
      },
      [updateTags, optimisticUpdateThread],
    ),
    onArchive: useCallback(
      (threadId: string) => {
        optimisticRemoveThread(threadId);
        archiveThread({ threadId, archived: true });
      },
      [archiveThread, optimisticRemoveThread],
    ),
    onDeleteThread: useCallback(
      (threadId: string) => {
        optimisticRemoveThread(threadId);
        deleteThread({ threadId });
      },
      [deleteThread, optimisticRemoveThread],
    ),
  };

  return { actionHandlers, optimisticUpdateThread, optimisticRemoveThread };
}
