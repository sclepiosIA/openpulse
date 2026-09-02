import { useMemo, useEffect, useState } from 'react';
import { useProfilesWithRoles, type ProfileWithRole } from '../profile/useProfilesWithRoles';
import { useTeamStats, type TeamMemberStats } from './useTeamStats';
import { useRHKPIs } from './useRHKPIs';
import { useEtablissements } from '../crm/useEtablissements';
import { supabase } from '@/integrations/supabase/client';

interface SimpleEtablissement {
  id: string;
  nom: string;
  ville: string;
  statut: string;
}

export interface EnrichedProfile extends ProfileWithRole {
  stats: TeamMemberStats;
  assignedProjects: SimpleEtablissement[];
  avatar_url?: string | null;
  linkedin_url?: string | null;
}

/**
 * Hook unifié qui combine toutes les sources de données People
 * pour garantir la cohérence entre RH et Équipe
 */
export function usePeopleData() {
  const { data: profiles, isLoading: profilesLoading, isError: profilesError, refetch: refetchProfiles } = useProfilesWithRoles();
  const { data: teamStats, isLoading: teamStatsLoading, isError: teamStatsError, refetch: refetchTeamStats } = useTeamStats();
  const { data: rhKpis, isLoading: rhKpisLoading, isError: rhKpisError, refetch: refetchRhKpis } = useRHKPIs();
  const { data: etablissements, isLoading: etablissementsLoading, isError: etablissementsError, refetch: refetchEtabs } = useEtablissements();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
  }, []);

  const enrichedProfiles = useMemo(() => {
    if (!profiles) return [];
    
    return profiles.map(profile => {
      const stats = teamStats?.[profile.id] || {
        profileId: profile.id,
        totalTasks: 0,
        tasksInProgress: 0,
        tasksCompleted: 0,
        tasksOverdue: 0,
        completionRate: 0,
        avgCompletionTime: 0,
        totalProjects: 0,
        projectsByStatus: {},
        workload: 'low' as const,
        lastActivity: null,
      };

      const assignedProjects: SimpleEtablissement[] = (etablissements?.filter(e =>
        e.commercial_id === profile.id ||
        e.chef_projet_id === profile.id ||
        e.csm_id === profile.id
      ) || []).map(e => ({
        id: e.id,
        nom: e.nom,
        ville: e.ville,
        statut: e.statut
      }));

      return {
        ...profile,
        stats,
        assignedProjects,
      };
    });
  }, [profiles, teamStats, etablissements]);

  return {
    profiles: enrichedProfiles,
    rhKpis,
    currentUserId,
    isLoading: profilesLoading || teamStatsLoading || rhKpisLoading || etablissementsLoading,
    isError: profilesError || teamStatsError || rhKpisError || etablissementsError,
    refetch: () => {
      refetchProfiles();
      refetchTeamStats();
      refetchRhKpis();
      refetchEtabs();
    },
  };
}
