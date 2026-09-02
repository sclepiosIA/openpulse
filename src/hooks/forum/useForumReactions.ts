import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ReactionCounts {
  [emoji: string]: number;
}

export function useReactionCounts(targetId: string, targetType: 'post' | 'comment') {
  return useQuery({
    queryKey: ['forum-reactions', targetId, targetType],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_reaction_counts', {
          target_id: targetId,
          target_type: targetType,
        });

      if (error) throw error;
      return (data || {}) as ReactionCounts;
    },
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      targetId, 
      targetType, 
      emoji, 
      userId 
    }: { 
      targetId: string; 
      targetType: 'post' | 'comment'; 
      emoji: string;
      userId: string;
    }) => {
      const column = targetType === 'post' ? 'post_id' : 'comment_id';
      
      // Vérifier si la réaction existe déjà
      const { data: existing } = await supabase
        .from('forum_reactions')
        .select('id')
        .eq(column, targetId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        // Supprimer la réaction
        const { error } = await supabase
          .from('forum_reactions')
          .delete()
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Ajouter la réaction
        const { error } = await supabase
          .from('forum_reactions')
          .insert({
            [column]: targetId,
            user_id: userId,
            emoji,
          } as never);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['forum-reactions', variables.targetId, variables.targetType] 
      });
    },
  });
}
