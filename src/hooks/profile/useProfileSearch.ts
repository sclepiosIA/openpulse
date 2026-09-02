import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizePostgrestValue } from "@/lib/sanitize";

export interface ProfileSearchResult {
  id: string;
  user_id?: string | null;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Recherche de profils par nom/prénom/email (>= 2 caractères).
 * Mutualisé pour les dialogs de partage de documents et de gestion de groupes.
 */
export function useProfileSearch(
  query: string,
  options: { queryKey?: string; includeUserId?: boolean; excludeUserId?: string | null } = {},
) {
  const { queryKey = "search-profiles", includeUserId = false, excludeUserId = null } = options;
  return useQuery({
    queryKey: [queryKey, query, excludeUserId],
    enabled: query.length >= 2,
    queryFn: async (): Promise<ProfileSearchResult[]> => {
      const cols = includeUserId
        ? "id, user_id, nom, prenom, email, avatar_url"
        : "id, nom, prenom, email, avatar_url";
      let q = supabase
        .from("profiles")
        .select(cols)
        .or(
          `nom.ilike.%${sanitizePostgrestValue(query)}%,prenom.ilike.%${sanitizePostgrestValue(query)}%,email.ilike.%${sanitizePostgrestValue(query)}%`,
        )
        .limit(10);
      if (excludeUserId) q = q.neq("user_id", excludeUserId);
      const { data } = await q;
      return (data as ProfileSearchResult[] | null) ?? [];
    },
  });
}
