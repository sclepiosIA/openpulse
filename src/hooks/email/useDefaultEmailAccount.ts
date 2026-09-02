import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fromExtended } from '@/lib/supabaseTyped';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import type { UserEmailAccountSafeRow } from '@/types/supabase-extensions';

/**
 * Hook pour résoudre le compte email par défaut d'un utilisateur.
 * Priorité :
 * 1. Si accountId fourni et valide (pas 'all') → retourne accountId
 * 2. Sinon, cherche un compte @exploitant.example.org correspondant au profil (prenom.nom)
 * 3. Sinon, retourne le premier compte disponible
 */
export function useDefaultEmailAccount(accountId: string) {
  const { data: profile } = useCurrentProfile();
  
  const { data: accounts } = useQuery({
    queryKey: ['user-email-accounts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await fromExtended('user_email_accounts_safe')
        .select('id, email_address, is_active, profile_id, is_shared')
        .eq('is_active', true)
        .or(`profile_id.eq.${profile.id},is_shared.eq.true`)
        .order('email_address');

      if (error) throw error;
      return (data as unknown) as UserEmailAccountSafeRow[];
    },
    enabled: !!profile?.id,
  });

  const resolvedAccountId = useMemo(() => {
    // Si un compte spécifique est sélectionné, l'utiliser
    if (accountId && accountId !== 'all') {
      return accountId;
    }

    if (!accounts || accounts.length === 0) {
      return null;
    }

    // Si un seul compte, l'utiliser directement
    if (accounts.length === 1) {
      return accounts[0].id;
    }

    // Chercher le compte @exploitant.example.org correspondant au profil
    if (profile?.prenom && profile?.nom) {
      // Construire l'email attendu : prenom.nom@exploitant.example.org
      const expectedEmail = `${profile.prenom.toLowerCase()}.${profile.nom.toLowerCase()}@exploitant.example.org`;
      
      const matchingAccount = accounts.find(
        (account) => account.email_address.toLowerCase() === expectedEmail
      );

      if (matchingAccount) {
        return matchingAccount.id;
      }

      // Fallback: chercher n'importe quel compte @exploitant.example.org
      const marqueAccount = accounts.find(
        (account) => account.email_address.toLowerCase().endsWith('@exploitant.example.org')
      );

      if (marqueAccount) {
        return marqueAccount.id;
      }
    }

    // Dernier fallback: premier compte disponible
    return accounts[0].id;
  }, [accountId, accounts, profile?.prenom, profile?.nom]);

  const resolvedAccount = useMemo(() => {
    if (!resolvedAccountId || !accounts) return null;
    return accounts.find((a) => a.id === resolvedAccountId) || null;
  }, [resolvedAccountId, accounts]);

  return {
    resolvedAccountId,
    resolvedAccount,
    accounts,
  };
}
