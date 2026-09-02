import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";

interface ForumComment {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  user_id: string;
  contenu: string;
  upvotes: number;
  created_at: string;
  updated_at: string;
  replies?: ForumComment[];
}

// Fonction pour organiser les commentaires en arbre
function buildCommentTree(comments: ForumComment[]): ForumComment[] {
  const commentMap = new Map<string, ForumComment>();
  const rootComments: ForumComment[] = [];

  // Première passe : créer une map de tous les commentaires
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Deuxième passe : construire l'arbre
  comments.forEach(comment => {
    const node = commentMap.get(comment.id);
    if (!node) return;
    
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent && parent.replies) {
        parent.replies.push(node);
      } else {
        rootComments.push(node);
      }
    } else {
      rootComments.push(node);
    }
  });

  return rootComments;
}

export function useForumComments(postId: string) {
  return useQuery({
    queryKey: ['forum-comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_comments')
        .select(`
          *,
          etablissement_users (
            id,
            nom,
            prenom,
            fonction,
            service,
            etablissements (nom)
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Organiser les commentaires en arbre
      return buildCommentTree((data || []) as ForumComment[]);
    },
    enabled: !!postId,
  });
}

export function useCreateForumComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comment: { 
      post_id: string; 
      user_id: string | null; 
      contenu: string;
      parent_comment_id?: string;
      author_nom?: string;
      author_prenom?: string;
      author_role?: string;
    }) => {
      const { data, error } = await supabase
        .from('forum_comments')
        .insert([{
          ...comment,
          upvotes: 0,
        }])
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      
      // Incrémenter le compteur de commentaires
      if (comment.post_id) {
        await supabase.rpc('increment_comment_count', { post_id: comment.post_id });
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', variables.post_id] });
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
    },
  });
}

export function useVoteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      // Vérifier localStorage pour éviter double vote
      const votedComments = JSON.parse(localStorage.getItem('voted_comments') || '[]');
      if (votedComments.includes(commentId)) {
        throw new Error('Vous avez déjà voté pour ce commentaire');
      }

      // Vérifier d'abord si un vote existe déjà
      const { data: existingVote } = await supabase
        .from('forum_votes')
        .select('id')
        .eq('comment_id', commentId)
        .is('user_id', null)
        .maybeSingle();

      if (existingVote) {
        // Supprimer le vote
        const { error } = await supabase
          .from('forum_votes')
          .delete()
          .eq('id', existingVote.id);

        if (error) throw error;

        // Retirer du localStorage
        const updatedVotes = votedComments.filter((id: string) => id !== commentId);
        localStorage.setItem('voted_comments', JSON.stringify(updatedVotes));
        
        return { action: 'removed', commentId };
      } else {
        // Ajouter le vote
        const { error } = await supabase
          .from('forum_votes')
          .insert({ comment_id: commentId, user_id: null });

        if (error) throw error;

        // Sauvegarder dans localStorage
        localStorage.setItem('voted_comments', JSON.stringify([...votedComments, commentId]));
        
        return { action: 'added', commentId };
      }
    },
    onMutate: async ({ commentId }) => {
      // Optimistic update
      const postId = await getPostIdFromComment(commentId);
      if (!postId) return;

      await queryClient.cancelQueries({ queryKey: ['forum-comments', postId] });
      const previousComments = queryClient.getQueryData(['forum-comments', postId]);

      queryClient.setQueryData(['forum-comments', postId], (old: ForumComment[] | undefined) => {
        if (!old) return old;
        return updateCommentVotes(old, commentId, 1);
      });

      return { previousComments, postId };
    },
    onError: (err, variables, context) => {
      if (context?.previousComments && context.postId) {
        queryClient.setQueryData(['forum-comments', context.postId], context.previousComments);
      }
      toast.error("Erreur lors du vote");
    },
    onSuccess: () => {
      toast.success("Vote enregistré !");
    },
    onSettled: (_, __, ___, context) => {
      if (context?.postId) {
        queryClient.invalidateQueries({ queryKey: ['forum-comments', context.postId] });
      }
    },
  });
}

// Fonction helper pour récupérer le post_id d'un commentaire
async function getPostIdFromComment(commentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('forum_comments')
    .select('post_id')
    .eq('id', commentId)
    .maybeSingle();

  if (error || !data) return null;
  return data.post_id;
}

// Fonction helper pour mettre à jour les votes dans l'arbre de commentaires
function updateCommentVotes(comments: ForumComment[], commentId: string, change: number): ForumComment[] {
  return comments.map(comment => {
    if (comment.id === commentId) {
      return { ...comment, upvotes: (comment.upvotes || 0) + change };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentVotes(comment.replies, commentId, change),
      };
    }
    return comment;
  });
}
