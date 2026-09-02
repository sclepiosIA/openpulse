import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import type {
  RDProjet,
  RDEpic,
  RDSprint,
  RDUserStory,
  RDTask,
  RDProjetFormData,
  RDEpicFormData,
  RDSprintFormData,
  RDUserStoryFormData,
  RDTaskFormData,
  RDUserStoryStatut,
} from '@/types/rd';
import { toast } from 'sonner';

// =====================================================
// PROJETS
// =====================================================

// Helper: enrich projets with responsable info via a tolerant separate query.
// The embedded join `profiles!fk` can be silently filtered by RLS for non-admin
// roles (e.g. copil) and historically blocked the whole select for some PostgREST
// configurations — fetching separately is resilient.
async function attachResponsables<T extends { responsable_id?: string | null }>(rows: T[]): Promise<(T & { responsable: { id: string; prenom: string; nom: string } | null })[]> {
  const ids = Array.from(new Set(rows.map(r => r.responsable_id).filter(Boolean) as string[]));
  let map: Record<string, { id: string; prenom: string; nom: string }> = {};
  if (ids.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, prenom, nom')
      .in('id', ids);
    if (data) map = Object.fromEntries(data.map(p => [p.id, p]));
  }
  return rows.map(r => ({ ...r, responsable: r.responsable_id ? (map[r.responsable_id] ?? null) : null }));
}

export function useRDProjets() {
  return useQuery({
    queryKey: ['rd-projets'],
    staleTime: 2 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rd_projets')
        .select('id, nom, description, statut, couleur, responsable_id, date_debut, date_fin_prevue, dpi, visible_portail, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const enriched = await attachResponsables(data ?? []);
      return enriched as unknown as RDProjet[];
    },
  });
}

export function useRDProjet(id: string | undefined) {
  return useQuery({
    queryKey: ['rd-projet', id],
    staleTime: 2 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('rd_projets')
        .select('id, nom, description, statut, couleur, responsable_id, date_debut, date_fin_prevue, dpi, visible_portail, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      const [enriched] = await attachResponsables([data]);
      return enriched as unknown as RDProjet;
    },
    enabled: !!id,
  });
}

export function useCreateRDProjet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RDProjetFormData) => {
      const { data: result, error } = await supabase
        .from('rd_projets')
        .insert(data)
        .select('id, nom, description, statut, couleur, responsable_id, date_debut, date_fin_prevue, dpi, visible_portail, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rd-projets'] });
      toast.success('Projet créé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création du projet');
      debug.error(error);
    },
  });
}

export function useUpdateRDProjet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: RDProjetFormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('rd_projets')
        .update(data)
        .eq('id', id)
        .select('id, nom, description, statut, couleur, responsable_id, date_debut, date_fin_prevue, dpi, visible_portail, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-projets'] });
      queryClient.invalidateQueries({ queryKey: ['rd-projet', variables.id] });
      toast.success('Projet mis à jour');
    },
  });
}

export function useDeleteRDProjet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rd_projets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rd-projets'] });
      toast.success('Projet supprimé');
    },
  });
}

// =====================================================
// EPICS
// =====================================================

export function useRDEpics(projetId: string | undefined) {
  return useQuery({
    queryKey: ['rd-epics', projetId],
    queryFn: async () => {
      if (!projetId) return [];
      const { data, error } = await supabase
        .from('rd_epics')
        .select('id, projet_id, titre, description, couleur, statut, ordre, created_at, updated_at')
        .eq('projet_id', projetId)
        .order('ordre', { ascending: true })
        .limit(200);

      if (error) throw error;
      return data as RDEpic[];
    },
    enabled: !!projetId,
  });
}

export function useCreateRDEpic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RDEpicFormData) => {
      const { data: result, error } = await supabase
        .from('rd_epics')
        .insert(data)
        .select('id, projet_id, titre, description, couleur, statut, ordre, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-epics', variables.projet_id] });
      toast.success('Epic créé');
    },
  });
}

export function useUpdateRDEpic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projet_id, ...data }: Partial<RDEpic> & { id: string; projet_id: string }) => {
      const { data: result, error } = await supabase
        .from('rd_epics')
        .update(data as never)
        .eq('id', id)
        .select('id, projet_id, titre, description, couleur, statut, ordre, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-epics', variables.projet_id] });
      toast.success('Epic mis à jour');
    },
  });
}

export function useDeleteRDEpic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projet_id }: { id: string; projet_id: string }) => {
      const { error } = await supabase.from('rd_epics').delete().eq('id', id);
      if (error) throw error;
      return { projet_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rd-epics', result.projet_id] });
      toast.success('Epic supprimé');
    },
  });
}

// =====================================================
// SPRINTS
// =====================================================

export function useRDSprints(projetId: string | undefined) {
  return useQuery({
    queryKey: ['rd-sprints', projetId],
    queryFn: async () => {
      if (!projetId) return [];
      const { data, error } = await supabase
        .from('rd_sprints')
        .select('id, projet_id, nom, numero, objectif, date_debut, date_fin, statut, velocity_prevue, velocity_reelle, created_at, updated_at')
        .eq('projet_id', projetId)
        .order('numero', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as RDSprint[];
    },
    enabled: !!projetId,
  });
}

export function useActiveSprint(projetId: string | undefined) {
  return useQuery({
    queryKey: ['rd-active-sprint', projetId],
    queryFn: async () => {
      if (!projetId) return null;
      const { data, error } = await supabase
        .from('rd_sprints')
        .select('id, projet_id, nom, numero, objectif, date_debut, date_fin, statut, velocity_prevue, velocity_reelle, created_at, updated_at')
        .eq('projet_id', projetId)
        .eq('statut', 'actif')
        .maybeSingle();
      
      if (error) throw error;
      return data as RDSprint | null;
    },
    enabled: !!projetId,
  });
}

export function useCreateRDSprint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RDSprintFormData) => {
      const { data: result, error } = await supabase
        .from('rd_sprints')
        .insert(data)
        .select('id, projet_id, nom, numero, objectif, date_debut, date_fin, statut, velocity_prevue, velocity_reelle, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-sprints', variables.projet_id] });
      queryClient.invalidateQueries({ queryKey: ['rd-active-sprint', variables.projet_id] });
      toast.success('Sprint créé');
    },
  });
}

export function useUpdateRDSprint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projet_id, ...data }: Partial<RDSprint> & { id: string; projet_id: string }) => {
      const { data: result, error } = await supabase
        .from('rd_sprints')
        .update(data as never)
        .eq('id', id)
        .select('id, projet_id, nom, numero, objectif, date_debut, date_fin, statut, velocity_prevue, velocity_reelle, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-sprints', variables.projet_id] });
      queryClient.invalidateQueries({ queryKey: ['rd-active-sprint', variables.projet_id] });
      toast.success('Sprint mis à jour');
    },
  });
}

// =====================================================
// USER STORIES
// =====================================================

export function useRDUserStories(projetId: string | undefined, sprintId?: string | null) {
  return useQuery({
    queryKey: ['rd-user-stories', projetId, sprintId],
    retry: 1,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!projetId) return [];
      
      // Pas de jointure embarquée sur `profiles` : la RLS restreinte sur `profiles`
      // pour les rôles non-direction (ex: chef_projet) faisait que PostgREST ne
      // résolvait jamais la requête, gelant le backlog R&D sur « Chargement... ».
      let query = supabase
        .from('rd_user_stories')
        .select(`
          id, projet_id, epic_id, sprint_id, titre, description, criteres_acceptation,
          points, priorite, statut, responsable_id, ordre, date_debut, date_fin, created_at, updated_at,
          etablissement_id,
          epic:rd_epics(id, titre, couleur),
          etablissement:etablissements(id, nom, statut)
        `)
        .eq('projet_id', projetId);
      
      if (sprintId !== undefined) {
        if (sprintId === null) {
          query = query.is('sprint_id', null);
        } else {
          query = query.eq('sprint_id', sprintId);
        }
      }
      
      const { data, error } = await query.order('ordre', { ascending: true });
      
      if (error) throw error;
      const rows = (data ?? []) as Array<{ responsable_id?: string | null }>;
      const enriched = await attachResponsables(rows);
      return enriched as unknown as RDUserStory[];
    },
    enabled: !!projetId,
  });
}

export function useBacklog(projetId: string | undefined) {
  return useRDUserStories(projetId, null);
}

export function useCreateRDUserStory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RDUserStoryFormData) => {
      const { data: result, error } = await supabase
        .from('rd_user_stories')
        .insert(data)
        .select('id, projet_id, epic_id, sprint_id, titre, description, criteres_acceptation, points, priorite, statut, responsable_id, etablissement_id, ordre, date_debut, date_fin, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-user-stories', variables.projet_id] });
      toast.success('User story créée');
    },
  });
}

export function useUpdateRDUserStory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projet_id, ...data }: Partial<RDUserStory> & { id: string; projet_id: string }) => {
      const { data: result, error } = await supabase
        .from('rd_user_stories')
        .update(data as never)
        .eq('id', id)
        .select('id, projet_id, epic_id, sprint_id, titre, description, criteres_acceptation, points, priorite, statut, responsable_id, etablissement_id, ordre, date_debut, date_fin, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-user-stories', variables.projet_id] });
      toast.success('User story mise à jour');
    },
  });
}

export function useMoveStoryToSprint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storyId, sprintId, projetId }: { storyId: string; sprintId: string | null; projetId: string }) => {
      const { error } = await supabase
        .from('rd_user_stories')
        .update({ sprint_id: sprintId })
        .eq('id', storyId);
      
      if (error) throw error;
      return { projetId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rd-user-stories', result.projetId] });
    },
  });
}

export function useUpdateStoryStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storyId, statut, projetId }: { storyId: string; statut: RDUserStoryStatut; projetId: string }) => {
      const { error } = await supabase
        .from('rd_user_stories')
        .update({ statut })
        .eq('id', storyId);
      
      if (error) throw error;
      return { projetId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rd-user-stories', result.projetId] });
    },
  });
}

export function useDeleteRDUserStory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projet_id }: { id: string; projet_id: string }) => {
      const { error } = await supabase.from('rd_user_stories').delete().eq('id', id);
      if (error) throw error;
      return { projet_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rd-user-stories', result.projet_id] });
      toast.success('User story supprimée');
    },
  });
}

// =====================================================
// TASKS
// =====================================================

export function useRDTasks(userStoryId: string | undefined) {
  return useQuery({
    queryKey: ['rd-tasks', userStoryId],
    retry: 1,
    queryFn: async () => {
      if (!userStoryId) return [];
      // Idem user stories : pas de join `profiles` embarqué (RLS chef_projet).
      const { data, error } = await supabase
        .from('rd_tasks')
        .select(`
          id, user_story_id, titre, description, statut, responsable_id, estimation_heures, temps_passe, date_debut, date_fin, created_at, updated_at
        `)
        .eq('user_story_id', userStoryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      const enriched = await attachResponsables((data ?? []) as Array<{ responsable_id?: string | null }>);
      return enriched as unknown as RDTask[];
    },
    enabled: !!userStoryId,
  });
}

export function useCreateRDTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RDTaskFormData) => {
      const { data: result, error } = await supabase
        .from('rd_tasks')
        .insert(data)
        .select('id, user_story_id, titre, description, statut, responsable_id, estimation_heures, temps_passe, date_debut, date_fin, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-tasks', variables.user_story_id] });
      toast.success('Tâche créée');
    },
  });
}

export function useUpdateRDTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, user_story_id, ...data }: Partial<RDTask> & { id: string; user_story_id: string }) => {
      const { data: result, error } = await supabase
        .from('rd_tasks')
        .update(data as never)
        .eq('id', id)
        .select('id, user_story_id, titre, description, statut, responsable_id, estimation_heures, temps_passe, date_debut, date_fin, created_at, updated_at')
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rd-tasks', variables.user_story_id] });
    },
  });
}

export function useDeleteRDTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, user_story_id }: { id: string; user_story_id: string }) => {
      const { error } = await supabase.from('rd_tasks').delete().eq('id', id);
      if (error) throw error;
      return { user_story_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rd-tasks', result.user_story_id] });
      toast.success('Tâche supprimée');
    },
  });
}

// =====================================================
// ANALYTICS
// =====================================================

export function useSprintStats(sprintId: string | undefined) {
  return useQuery({
    queryKey: ['rd-sprint-stats', sprintId],
    queryFn: async () => {
      if (!sprintId) return null;
      
      const { data: stories, error } = await supabase
        .from('rd_user_stories')
        .select('statut, points')
        .eq('sprint_id', sprintId);
      
      if (error) throw error;
      
      const totalPoints = stories?.reduce((sum, s) => sum + (s.points || 0), 0) || 0;
      const donePoints = stories?.filter(s => s.statut === 'done').reduce((sum, s) => sum + (s.points || 0), 0) || 0;
      const totalStories = stories?.length || 0;
      const doneStories = stories?.filter(s => s.statut === 'done').length || 0;
      
      return {
        totalPoints,
        donePoints,
        totalStories,
        doneStories,
        progress: totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0,
      };
    },
    enabled: !!sprintId,
  });
}

export function useProjetStats(projetId: string | undefined) {
  return useQuery({
    queryKey: ['rd-projet-stats', projetId],
    queryFn: async () => {
      if (!projetId) return null;
      
      const [storiesResult, epicsResult, sprintsResult] = await Promise.all([
        supabase.from('rd_user_stories').select('statut, points').eq('projet_id', projetId),
        supabase.from('rd_epics').select('statut').eq('projet_id', projetId),
        supabase.from('rd_sprints').select('statut, velocity_reelle').eq('projet_id', projetId),
      ]);
      
      const stories = storiesResult.data || [];
      const epics = epicsResult.data || [];
      const sprints = sprintsResult.data || [];
      
      const completedSprints = sprints.filter(s => s.statut === 'termine');
      const avgVelocity = completedSprints.length > 0
        ? Math.round(completedSprints.reduce((sum, s) => sum + (s.velocity_reelle || 0), 0) / completedSprints.length)
        : 0;
      
      return {
        totalStories: stories.length,
        backlogStories: stories.filter(s => s.statut === 'backlog').length,
        inProgressStories: stories.filter(s => ['todo', 'in_progress', 'review'].includes(s.statut || '')).length,
        doneStories: stories.filter(s => s.statut === 'done').length,
        totalPoints: stories.reduce((sum, s) => sum + (s.points || 0), 0),
        totalEpics: epics.length,
        doneEpics: epics.filter(e => e.statut === 'done').length,
        totalSprints: sprints.length,
        activeSprints: sprints.filter(s => s.statut === 'actif').length,
        avgVelocity,
      };
    },
    enabled: !!projetId,
  });
}
