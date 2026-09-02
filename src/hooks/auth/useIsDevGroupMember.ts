import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

/**
 * Hook to check if the current user is a member of the "dev" group
 */
export function useIsDevGroupMember() {
  const { user } = useAuth();

  const { data: isMember = false, isLoading } = useQuery({
    queryKey: ["is-dev-group-member", user?.id],
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // 30 min cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_group_members")
        .select(`
          id,
          group:user_groups!inner(name)
        `)
        .eq("user_id", user!.id);

      if (error) return false;

      // Check if any group is named "dev" (case-insensitive)
      return (data || []).some((m: { group?: { name?: string } | { name?: string }[] | null }) => {
        const g = Array.isArray(m.group) ? m.group[0] : m.group;
        const groupName = g?.name || "";
        return groupName.toLowerCase() === "dev" || groupName.toLowerCase() === "développeurs";
      });
    },
  });

  return { isDevMember: isMember, isLoading };
}
