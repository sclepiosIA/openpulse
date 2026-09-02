/**
 * Extrait des handlers bulk de `EmailInbox.tsx` (session 100).
 * Regroupe les 5 actions multi-sélection + l'archivage d'un thread unique
 * (toutes basées sur le même pattern optimistic + UPDATE + rollback via fetchThreads).
 */
import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type FetchFn = (mode?: boolean | "incremental") => void | Promise<unknown>;
type HandleError = (error: unknown, context: string) => void;

interface Params {
  user: User | null;
  queryClient: QueryClient;
  selectedThreads: Set<string>;
  setSelectedThreads: (s: Set<string>) => void;
  setThreads: React.Dispatch<React.SetStateAction<any[]>>;
  optimisticRemoveThread: (threadId: string) => void;
  fetchThreads: FetchFn;
  handleError: HandleError;
}

export function useEmailBulkActionHandlers({
  user,
  queryClient,
  selectedThreads,
  setSelectedThreads,
  setThreads,
  optimisticRemoveThread,
  fetchThreads,
  handleError,
}: Params) {
  const handleArchiveSelected = useCallback(async () => {
    if (selectedThreads.size === 0) return;
    const ids = Array.from(selectedThreads);
    setThreads(prev => prev.filter(t => !selectedThreads.has(t.id)));
    setSelectedThreads(new Set());
    try {
      const { error } = await supabase
        .from("email_threads")
        .update({ is_archived: true })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} email(s) archivé(s)`);
    } catch (error) {
      handleError(error, "EmailInbox.handleArchiveSelected");
      fetchThreads(true);
    }
  }, [selectedThreads, setSelectedThreads, setThreads, fetchThreads, handleError]);

  const handleArchiveThread = useCallback(async (threadId: string) => {
    optimisticRemoveThread(threadId);
    try {
      const { error } = await supabase
        .from("email_threads")
        .update({ is_archived: true })
        .eq("id", threadId);
      if (error) throw error;
      toast.success("Email archivé");
    } catch (error) {
      handleError(error, "EmailInbox.handleArchiveThread");
      fetchThreads(true);
    }
  }, [optimisticRemoveThread, fetchThreads, handleError]);

  const handleMarkAsSpamSelected = useCallback(async () => {
    if (selectedThreads.size === 0) return;
    const ids = Array.from(selectedThreads);
    setThreads(prev => prev.filter(t => !selectedThreads.has(t.id)));
    setSelectedThreads(new Set());
    try {
      const { error } = await supabase
        .from("email_threads")
        .update({ is_spam: true })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} email(s) marqué(s) comme spam`);
    } catch (error) {
      handleError(error, "EmailInbox.handleMarkAsSpamSelected");
      fetchThreads(true);
    }
  }, [selectedThreads, setSelectedThreads, setThreads, fetchThreads, handleError]);

  const handleMarkAsReadSelected = useCallback(async () => {
    if (selectedThreads.size === 0) return;
    const threadIds = Array.from(selectedThreads);
    setThreads(prev => prev.map(t => selectedThreads.has(t.id) ? { ...t, unread_count: 0 } : t));
    setSelectedThreads(new Set());
    try {
      const { error } = await supabase
        .from("email_threads")
        .update({ unread_count: 0 })
        .in("id", threadIds);
      if (error) throw error;

      await supabase
        .from("email_messages")
        .update({ is_read: true })
        .in("thread_id", threadIds)
        .eq("is_read", false);

      toast.success(`${threadIds.length} email(s) marqué(s) comme lu(s)`);
      queryClient.invalidateQueries({ queryKey: ["email-counts"] });
    } catch (error) {
      handleError(error, "EmailInbox.handleMarkAsReadSelected");
      fetchThreads(true);
    }
  }, [selectedThreads, setSelectedThreads, setThreads, queryClient, fetchThreads, handleError]);

  const handleMarkAsProcessedSelected = useCallback(async () => {
    if (selectedThreads.size === 0) return;
    const threadIds = Array.from(selectedThreads);
    setThreads(prev => prev.map(t => selectedThreads.has(t.id) ? { ...t, is_processed: true, unread_count: 0 } : t));
    setSelectedThreads(new Set());
    try {
      let processedBy: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        processedBy = profile?.id || null;
      }

      const { error } = await supabase
        .from("email_threads")
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
          processed_by: processedBy,
          unread_count: 0,
        })
        .in("id", threadIds);
      if (error) throw error;

      await supabase
        .from("email_messages")
        .update({ is_read: true })
        .in("thread_id", threadIds)
        .eq("is_read", false);

      toast.success(`${threadIds.length} email(s) marqué(s) comme traité(s)`);
      queryClient.invalidateQueries({ queryKey: ["email-counts"] });
    } catch (error) {
      handleError(error, "EmailInbox.handleMarkAsProcessedSelected");
      fetchThreads(true);
    }
  }, [user, selectedThreads, setSelectedThreads, setThreads, queryClient, fetchThreads, handleError]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedThreads.size === 0) return;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedThreads.size} email(s) ? Cette action peut être annulée depuis la corbeille.`)) {
      return;
    }
    const ids = Array.from(selectedThreads);
    setThreads(prev => prev.filter(t => !selectedThreads.has(t.id)));
    setSelectedThreads(new Set());
    try {
      const { error } = await supabase
        .from("email_threads")
        .update({ is_deleted: true })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} email(s) supprimé(s)`);
    } catch (error) {
      handleError(error, "EmailInbox.handleDeleteSelected");
      fetchThreads(true);
    }
  }, [selectedThreads, setSelectedThreads, setThreads, fetchThreads, handleError]);

  const handleDeleteThread = useCallback(async (threadId: string) => {
    optimisticRemoveThread(threadId);
    try {
      const { error } = await supabase
        .from("email_threads")
        .update({ is_deleted: true })
        .eq("id", threadId);
      if (error) throw error;
      toast.success("Email supprimé");
    } catch (error) {
      handleError(error, "EmailInbox.handleDeleteThread");
      fetchThreads(true);
    }
  }, [optimisticRemoveThread, fetchThreads, handleError]);

  return {
    handleArchiveSelected,
    handleArchiveThread,
    handleMarkAsSpamSelected,
    handleMarkAsReadSelected,
    handleMarkAsProcessedSelected,
    handleDeleteSelected,
    handleDeleteThread,
  };
}
