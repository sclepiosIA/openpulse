import { useQuery } from '@tanstack/react-query';
import { fromExtended } from '@/lib/supabaseTyped';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';

/**
 * Hook centralisé pour récupérer les IDs des comptes email de l'utilisateur courant.
 * Inclut les comptes personnels (profile_id) et les comptes partagés (is_shared).
 * Utilisé pour filtrer les threads email dans toutes les requêtes.
 */
export function useUserEmailAccountIds() {
  const { data: profile } = useCurrentProfile();

  const { data: accountIds, isLoading } = useQuery({
    queryKey: ['user-email-account-ids', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await fromExtended('user_email_accounts_safe')
        .select('id')
        .eq('is_active', true)
        .or(`profile_id.eq.${profile.id},is_shared.eq.true`);
      return (data as { id: string }[] | null)?.map(a => a.id) ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!profile?.id,
  });

  return {
    accountIds: accountIds ?? [],
    isLoading,
    hasAccounts: !!accountIds && accountIds.length > 0,
  };
}
