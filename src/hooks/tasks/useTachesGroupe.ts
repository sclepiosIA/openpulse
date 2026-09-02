import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { Task } from '@/types/gantt';
import { queryPresets } from '@/lib/queryPresets';

export interface TacheGroupe {
  id: string;
  groupe_id: string;
  niveau_tache: 'groupe';
  categorie_id: string;
  titre: string;
  description?: string;
  statut: 'A faire' | 'En cours' | 'Terminé';
  priorite: 'low' | 'medium' | 'high';
  echeance?: string;
  date_realisation?: string;
  responsable_id?: string;
  ordre: number;
  commentaires?: string;
  archive: boolean;
  created_at: string;
  updated_at: string;
}

async function fetchTachesGroupe(groupeId: string, includeArchived = false): Promise<TacheGroupe[]> {
  let query = supabase
    .from('taches')
    .select(`
      *,
      categorie:categories_taches(id, nom, couleur),
      responsable:profiles!taches_responsable_id_fkey(id, prenom, nom)
    `)
    .eq('groupe_id', groupeId)
    .eq('niveau_tache', 'groupe');

  if (!includeArchived) {
    query = query.eq('archive', false);
  }

  query = query.order('ordre').order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as TacheGroupe[];
}

export function useTachesGroupe(groupeId?: string, includeArchived = false) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['taches-groupe', groupeId, includeArchived],
    queryFn: () => fetchTachesGroupe(groupeId!, includeArchived),
    enabled: !!groupeId,
    ...queryPresets.standard, // 2min staleTime, 30min gcTime
    meta: {
      onError: () => {
        toast({
          title: "Erreur",
          description: "Impossible de charger les tâches du groupe",
          variant: "destructive"
        });
      }
    }
  });
}

export function useCreateTacheGroupe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<TacheGroupe, 'id' | 'created_at' | 'updated_at' | 'archive' | 'niveau_tache'>) => {
      const insertData = { 
        ...data, 
        niveau_tache: 'groupe' as const, 
        etablissement_id: null 
      };
      
      const { data: result, error } = await supabase
        .from('taches')
        .insert(insertData as never)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['taches-groupe', variables.groupe_id] });
      toast({
        title: "Succès",
        description: "Tâche groupe créée avec succès"
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche groupe",
        variant: "destructive"
      });
    }
  });
}

export function useUpdateTacheGroupe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TacheGroupe> }) => {
      const { data: result, error } = await supabase
        .from('taches')
        .update(data)
        .eq('id', id)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      const tache = result as TacheGroupe;
      queryClient.invalidateQueries({ queryKey: ['taches-groupe', tache.groupe_id] });
      toast({
        title: "Succès",
        description: "Tâche groupe mise à jour avec succès"
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la tâche groupe",
        variant: "destructive"
      });
    }
  });
}

export function useArchiveTacheGroupe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archive, groupeId }: { id: string; archive: boolean; groupeId: string }) => {
      const { data: result, error } = await supabase
        .from('taches')
        .update({ archive })
        .eq('id', id)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return { result, groupeId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['taches-groupe', data.groupeId] });
      toast({
        title: "Succès",
        description: data.result.archive ? "Tâche archivée" : "Tâche désarchivée"
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'archive de la tâche",
        variant: "destructive"
      });
    }
  });
}

// Nouveau hook pour récupérer toutes les tâches de tous les établissements d'un groupe
export function useTachesAllEtablissementsGroupe(groupeId?: string) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['taches-all-etablissements-groupe', groupeId],
    queryFn: async () => {
      if (!groupeId) return {};

      // D'abord récupérer les établissements du groupe
      const { data: etablissementsGroupes, error: etabError } = await supabase
        .from('etablissements_groupes')
        .select('etablissement_id')
        .eq('groupe_id', groupeId)
        .is('date_sortie', null);

      if (etabError) throw etabError;
      
      const etablissementIds = etablissementsGroupes?.map(eg => eg.etablissement_id) || [];
      
      if (etablissementIds.length === 0) {
        return {};
      }

      // Ensuite récupérer toutes les tâches de ces établissements
      const { data: taches, error: tachesError } = await supabase
        .from('taches')
        .select(`
          *,
          categorie:categories_taches(id, nom, couleur),
          responsable:profiles!taches_responsable_id_fkey(id, prenom, nom),
          etablissement:etablissements!taches_etablissement_id_fkey(id, nom, ville)
        `)
        .in('etablissement_id', etablissementIds)
        .eq('archive', false)
        .eq('niveau_tache', 'etablissement')
        .order('etablissement_id')
        .order('ordre');

      if (tachesError) throw tachesError;

      // Grouper les tâches par établissement
      const tachesParEtablissement: Record<string, Task[]> = {};
      taches?.forEach((tache) => {
        const etabId = tache.etablissement_id;
        if (!etabId) return;
        if (!tachesParEtablissement[etabId]) {
          tachesParEtablissement[etabId] = [];
        }
        tachesParEtablissement[etabId].push(tache as Task);
      });

      return tachesParEtablissement;
    },
    enabled: !!groupeId,
    ...queryPresets.standard, // 2min staleTime, 30min gcTime
    meta: {
      onError: () => {
        toast({
          title: "Erreur",
          description: "Impossible de charger les tâches des établissements",
          variant: "destructive"
        });
      }
    }
  });
}
