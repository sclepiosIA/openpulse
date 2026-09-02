import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { PlanDeveloppement, PlanAction } from '@/types/competences';

interface PlanFilters {
  profileId?: string;
  managerId?: string;
  statut?: PlanDeveloppement['statut'];
}

export function usePlansDeveloppement(filters: PlanFilters = {}) {
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ['plans-developpement', filters],
    queryFn: async () => {
      let query = supabase
        .from('plans_developpement')
        .select(`
          *,
          profile:profiles!plans_developpement_profile_id_fkey(id, nom, prenom),
          manager:profiles!plans_developpement_manager_id_fkey(id, nom, prenom)
        `)
        .order('created_at', { ascending: false });

      if (filters.profileId) {
        query = query.eq('profile_id', filters.profileId);
      }

      if (filters.managerId) {
        query = query.eq('manager_id', filters.managerId);
      }

      if (filters.statut) {
        query = query.eq('statut', filters.statut);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PlanDeveloppement[];
    },
  });

  const createPlan = useMutation({
    mutationFn: async (plan: Partial<PlanDeveloppement>) => {
      const { data, error } = await supabase
        .from('plans_developpement')
        .insert(plan as never)
        .select()
        .single();

      if (error) throw error;
      return data as PlanDeveloppement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-developpement'] });
      queryClient.invalidateQueries({ queryKey: ['competences-kpis'] });
      toast.success('Plan de développement créé');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanDeveloppement> & { id: string }) => {
      const { data, error } = await supabase
        .from('plans_developpement')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-developpement'] });
      queryClient.invalidateQueries({ queryKey: ['competences-kpis'] });
      toast.success('Plan mis à jour');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plans_developpement')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-developpement'] });
      queryClient.invalidateQueries({ queryKey: ['competences-kpis'] });
      toast.success('Plan supprimé');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  return {
    plans,
    isLoading,
    error,
    createPlan,
    updatePlan,
    deletePlan,
  };
}

// Hook pour les actions d'un plan
export function usePlanActions(planId?: string) {
  const queryClient = useQueryClient();

  const { data: actions = [], isLoading, error } = useQuery({
    queryKey: ['plan-actions', planId],
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return [];
      
      const { data, error } = await supabase
        .from('plan_developpement_actions')
        .select(`
          *,
          competence:referentiel_competences(id, nom, categorie),
          certification:referentiel_certifications(id, nom, organisme)
        `)
        .eq('plan_id', planId)
        .order('priorite', { ascending: true })
        .order('date_prevue', { ascending: true });

      if (error) throw error;
      return data as PlanAction[];
    },
  });

  const createAction = useMutation({
    mutationFn: async (action: Partial<PlanAction>) => {
      const { data, error } = await supabase
        .from('plan_developpement_actions')
        .insert(action as never)
        .select()
        .single();

      if (error) throw error;

      // Update plan progression
      if (action.plan_id) {
        await updatePlanProgression(action.plan_id);
      }

      return data as PlanAction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-actions'] });
      queryClient.invalidateQueries({ queryKey: ['plans-developpement'] });
      toast.success('Action ajoutée');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanAction> & { id: string }) => {
      const { data, error } = await supabase
        .from('plan_developpement_actions')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update plan progression if status changed
      if (updates.statut && planId) {
        await updatePlanProgression(planId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-actions'] });
      queryClient.invalidateQueries({ queryKey: ['plans-developpement'] });
      toast.success('Action mise à jour');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plan_developpement_actions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update plan progression
      if (planId) {
        await updatePlanProgression(planId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-actions'] });
      queryClient.invalidateQueries({ queryKey: ['plans-developpement'] });
      toast.success('Action supprimée');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  // Stats
  const stats = {
    total: actions.length,
    aFaire: actions.filter(a => a.statut === 'a_faire').length,
    enCours: actions.filter(a => a.statut === 'en_cours').length,
    terminees: actions.filter(a => a.statut === 'termine').length,
    annulees: actions.filter(a => a.statut === 'annule').length,
  };

  return {
    actions,
    stats,
    isLoading,
    error,
    createAction,
    updateAction,
    deleteAction,
  };
}

// Helper function to update plan progression
async function updatePlanProgression(planId: string) {
  const { data: actions } = await supabase
    .from('plan_developpement_actions')
    .select('statut')
    .eq('plan_id', planId)
    .not('statut', 'eq', 'annule')
    .limit(100);

  if (!actions || actions.length === 0) return;

  const completed = actions.filter(a => a.statut === 'termine').length;
  const progression = Math.round((completed / actions.length) * 100);

  await supabase
    .from('plans_developpement')
    .update({ progression })
    .eq('id', planId);
}
