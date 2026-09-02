import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { queryPresets } from '@/lib/queryPresets';

export interface PartenaireContact {
  id: string;
  partenaire_id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  email: string | null;
  telephone: string | null;
  est_contact_principal: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_source?: string;
  created_metadata?: Record<string, unknown> | null;
}

export const usePartenairesContacts = (partenaireId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['partenaires-contacts', partenaireId],
    queryFn: async (): Promise<PartenaireContact[]> => {
      const { data, error } = await supabase
        .from('partenaires_contacts')
        .select('id, partenaire_id, nom, prenom, fonction, email, telephone, est_contact_principal, notes, created_at, updated_at, created_source, created_metadata')
        .eq('partenaire_id', partenaireId)
        .order('est_contact_principal', { ascending: false })
        .order('nom', { ascending: true });

      if (error) throw error;
      return data as PartenaireContact[];
    },
    enabled: !!partenaireId,
    ...queryPresets.reference, // 30 min staleTime for reference data
  });

  return {
    contacts: data || [],
    isLoading,
    error,
  };
};

export const useCreatePartenaireContact = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Partial<PartenaireContact>, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('partenaires_contacts')
        .insert([data as never]);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Contact créé",
        description: "Le contact a été ajouté avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires-contacts', variables.partenaire_id] });
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

export const useUpdatePartenaireContact = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, partenaire_id, ...data }: Partial<PartenaireContact> & { id: string; partenaire_id: string }) => {
      const { error } = await supabase
        .from('partenaires_contacts')
        .update(data as never)
        .eq('id', id);

      if (error) throw error;
      return partenaire_id;
    },
    onSuccess: (partenaireId) => {
      toast({
        title: "Contact mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires-contacts', partenaireId] });
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

export const useDeletePartenaireContact = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, partenaire_id }: { id: string; partenaire_id: string }) => {
      const { error } = await supabase
        .from('partenaires_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return partenaire_id;
    },
    onSuccess: (partenaireId) => {
      toast({
        title: "Contact supprimé",
        description: "Le contact a été supprimé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['partenaires-contacts', partenaireId] });
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
