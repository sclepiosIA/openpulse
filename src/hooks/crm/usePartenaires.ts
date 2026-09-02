import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';

export interface Partenaire {
  id: string;
  nom: string;
  type_partenaire: 'institutionnel' | 'industriel' | 'prestataire';
  sous_type: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  region: string | null;
  pays: string;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  email_domains: string[];
  statut_relation: 'prospect' | 'actif' | 'inactif' | 'termine';
  date_debut_partenariat: string | null;
  date_fin_partenariat: string | null;
  responsable_marque_id: string | null;
  engagement_score: number;
  dernier_contact: string | null;
  prochaine_action: string | null;
  valeur_partenariat: number | null;
  notes: string | null;
  tags: string[];
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
  responsable?: {
    id: string;
    prenom: string;
    nom: string;
  };
}

export const usePartenaires = () => {
  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['partenaires'],
    queryFn: async (): Promise<Partenaire[]> => {
      const { data, error } = await supabase
        .from('partenaires')
        .select(`
          *,
          responsable:profiles!responsable_marque_id(
            id,
            prenom,
            nom
          )
        `)
        .order('nom', { ascending: true });

      if (error) throw error;
      return data as Partenaire[];
    },
    ...queryPresets.reference, // 30 min staleTime for reference data
  });

  return {
    data: data || [],
    isLoading,
    error,
    isError,
    refetch,
  };
};

export const usePartenaire = (id: string) => {
  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['partenaire', id],
    queryFn: async (): Promise<Partenaire> => {
      const { data, error } = await supabase
        .from('partenaires')
        .select(`
          *,
          responsable:profiles!responsable_marque_id(
            id,
            prenom,
            nom,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Partenaire;
    },
    enabled: !!id,
    ...queryPresets.reference, // 30 min staleTime for reference data
  });

  return {
    data,
    isLoading,
    error,
    isError,
    refetch,
  };
};

export const useCreatePartenaire = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Partial<Partenaire>, 'id' | 'created_at' | 'updated_at' | 'responsable'>) => {
      const { data: result, error } = await supabase
        .from('partenaires')
        .insert([data as never])
        .select()
        .single();

      if (error) throw error;

      // Créer automatiquement les mappings de domaines si fournis
      if (data.email_domains && data.email_domains.length > 0) {
        const mappings = data.email_domains.map(domain => ({
          partenaire_id: result.id,
          domain: domain.toLowerCase().trim(),
          niveau_mapping: 'partenaire',
          confidence_level: 'high',
          verified: true,
          is_excluded: false,
        }));

        const { error: mappingError } = await supabase
          .from('email_domain_mappings')
          .insert(mappings);

        if (mappingError) {
          debug.error('Erreur lors de la création des mappings:', mappingError);
          // On ne throw pas pour ne pas bloquer la création du partenaire
        }
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "Partenaire créé",
        description: "Le partenaire a été créé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['unclassified-domains'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePartenaire = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Partenaire> & { id: string }) => {
      const { error } = await supabase
        .from('partenaires')
        .update(data as never)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Partenaire mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
      queryClient.invalidateQueries({ queryKey: ['partenaire', variables.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
};

export const useDeletePartenaire = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('partenaires')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Partenaire supprimé",
        description: "Le partenaire a été supprimé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
};
