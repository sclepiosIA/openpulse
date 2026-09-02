import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function normalizeEmail(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/<([^>]+)>/);
  const email = (match?.[1] || trimmed).trim();
  if (!email.includes("@")) return null;
  return email.toLowerCase();
}

export interface ProfileAvatarResult {
  avatarUrl: string | null;
  profileId: string;
  displayName: string;
}

/**
 * Résolution avatar équipe:
 * 1) profiles.email
 * 2) email_specific_mappings (niveau_mapping='equipe') -> profiles.id
 */
export function useProfileAvatarByEmail(email?: string) {
  const normalizedEmail = normalizeEmail(email);

  return useQuery<ProfileAvatarResult | null>({
    queryKey: ["profile-avatar-by-email", normalizedEmail],
    queryFn: async () => {
      if (!normalizedEmail) return null;

      // 1) Direct match sur profiles.email
      const { data: directProfile } = await supabase
        .from("profiles")
        .select("id, avatar_url, prenom, nom")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (directProfile) {
        return {
          avatarUrl: directProfile.avatar_url || null,
          profileId: directProfile.id,
          displayName: `${directProfile.prenom} ${directProfile.nom}`.trim(),
        };
      }

      // 2) Alias via email_specific_mappings
      const { data: mapping } = await supabase
        .from("email_specific_mappings")
        .select("profile_id")
        .eq("email_address", normalizedEmail)
        .eq("niveau_mapping", "equipe")
        .maybeSingle();

      if (!mapping?.profile_id) return null;

      const { data: mappedProfile } = await supabase
        .from("profiles")
        .select("id, avatar_url, prenom, nom")
        .eq("id", mapping.profile_id)
        .maybeSingle();

      if (!mappedProfile) return null;

      return {
        avatarUrl: mappedProfile.avatar_url || null,
        profileId: mappedProfile.id,
        displayName: `${mappedProfile.prenom} ${mappedProfile.nom}`.trim(),
      };
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!normalizedEmail,
  });
}
