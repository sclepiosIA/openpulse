import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { ReferentielCompetence, CompetenceCategorie } from '@/types/competences';

interface ReferentielFilters {
  categorie?: CompetenceCategorie;
  search?: string;
  actifOnly?: boolean;
}

export function useReferentielCompetences(filters: ReferentielFilters = {}) {
  const queryClient = useQueryClient();

  const { data: competences = [], isLoading, error } = useQuery({
    queryKey: ['referentiel-competences', filters],
    queryFn: async () => {
      let query = supabase
        .from('referentiel_competences')
        .select('id, nom, description, categorie, parent_id, icone, ordre, est_actif, created_at, updated_at')
        .order('ordre', { ascending: true });

      if (filters.categorie) {
        query = query.eq('categorie', filters.categorie);
      }

      if (filters.actifOnly !== false) {
        query = query.eq('est_actif', true);
      }

      if (filters.search) {
        query = query.ilike('nom', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ReferentielCompetence[];
    },
  });

  const createCompetence = useMutation({
    mutationFn: async (competence: Partial<ReferentielCompetence>) => {
      const { data, error } = await supabase
        .from('referentiel_competences')
        .insert(competence as never)
        .select()
        .single();

      if (error) throw error;
      return data as ReferentielCompetence;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiel-competences'] });
      toast.success('Compétence ajoutée au référentiel');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const updateCompetence = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReferentielCompetence> & { id: string }) => {
      const { data, error } = await supabase
        .from('referentiel_competences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiel-competences'] });
      toast.success('Compétence mise à jour');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const deleteCompetence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('referentiel_competences')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiel-competences'] });
      toast.success('Compétence supprimée');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  // Grouper par catégorie
  const competencesByCategory = competences.reduce((acc, comp) => {
    if (!acc[comp.categorie]) {
      acc[comp.categorie] = [];
    }
    acc[comp.categorie].push(comp);
    return acc;
  }, {} as Record<CompetenceCategorie, ReferentielCompetence[]>);

  return {
    competences,
    competencesByCategory,
    isLoading,
    error,
    createCompetence,
    updateCompetence,
    deleteCompetence,
  };
}
