import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RDUserStorySelectItem {
  id: string;
  titre: string;
  projet_id: string;
  projet_nom: string;
  statut: string;
}

/** Type pour la réponse Supabase avec relation projet */
interface RDUserStoryWithProjet {
  id: string;
  titre: string;
  projet_id: string;
  statut: string;
  projet: { nom: string } | null;
}

/**
 * Hook to fetch active (non-done) User Stories for selection in dropdowns
 */
export function useRDUserStoriesSelect() {
  return useQuery({
    queryKey: ['rd-user-stories-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rd_user_stories')
        .select(`
          id,
          titre,
          projet_id,
          statut,
          projet:rd_projets(nom)
        `)
        .not('statut', 'eq', 'termine')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((story) => {
        const typedStory = story as unknown as RDUserStoryWithProjet;
        return {
          id: typedStory.id,
          titre: typedStory.titre,
          projet_id: typedStory.projet_id,
          projet_nom: typedStory.projet?.nom || 'Projet',
          statut: typedStory.statut,
        };
      }) as RDUserStorySelectItem[];
    },
    staleTime: 60 * 1000,
  });
}
