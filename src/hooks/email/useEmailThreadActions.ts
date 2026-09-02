import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

// Types minimaux pour les caches React Query (optimistic updates).
interface CachedThread {
  id: string;
  is_read?: boolean;
  is_processed?: boolean;
  is_starred?: boolean;
  is_archived?: boolean;
  is_deleted?: boolean;
  unread_count?: number;
  [key: string]: unknown;
}
interface ThreadPage {
  data: CachedThread[];
  total?: number;
  [key: string]: unknown;
}
interface InfinitePageCache {
  pages: ThreadPage[];
  pageParams?: unknown[];
  [key: string]: unknown;
}
interface ThreadsListCache {
  threads: CachedThread[];
  total?: number;
  [key: string]: unknown;
}

export function useEmailThreadActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const archiveThread = useMutation({
    mutationFn: async ({ threadId, archived }: { threadId: string; archived: boolean }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ is_archived: archived })
        .eq('id', threadId);

      if (error) throw error;
      return { threadId, archived };
    },
    onMutate: async ({ threadId, archived }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['email-threads-infinite'] });
      await queryClient.cancelQueries({ queryKey: ['email-threads'] });
      
      // Optimistic update pour liste infinie
      queryClient.setQueriesData(
        { queryKey: ['email-threads-infinite'] },
        (old: InfinitePageCache | undefined) => {
          if (!old?.pages) return old;
          if (archived) {
            return {
              ...old,
              pages: old.pages.map((page: ThreadPage) => ({
                ...page,
                data: page.data.filter((t: CachedThread) => t.id !== threadId),
                total: Math.max(0, (page.total || 0) - 1),
              })),
            };
          }
          return old;
        }
      );
      
      // Optimistic update pour widget dashboard
      queryClient.setQueriesData(
        { queryKey: ['email-threads'] },
        (old: ThreadsListCache | undefined) => {
          if (!old?.threads) return old;
          if (archived) {
            return {
              ...old,
              threads: old.threads.filter((t: CachedThread) => t.id !== threadId),
              total: Math.max(0, (old.total || 0) - 1),
            };
          }
          return old;
        }
      );
    },
    onSuccess: (_, { archived }) => {
      toast({
        title: archived ? "Conversation archivée" : "Conversation désarchivée",
        description: archived ? "La conversation a été déplacée vers les archives" : "La conversation est de nouveau visible",
      });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const markAsSpam = useMutation({
    mutationFn: async ({ threadId, isSpam }: { threadId: string; isSpam: boolean }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ is_spam: isSpam })
        .eq('id', threadId);

      if (error) throw error;
      return { threadId, isSpam };
    },
    onMutate: async ({ threadId, isSpam }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['email-threads-infinite'] });
      await queryClient.cancelQueries({ queryKey: ['email-threads'] });
      
      // Optimistic update pour liste infinie
      queryClient.setQueriesData(
        { queryKey: ['email-threads-infinite'] },
        (old: InfinitePageCache | undefined) => {
          if (!old?.pages) return old;
          if (isSpam) {
            return {
              ...old,
              pages: old.pages.map((page: ThreadPage) => ({
                ...page,
                data: page.data.filter((t: CachedThread) => t.id !== threadId),
                total: Math.max(0, (page.total || 0) - 1),
              })),
            };
          }
          return old;
        }
      );
      
      // Optimistic update pour widget dashboard
      queryClient.setQueriesData(
        { queryKey: ['email-threads'] },
        (old: ThreadsListCache | undefined) => {
          if (!old?.threads) return old;
          if (isSpam) {
            return {
              ...old,
              threads: old.threads.filter((t: CachedThread) => t.id !== threadId),
              total: Math.max(0, (old.total || 0) - 1),
            };
          }
          return old;
        }
      );
    },
    onSuccess: (_, { isSpam }) => {
      toast({
        title: isSpam ? "Marqué comme spam" : "Retiré des spams",
        description: isSpam ? "La conversation a été marquée comme spam" : "La conversation n'est plus considérée comme spam",
      });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const markAsProcessed = useMutation({
    mutationFn: async ({ threadId, processed, userId }: { threadId: string; processed: boolean; userId?: string }) => {
      let processedBy: string | null = null;
      if (processed && userId) {
        processedBy = userId;
      }
      
      const updateData: Record<string, unknown> = { 
        is_processed: processed,
        processed_at: processed ? new Date().toISOString() : null,
        processed_by: processedBy,
      };
      // Règle métier : traité → forcément lu
      if (processed) {
        updateData.unread_count = 0;
      }
      const { error } = await supabase
        .from('email_threads')
        .update(updateData as never)
        .eq('id', threadId);

      if (error) throw error;
      return { threadId, processed };
    },
    onMutate: async ({ threadId, processed }) => {
      await queryClient.cancelQueries({ queryKey: ['email-threads-infinite'] });
      
      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: ['email-threads-infinite'] },
        (old: InfinitePageCache | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: ThreadPage) => ({
              ...page,
              data: page.data.map((t: CachedThread) => 
                t.id === threadId ? { ...t, is_processed: processed, ...(processed ? { unread_count: 0 } : {}) } : t
              ),
            })),
          };
        }
      );
    },
    onSuccess: (_, { processed }) => {
      toast({
        title: processed ? "Marqué comme traité" : "Marqué comme non traité",
        description: processed ? "Cette conversation est maintenant traitée" : "Cette conversation est de nouveau à traiter",
      });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async ({ threadId, read }: { threadId: string; read: boolean }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ unread_count: read ? 0 : 1 })
        .eq('id', threadId);

      if (error) throw error;

      // Also update individual messages for consistency
      if (read) {
        await supabase
          .from('email_messages')
          .update({ is_read: true })
          .eq('thread_id', threadId)
          .eq('is_read', false);
      }

      return { threadId, read };
    },
    onMutate: async ({ threadId, read }) => {
      await queryClient.cancelQueries({ queryKey: ['email-threads-infinite'] });
      
      queryClient.setQueriesData(
        { queryKey: ['email-threads-infinite'] },
        (old: InfinitePageCache | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: ThreadPage) => ({
              ...page,
              data: page.data.map((t: CachedThread) => 
                t.id === threadId ? { ...t, unread_count: read ? 0 : 1 } : t
              ),
            })),
          };
        }
      );
    },
    onSuccess: (_, { threadId, read }) => {
      toast({
        title: read ? "Marqué comme lu" : "Marqué comme non lu",
      });
      // Invalidate unread count + badge — thread list is already updated optimistically
      queryClient.invalidateQueries({ queryKey: ['email-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
      // No more dispatchEvent('email-thread-updated') here — it caused cascade refreshes
      // that re-fetched the thread list and reset the selection
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const updateTags = useMutation({
    mutationFn: async ({ threadId, tags }: { threadId: string; tags: string[] }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ tags })
        .eq('id', threadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Tags mis à jour",
        description: "Les tags ont été modifiés avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ is_deleted: true })
        .eq('id', threadId);

      if (error) throw error;
      return { threadId };
    },
    onMutate: async ({ threadId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['email-threads-infinite'] });
      await queryClient.cancelQueries({ queryKey: ['email-threads'] });
      
      // Optimistic update: remove thread from infinite list immediately
      queryClient.setQueriesData(
        { queryKey: ['email-threads-infinite'] },
        (old: InfinitePageCache | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: ThreadPage) => ({
              ...page,
              data: page.data.filter((t: CachedThread) => t.id !== threadId),
              total: Math.max(0, (page.total || 0) - 1),
            })),
          };
        }
      );
      
      // Optimistic update: remove thread from widget dashboard immediately
      queryClient.setQueriesData(
        { queryKey: ['email-threads'] },
        (old: ThreadsListCache | undefined) => {
          if (!old?.threads) return old;
          return {
            ...old,
            threads: old.threads.filter((t: CachedThread) => t.id !== threadId),
            total: Math.max(0, (old.total || 0) - 1),
          };
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Conversation supprimée",
      });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const forwardEmail = useMutation({
    mutationFn: async ({ 
      messageId, 
      toAddresses, 
      additionalContent 
    }: { 
      messageId: string; 
      toAddresses: string[]; 
      additionalContent?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('forward-email', {
        body: { 
          message_id: messageId, 
          to_addresses: toAddresses,
          additional_content: additionalContent 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Email transféré",
        description: "L'email a été transféré avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de transfert",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ threadId, starred }: { threadId: string; starred: boolean }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ priority: starred ? 'high' : null })
        .eq('id', threadId);

      if (error) throw error;
      return { threadId, starred };
    },
    onMutate: async ({ threadId, starred }) => {
      await queryClient.cancelQueries({ queryKey: ['email-threads-infinite'] });
      
      queryClient.setQueriesData(
        { queryKey: ['email-threads-infinite'] },
        (old: InfinitePageCache | undefined) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: ThreadPage) => ({
              ...page,
              data: page.data.map((t: CachedThread) => 
                t.id === threadId ? { ...t, priority: starred ? 'high' : null } : t
              ),
            })),
          };
        }
      );
    },
    onSuccess: (_, { starred }) => {
      toast({
        title: starred ? "Ajouté aux favoris" : "Retiré des favoris",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  return {
    archiveThread: archiveThread.mutate,
    isArchiving: archiveThread.isPending,
    markAsSpam: markAsSpam.mutate,
    isMarkingSpam: markAsSpam.isPending,
    markAsProcessed: markAsProcessed.mutate,
    isMarkingProcessed: markAsProcessed.isPending,
    markAsRead: markAsRead.mutate,
    isMarkingRead: markAsRead.isPending,
    updateTags: updateTags.mutate,
    isUpdatingTags: updateTags.isPending,
    deleteThread: deleteThread.mutate,
    isDeleting: deleteThread.isPending,
    forwardEmail: forwardEmail.mutate,
    isForwarding: forwardEmail.isPending,
    toggleStar: toggleStar.mutate,
    isTogglingStar: toggleStar.isPending,
  };
}
