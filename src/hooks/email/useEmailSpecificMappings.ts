import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface EmailSpecificMapping {
  id: string;
  email_address: string;
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  profile_id: string | null;
  niveau_mapping: 'etablissement' | 'groupe' | 'partenaire' | 'equipe';
  confidence_level: string | null;
  verified: boolean | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
  etablissement?: {
    id: string;
    nom: string;
    ville: string;
  } | null;
  groupe?: {
    id: string;
    nom: string;
  } | null;
  partenaire?: {
    id: string;
    nom: string;
  } | null;
  profile?: {
    id: string;
    prenom: string;
    nom: string;
  } | null;
}

export const useEmailSpecificMappings = (etablissementId?: string) => {
  const { toast } = useToast();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['email-specific-mappings', etablissementId],
    queryFn: async (): Promise<EmailSpecificMapping[]> => {
      let query = supabase
        .from('email_specific_mappings')
        .select(`
          *,
          etablissement:etablissements(
            id,
            nom,
            ville
          ),
          groupe:groupes_etablissements(
            id,
            nom
          ),
          partenaire:partenaires(
            id,
            nom
          ),
          profile:profiles!profile_id(
            id,
            prenom,
            nom
          )
        `)
        .order('created_at', { ascending: false });

      if (etablissementId) {
        query = query.eq('etablissement_id', etablissementId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailSpecificMapping[];
    },
  });

  return {
    mappings: mappings || [],
    isLoading,
  };
};

export const useAddEmailSpecificMapping = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email_address: string;
      etablissement_id?: string;
      groupe_id?: string;
      partenaire_id?: string;
      profile_id?: string;
      niveau_mapping: 'etablissement' | 'groupe' | 'partenaire' | 'equipe';
      confidence_level?: 'high' | 'medium' | 'low';
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('email_specific_mappings')
        .insert([{
          email_address: data.email_address.toLowerCase().trim(),
          etablissement_id: data.etablissement_id || null,
          groupe_id: data.groupe_id || null,
          partenaire_id: data.partenaire_id || null,
          profile_id: data.profile_id || null,
          niveau_mapping: data.niveau_mapping,
          confidence_level: data.confidence_level || 'high',
          notes: data.notes || null,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Mapping créé",
        description: "L'email a été affilié avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['email-specific-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['generic-domain-unclassified-emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-classification-stats'] });
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

export const useRemoveEmailSpecificMapping = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('email_specific_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Mapping supprimé",
        description: "L'affiliation email a été supprimée.",
      });
      queryClient.invalidateQueries({ queryKey: ['email-specific-mappings'] });
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

export const useUpdateEmailSpecificMapping = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      confidence_level?: 'high' | 'medium' | 'low';
      verified?: boolean;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('email_specific_mappings')
        .update({
          confidence_level: data.confidence_level,
          verified: data.verified,
          notes: data.notes,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Mapping mis à jour",
        description: "L'affiliation email a été modifiée.",
      });
      queryClient.invalidateQueries({ queryKey: ['email-specific-mappings'] });
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

export const useMarkEmailAsUnaffiliated = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailAddress: string) => {
      const { error } = await supabase
        .from('email_specific_mappings')
        .insert([{
          email_address: emailAddress.toLowerCase().trim(),
          etablissement_id: null,
          groupe_id: null,
          partenaire_id: null,
          profile_id: null,
          niveau_mapping: 'etablissement',
          confidence_level: 'high',
          is_unaffiliated: true,
          notes: 'Non affilié - Email personnel marqué comme non associé',
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Email marqué comme non affilié",
        description: "Cet email ne sera plus affiché dans la liste.",
      });
      queryClient.invalidateQueries({ queryKey: ['email-specific-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['generic-domain-unclassified-emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-classification-stats'] });
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
