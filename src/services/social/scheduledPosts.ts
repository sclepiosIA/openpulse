import { supabase } from '@/integrations/supabase/client';

/**
 * Supprime un post social planifié.
 * Service extrait dans le cadre du plan de découplage Supabase (audit Fable 5 · action 180.1).
 */
export const deleteScheduledPost = async (id: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from('social_scheduled_posts')
    .delete()
    .eq('id', id);
  if (error) throw error;
};
