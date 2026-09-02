import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMemberStats {
  profileId: string;
  totalTasks: number;
  tasksInProgress: number;
  tasksCompleted: number;
  tasksOverdue: number;
  completionRate: number;
  avgCompletionTime: number; // en jours
  totalProjects: number;
  projectsByStatus: Record<string, number>;
  workload: 'low' | 'medium' | 'high';
  lastActivity: Date | null;
}

export const useTeamStats = () => {
  return useQuery({
    queryKey: ['team-stats'],
    queryFn: async (): Promise<Record<string, TeamMemberStats>> => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase.rpc('get_profiles_public');
      if (profilesError) throw profilesError;

      // Fetch etablissements - only columns needed for team stats
      const { data: etablissements, error: etabsError } = await supabase
        .from('etablissements')
        .select('id, statut, commercial_id, chef_projet_id, csm_id')
        .limit(500);
      if (etabsError) throw etabsError;

      // Fetch taches - only columns needed for task stats
      const { data: taches, error: tachesError } = await supabase
        .from('taches')
        .select('id, responsable_id, statut, echeance, date_realisation, created_at, updated_at, archive')
        .limit(500);
      if (tachesError) throw tachesError;

      const statsMap: Record<string, TeamMemberStats> = {};

      profiles?.forEach(profile => {
        // Get tasks for this profile
        const profileTasks = taches?.filter(t => t.responsable_id === profile.id) || [];
        
        // Get projects for this profile
        const profileProjects = etablissements?.filter(e => 
          e.commercial_id === profile.id || 
          e.chef_projet_id === profile.id || 
          e.csm_id === profile.id
        ) || [];

        // Calculate task stats
        const tasksCompleted = profileTasks.filter(t => t.statut === 'Terminé');
        const tasksInProgress = profileTasks.filter(t => t.statut === 'En cours');
        const today = new Date();
        const tasksOverdue = profileTasks.filter(t => 
          t.statut !== 'Terminé' && 
          t.echeance && 
          new Date(t.echeance) < today
        );

        // Calculate completion rate
        const completionRate = profileTasks.length > 0
          ? Math.round((tasksCompleted.length / profileTasks.length) * 100)
          : 0;

        // Calculate average completion time
        let avgCompletionTime = 0;
        if (tasksCompleted.length > 0) {
          const completionTimes = tasksCompleted
            .filter(t => t.date_realisation && t.created_at)
            .map(t => {
              const created = new Date(t.created_at!);
              const completed = new Date(t.date_realisation!);
              return Math.floor((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            });
          
          if (completionTimes.length > 0) {
            avgCompletionTime = Math.round(
              completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
            );
          }
        }

        // Calculate projects by status
        const projectsByStatus: Record<string, number> = {};
        profileProjects.forEach(project => {
          const status = project.statut || 'Inconnu';
          projectsByStatus[status] = (projectsByStatus[status] || 0) + 1;
        });

        // Determine workload
        let workload: 'low' | 'medium' | 'high' = 'low';
        const activeTasks = profileTasks.filter(t => t.statut !== 'Terminé' && !t.archive).length;
        if (activeTasks > 20) {
          workload = 'high';
        } else if (activeTasks > 10) {
          workload = 'medium';
        }

        // Get last activity
        let lastActivity: Date | null = null;
        if (profileTasks.length > 0) {
          const sortedTasks = [...profileTasks].sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
          lastActivity = new Date(sortedTasks[0].updated_at);
        }

        statsMap[profile.id] = {
          profileId: profile.id,
          totalTasks: profileTasks.length,
          tasksInProgress: tasksInProgress.length,
          tasksCompleted: tasksCompleted.length,
          tasksOverdue: tasksOverdue.length,
          completionRate,
          avgCompletionTime,
          totalProjects: profileProjects.length,
          projectsByStatus,
          workload,
          lastActivity,
        };
      });

      return statsMap;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useTeamOverviewStats = () => {
  return useQuery({
    queryKey: ['team-overview-stats'],
    queryFn: async () => {
      // get_profiles_public returns only active profiles
      const { data: profiles } = await supabase.rpc('get_profiles_public');
      const { data: taches } = await supabase.from('taches').select('id, statut, echeance').limit(500);
      const { data: etablissements } = await supabase.from('etablissements').select('id').limit(500);

      // All profiles from get_profiles_public are active
      const activeMembers = profiles?.length || 0;
      const totalTasks = taches?.length || 0;
      const completedTasks = taches?.filter(t => t.statut === 'Terminé').length || 0;
      const avgCompletionRate = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

      const today = new Date();
      const tasksOverdueTotal = taches?.filter(t => 
        t.statut !== 'Terminé' && 
        t.echeance && 
        new Date(t.echeance) < today
      ).length || 0;

      return {
        totalMembers: profiles?.length || 0,
        activeMembers,
        totalProjects: etablissements?.length || 0,
        totalTasks,
        avgCompletionRate,
        tasksOverdueTotal,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
};
