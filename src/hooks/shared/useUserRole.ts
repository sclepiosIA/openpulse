import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";
import { useAuth } from "@/components/AuthProvider";
import { queryPresets } from "@/lib/queryPresets";

// Priorité de résolution quand un utilisateur possède plusieurs rôles
// (doublons hérités provision-test-accounts, ou multi-rôle légitime).
// admin > direction > copil > rh > chef_projet > csm > commercial
const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  direction: 2,
  copil: 3,
  rh: 4,
  chef_projet: 5,
  csm: 6,
  commercial: 7,
};

function resolveRole(roles: Array<{ role: string }> | null | undefined): string | null {
  if (!roles || roles.length === 0) return null;
  let best: string | null = null;
  let bestP = Infinity;
  for (const r of roles) {
    const p = ROLE_PRIORITY[r.role] ?? 99;
    if (p < bestP) {
      bestP = p;
      best = r.role;
    }
  }
  return best;
}

export function useUserRole() {
  // Utiliser le contexte d'authentification principal pour la session
  const { user, loading: authLoading } = useAuth();

  const { data: userRole, isPending: isRolePending } = useQuery({
    queryKey: ['user-role', user?.id],
    enabled: !!user?.id,
    ...queryPresets.reference, // Role changes infrequently - 30min cache
    queryFn: async () => {
      // Tentative optimiste : un seul rôle attendu.
      const single = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!single.error) {
        return single.data?.role ?? null;
      }

      // PGRST116 = multiple rows returned. Fallback en mode liste + résolution
      // par priorité pour rester résilient aux doublons (bug provisioning).
      const code = (single.error as { code?: string }).code;
      if (code === 'PGRST116') {
        const list = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id);

        if (list.error) {
          if (import.meta.env.DEV) {
            debug.error('[useUserRole] Error fetching user roles (list fallback):', list.error);
          }
          return null;
        }

        return resolveRole(list.data as Array<{ role: string }>);
      }

      if (import.meta.env.DEV) {
        debug.error('[useUserRole] Error fetching user role:', single.error);
      }
      return null;
    }
  });

  return {
    isAdmin: userRole === 'admin' || userRole === 'direction',
    isDirection: userRole === 'direction',
    isCopil: userRole === 'copil',
    role: userRole,
    isLoading: authLoading || (!!user?.id && isRolePending),
  };
}
