import { supabase } from '@/integrations/supabase/client';

/**
 * Incrémente le compteur de vues d'un post forum (RPC côté DB).
 * Service extrait dans le cadre du plan de découplage Supabase (audit Fable 5 · action 180.1).
 */
export const incrementForumPostView = async (postId: string): Promise<void> => {
  if (!postId) return;
  await supabase.rpc('increment_view_count', { post_id: postId });
};
