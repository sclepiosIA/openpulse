import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Type pour le commentaire avec relation forum_posts */
interface ForumCommentWithPost {
  id: string;
  upvotes: number | null;
  created_at: string;
  forum_posts: { titre: string } | null;
}

export function useUserForumActivity(userId: string) {
  return useQuery({
    queryKey: ["user-forum-activity", userId],
    queryFn: async () => {
      // Récupérer les posts de l'utilisateur
      const { data: posts, error: postsError } = await supabase
        .from("forum_posts")
        .select("id, titre, theme, upvotes, nombre_commentaires, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Récupérer les commentaires de l'utilisateur avec le titre du post associé
      const { data: comments, error: commentsError } = await supabase
        .from("forum_comments")
        .select(`
          id,
          upvotes,
          created_at,
          forum_posts!inner(titre)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (commentsError) throw commentsError;

      // Formater les commentaires pour avoir post_titre
      const formattedComments = (comments || []).map((comment) => {
        const typedComment = comment as unknown as ForumCommentWithPost;
        return {
          id: typedComment.id,
          post_titre: typedComment.forum_posts?.titre || "Post supprimé",
          upvotes: typedComment.upvotes || 0,
          created_at: typedComment.created_at,
        };
      });

      return {
        posts: posts || [],
        comments: formattedComments,
        totalUpvotes: (posts || []).reduce((sum, p) => sum + (p.upvotes || 0), 0) +
                      formattedComments.reduce((sum, c) => sum + c.upvotes, 0),
      };
    },
  });
}
