import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useErrorHandler } from '../shared/useErrorHandler';
import { debug } from '@/lib/debug';

/**
 * Hook pour les actions sur les emails (archive, spam, delete, etc.)
 * Centralise la logique des actions avec gestion d'erreur unifiée
 */
export function useEmailActions() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();

  const archiveThread = useCallback(async (threadId: string) => {
    try {
      debug.log('📦 Archiving thread:', threadId);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Email archivé');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de l\'archivage de l\'email');
    }
  }, [queryClient, handleError]);

  const unarchiveThread = useCallback(async (threadId: string) => {
    try {
      debug.log('📤 Unarchiving thread:', threadId);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ is_archived: false, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Email restauré');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la restauration de l\'email');
    }
  }, [queryClient, handleError]);

  const markAsSpam = useCallback(async (threadId: string) => {
    try {
      debug.log('🚫 Marking thread as spam:', threadId);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ is_spam: true, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Email marqué comme spam');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors du marquage comme spam');
    }
  }, [queryClient, handleError]);

  const markAsNotSpam = useCallback(async (threadId: string) => {
    try {
      debug.log('✅ Marking thread as not spam:', threadId);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ is_spam: false, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Email restauré');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la restauration');
    }
  }, [queryClient, handleError]);

  const deleteThread = useCallback(async (threadId: string, permanent = false) => {
    try {
      debug.log('🗑️ Deleting thread:', threadId, 'permanent:', permanent);
      
      if (permanent) {
        // Suppression permanente
        const { error } = await supabase
          .from('email_threads')
          .delete()
          .eq('id', threadId);

        if (error) throw error;
        toast.success('Email supprimé définitivement');
      } else {
        // Soft delete
        const { error } = await supabase
          .from('email_threads')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('id', threadId);

        if (error) throw error;
        toast.success('Email supprimé');
      }

      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la suppression de l\'email');
    }
  }, [queryClient, handleError]);

  const restoreThread = useCallback(async (threadId: string) => {
    try {
      debug.log('♻️ Restoring thread:', threadId);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ 
          is_deleted: false, 
          is_archived: false,
          is_spam: false,
          updated_at: new Date().toISOString() 
        })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Email restauré');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la restauration de l\'email');
    }
  }, [queryClient, handleError]);

  const markAsRead = useCallback(async (threadId: string) => {
    try {
      debug.log('👁️ Marking thread as read:', threadId);
      
      // 1. Mettre à jour le thread
      const { error: threadError } = await supabase
        .from('email_threads')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (threadError) throw threadError;

      // 2. Mettre à jour tous les messages du thread comme lus
      const { error: messagesError } = await supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('is_read', false);

      if (messagesError) {
        debug.error('Failed to mark messages as read:', messagesError);
      }

      // 3. Invalider les caches (threads + badges)
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['email-counts'] });
    } catch (error) {
      handleError(error, 'Erreur lors du marquage comme lu');
    }
  }, [queryClient, handleError]);

  const markAsUnread = useCallback(async (threadId: string) => {
    try {
      debug.log('✉️ Marking thread as unread:', threadId);
      
      // Get message count first
      const { data: messages } = await supabase
        .from('email_messages')
        .select('id', { count: 'exact' })
        .eq('thread_id', threadId);

      // 1. Mettre à jour le thread
      const { error: threadError } = await supabase
        .from('email_threads')
        .update({ 
          unread_count: messages?.length || 1, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', threadId);

      if (threadError) throw threadError;

      // 2. Marquer tous les messages comme non lus
      const { error: messagesError } = await supabase
        .from('email_messages')
        .update({ is_read: false })
        .eq('thread_id', threadId);

      if (messagesError) {
        debug.error('Failed to mark messages as unread:', messagesError);
      }

      // 3. Invalider les deux caches
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-unread-count'] });
    } catch (error) {
      handleError(error, 'Erreur lors du marquage comme non lu');
    }
  }, [queryClient, handleError]);

  const updateCategory = useCallback(async (threadId: string, category: string | null) => {
    try {
      debug.log('🏷️ Updating thread category:', threadId, category);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ category, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Catégorie mise à jour');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la mise à jour de la catégorie');
    }
  }, [queryClient, handleError]);

  const updatePriority = useCallback(async (threadId: string, priority: 'high' | 'medium' | 'low' | null) => {
    try {
      debug.log('⚡ Updating thread priority:', threadId, priority);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Priorité mise à jour');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la mise à jour de la priorité');
    }
  }, [queryClient, handleError]);

  const addTag = useCallback(async (threadId: string, tag: string) => {
    try {
      debug.log('🏷️ Adding tag to thread:', threadId, tag);
      
      // Get current tags (thread may have been deleted in race)
      const { data: thread } = await supabase
        .from('email_threads')
        .select('tags')
        .eq('id', threadId)
        .maybeSingle();

      const currentTags = thread?.tags || [];
      if (currentTags.includes(tag)) {
        toast.info('Tag déjà présent');
        return;
      }

      const { error } = await supabase
        .from('email_threads')
        .update({ 
          tags: [...currentTags, tag],
          updated_at: new Date().toISOString() 
        })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Tag ajouté');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de l\'ajout du tag');
    }
  }, [queryClient, handleError]);

  const removeTag = useCallback(async (threadId: string, tag: string) => {
    try {
      debug.log('🗑️ Removing tag from thread:', threadId, tag);
      
      // Get current tags (thread may have been deleted in race)
      const { data: thread } = await supabase
        .from('email_threads')
        .select('tags')
        .eq('id', threadId)
        .maybeSingle();

      const currentTags = thread?.tags || [];
      const newTags = currentTags.filter((t: string) => t !== tag);

      const { error } = await supabase
        .from('email_threads')
        .update({ 
          tags: newTags,
          updated_at: new Date().toISOString() 
        })
        .eq('id', threadId);

      if (error) throw error;

      toast.success('Tag supprimé');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la suppression du tag');
    }
  }, [queryClient, handleError]);

  const bulkArchive = useCallback(async (threadIds: string[]) => {
    try {
      debug.log('📦 Bulk archiving threads:', threadIds);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .in('id', threadIds);

      if (error) throw error;

      toast.success(`${threadIds.length} emails archivés`);
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de l\'archivage multiple');
    }
  }, [queryClient, handleError]);

  const bulkDelete = useCallback(async (threadIds: string[]) => {
    try {
      debug.log('🗑️ Bulk deleting threads:', threadIds);
      
      const { error } = await supabase
        .from('email_threads')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', threadIds);

      if (error) throw error;

      toast.success(`${threadIds.length} emails supprimés`);
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    } catch (error) {
      handleError(error, 'Erreur lors de la suppression multiple');
    }
  }, [queryClient, handleError]);

  const bulkMarkAsRead = useCallback(async (threadIds: string[]) => {
    try {
      debug.log('👁️ Bulk marking threads as read:', threadIds);
      
      // 1. Mettre à jour les threads
      const { error: threadError } = await supabase
        .from('email_threads')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .in('id', threadIds);

      if (threadError) throw threadError;

      // 2. Marquer tous les messages de ces threads comme lus
      const { error: messagesError } = await supabase
        .from('email_messages')
        .update({ is_read: true })
        .in('thread_id', threadIds)
        .eq('is_read', false);

      if (messagesError) {
        debug.error('Failed to mark messages as read:', messagesError);
      }

      toast.success(`${threadIds.length} emails marqués comme lus`);
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-unread-count'] });
    } catch (error) {
      handleError(error, 'Erreur lors du marquage multiple comme lu');
    }
  }, [queryClient, handleError]);

  return {
    archiveThread,
    unarchiveThread,
    markAsSpam,
    markAsNotSpam,
    deleteThread,
    restoreThread,
    markAsRead,
    markAsUnread,
    updateCategory,
    updatePriority,
    addTag,
    removeTag,
    bulkArchive,
    bulkDelete,
    bulkMarkAsRead,
  };
}
