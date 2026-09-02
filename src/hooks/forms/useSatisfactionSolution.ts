import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface SatisfactionSolution {
  id: string;
  user_id?: string | null;
  etablissement_id?: string | null;
  date_reponse: string;
  nom_prenom?: string;
  fonction?: string;
  fonction_autre?: string | null;
  dpi?: string;
  dpi_autre?: string | null;
  modules_utilises?: string[] | null;
  frequence_usage?: string;
  reduction_temps_admin?: string;
  aide_cotation?: string;
  gain_temps_estime?: string;
  fonctionnalites_principales?: string[] | null;
  fonctionnalites_autre?: string | null;
  fonctionnalites_non_utilisees?: string | null;
  satisfaction_globale?: number;
  nps_score?: number;
  points_forts?: string | null;
  ameliorations?: string | null;
  token_enquete?: string | null;
  repondu_via?: string;
  created_at: string;
}

export function useUserSatisfactionSolution(userId: string) {
  return useQuery({
    queryKey: ['satisfaction-solution', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquetes_satisfaction_solution')
        .select('*')
        .eq('user_id', userId)
        .order('date_reponse', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as unknown as SatisfactionSolution[];
    },
    enabled: !!userId,
  });
}

export function useCreateSatisfactionSolution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (satisfaction: Partial<SatisfactionSolution>) => {
      const { data, error } = await supabase
        .from('enquetes_satisfaction_solution')
        .insert([satisfaction as never])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Enquête de satisfaction enregistrée");
      queryClient.invalidateQueries({ queryKey: ['satisfaction-solution'] });
      queryClient.invalidateQueries({ queryKey: ['etablissement-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['global-analytics'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}
