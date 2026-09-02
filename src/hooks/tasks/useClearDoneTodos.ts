import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { personalTodoKeys } from './usePersonalTodos';
import { unifiedTodoKeys } from './useUnifiedTodos';
import { debug } from '@/lib/debug';
import { useAuth } from "@/components/AuthProvider";

/**
 * Hook to clear all completed (done) personal todos for the current user
 */
export function useClearDoneTodos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get current user profile
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      // Delete all completed todos
      const { error, count } = await supabase
        .from('personal_todos')
        .delete()
        .eq('user_id', profile.id)
        .eq('is_done', true);

      if (error) throw error;
      return count || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: personalTodoKeys.all });
      queryClient.invalidateQueries({ queryKey: unifiedTodoKeys.all });
      queryClient.invalidateQueries({ queryKey: ['todos-unread-count'] });
      toast.success(`${count} tâche${count !== 1 ? 's' : ''} terminée${count !== 1 ? 's' : ''} supprimée${count !== 1 ? 's' : ''}`);
    },
    onError: (error) => {
      debug.error('Error clearing done todos:', error);
      toast.error('Erreur lors de la suppression');
    },
  });
}
