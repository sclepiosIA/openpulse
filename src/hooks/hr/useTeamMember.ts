import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { debug } from "@/lib/debug";
import { useAuth } from "@/components/AuthProvider";

/**
 * Hook pour vérifier si l'utilisateur connecté est membre de l'équipe OpenPulse
 * (admin, csm, chef_projet, commercial)
 */
export function useIsTeamMember() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-team-member'],
    queryFn: async () => {
      
      if (!user) return false;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'csm', 'chef_projet', 'commercial'])
        .maybeSingle();

      if (error) {
        debug.error('Error checking team member:', error);
        return false;
      }

      return !!data;
    },
  });
}

/**
 * Hook pour récupérer les infos du profile de l'utilisateur connecté (équipe OpenPulse)
 */
export function useTeamMemberProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['team-member-profile'],
    queryFn: async () => {
      
      if (!user) return null;

      // Récupérer le profil avec le rôle
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nom, prenom, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        debug.error('Error fetching team member profile:', profileError);
        return null;
      }

      if (!profile) return null;

      // Récupérer le rôle
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // Mapper les rôles vers des fonctions lisibles
      const roleLabels: Record<string, string> = {
        admin: 'Président',
        csm: 'Customer Success Manager',
        chef_projet: 'Chef de projet',
        commercial: 'Commercial',
      };

      return {
        ...profile,
        role: roleData?.role || null,
        fonction: roleData?.role ? roleLabels[roleData.role] || roleData.role : null,
      };
    },
  });
}
