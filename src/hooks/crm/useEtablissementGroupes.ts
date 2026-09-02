import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { groupeKeys } from './useGroupes';

export interface EtablissementGroupe {
  id: string;
  etablissement_id: string;
  groupe_id: string;
  date_entree: string;
  date_sortie?: string;
  est_etablissement_principal: boolean;
  role_dans_groupe?: string;
  created_at: string;
}

export interface GroupeWithEtablissements {
  id: string;
  nom: string;
  type: string;
  nombre_etablissements: number;
}

export interface EtablissementWithGroupe extends EtablissementGroupe {
  groupe: {
    id: string;
    nom: string;
    type: string;
    logo_url?: string | null;
  };
}

async function fetchGroupesForEtablissement(etablissementId: string): Promise<EtablissementWithGroupe[]> {
  const { data, error } = await supabase
    .from('etablissements_groupes')
    .select(`
      *,
      groupe:groupes_etablissements(id, nom, type, logo_url)
    `)
    .eq('etablissement_id', etablissementId)
    .is('date_sortie', null);

  if (error) throw error;
  return data as unknown as EtablissementWithGroupe[];
}

async function fetchEtablissementsInGroupe(groupeId: string) {
  const { data, error } = await supabase
    .from('etablissements_groupes')
    .select(`
      *,
      etablissement:etablissements(*)
    `)
    .eq('groupe_id', groupeId)
    .is('date_sortie', null)
    .order('est_etablissement_principal', { ascending: false });

  if (error) throw error;
  return data;
}

export function useGroupesForEtablissement(etablissementId?: string) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['etablissement-groupes', etablissementId],
    queryFn: () => fetchGroupesForEtablissement(etablissementId!),
    enabled: !!etablissementId,
    staleTime: 5 * 60 * 1000,
    meta: {
      onError: () => {
        toast({
          title: "Erreur",
          description: "Impossible de charger les groupes de l'établissement",
          variant: "destructive"
        });
      }
    }
  });
}

export function useEtablissementsInGroupe(groupeId?: string) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['groupe-etablissements', groupeId],
    queryFn: () => fetchEtablissementsInGroupe(groupeId!),
    enabled: !!groupeId,
    staleTime: 5 * 60 * 1000,
    meta: {
      onError: () => {
        toast({
          title: "Erreur",
          description: "Impossible de charger les établissements du groupe",
          variant: "destructive"
        });
      }
    }
  });
}

export function useAddEtablissementToGroupe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      etablissement_id: string;
      groupe_id: string;
      est_etablissement_principal?: boolean;
      role_dans_groupe?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('etablissements_groupes')
        .insert(data)
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['etablissement-groupes', variables.etablissement_id] });
      queryClient.invalidateQueries({ queryKey: ['groupe-etablissements', variables.groupe_id] });
      queryClient.invalidateQueries({ queryKey: groupeKeys.detail(variables.groupe_id) });
      toast({
        title: "Succès",
        description: "Établissement ajouté au groupe avec succès"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error).includes('duplicate') 
          ? "Cet établissement est déjà dans ce groupe"
          : "Impossible d'ajouter l'établissement au groupe",
        variant: "destructive"
      });
    }
  });
}

export function useRemoveEtablissementFromGroupe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, groupeId, etablissementId }: { id: string; groupeId: string; etablissementId: string }) => {
      const { error } = await supabase
        .from('etablissements_groupes')
        .update({ date_sortie: new Date().toISOString().split('T')[0] })
        .eq('id', id);

      if (error) throw error;
      return { groupeId, etablissementId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['etablissement-groupes', data.etablissementId] });
      queryClient.invalidateQueries({ queryKey: ['groupe-etablissements', data.groupeId] });
      queryClient.invalidateQueries({ queryKey: groupeKeys.detail(data.groupeId) });
      toast({
        title: "Succès",
        description: "Établissement retiré du groupe avec succès"
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de retirer l'établissement du groupe",
        variant: "destructive"
      });
    }
  });
}

export function useUpdateEtablissementGroupe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<EtablissementGroupe> 
    }) => {
      const { data: result, error } = await supabase
        .from('etablissements_groupes')
        .update(data)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['etablissement-groupes', result.etablissement_id] });
      queryClient.invalidateQueries({ queryKey: ['groupe-etablissements', result.groupe_id] });
      queryClient.invalidateQueries({ queryKey: groupeKeys.detail(result.groupe_id) });
      toast({
        title: "Succès",
        description: "Relation mise à jour avec succès"
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la relation",
        variant: "destructive"
      });
    }
  });
}
