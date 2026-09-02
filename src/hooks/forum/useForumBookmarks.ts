import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEtablissementUser } from "../crm/useEtablissementUser";
import { toast } from "sonner";
import { debug } from '@/lib/debug';

export function useForumBookmarks() {
  const { etablissementUser } = useEtablissementUser();

  return useQuery({
    queryKey: ["forum-bookmarks", etablissementUser?.id],
    queryFn: async () => {
      if (!etablissementUser) return [];

      const { data, error } = await supabase
        .from("forum_bookmarks")
        .select("post_id")
        .eq("user_id", etablissementUser.id);

      if (error) throw error;
      return data.map(b => b.post_id);
    },
    enabled: !!etablissementUser,
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();
  const { etablissementUser } = useEtablissementUser();

  return useMutation({
    mutationFn: async ({ postId, isBookmarked }: { postId: string; isBookmarked: boolean }) => {
      if (!etablissementUser) throw new Error("User not authenticated");

      if (isBookmarked) {
        // Supprimer le favori
        const { error } = await supabase
          .from("forum_bookmarks")
          .delete()
          .eq("user_id", etablissementUser.id)
          .eq("post_id", postId);

        if (error) throw error;
      } else {
        // Ajouter le favori
        const { error } = await supabase
          .from("forum_bookmarks")
          .insert({
            user_id: etablissementUser.id,
            post_id: postId,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, { isBookmarked }) => {
      queryClient.invalidateQueries({ queryKey: ["forum-bookmarks"] });
      toast.success(isBookmarked ? "Retiré des favoris" : "Ajouté aux favoris");
    },
    onError: (error) => {
      debug.error("Error toggling bookmark:", error);
      toast.error("Erreur lors de la mise à jour des favoris");
    },
  });
}

export function useForumUserStats(userId?: string) {
  return useQuery({
    queryKey: ["forum-user-stats", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("forum_user_stats")
        .select("id, user_id, posts_count, comments_count, total_upvotes_received, reputation_score, badges, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useTopContributors(limit = 5) {
  return useQuery({
    queryKey: ["forum-top-contributors", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forum_user_stats")
        .select(`
          *,
          etablissement_users!inner(
            nom,
            prenom,
            fonction,
            etablissement:etablissements!inner(nom)
          )
        `)
        .order("reputation_score", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}
