import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/shared/useAuth";
import { toast } from "sonner";
import type { UserGroupWithMembers, UserGroupMember } from "@/types/documents/permissions";

export function useUserGroups() {
  return useQuery({
    queryKey: ['user-groups'],
    queryFn: async (): Promise<UserGroupWithMembers[]> => {
      const { data: groups, error } = await supabase
        .from('user_groups')
        .select('id, name, description, color, created_by, created_at, updated_at')
        .order('name');

      if (error) throw error;

      // Fetch member counts
      const { data: members, error: membersError } = await supabase
        .from('user_group_members')
        .select('group_id, user_id');

      if (membersError) throw membersError;

      return (groups || []).map(g => ({
        ...g,
        members: [],
        member_count: (members || []).filter(m => m.group_id === g.id).length,
      }));
    },
  });
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['user-group-members', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<UserGroupMember[]> => {
      const { data, error } = await supabase
        .from('user_group_members')
        .select(`
          id,
          group_id,
          user_id,
          added_by,
          added_at,
          profile:profiles!user_group_members_user_id_fkey(id, nom, prenom, email, avatar_url)
        `)
        .eq('group_id', groupId!);

      if (error) throw error;

      return (data || []).map(m => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const { error } = await supabase
        .from('user_groups')
        .insert({
          name: data.name,
          description: data.description || null,
          color: data.color || '#6366f1',
          created_by: user!.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success("Groupe créé");
    },
    onError: () => toast.error("Erreur lors de la création du groupe"),
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string }) => {
      const { error } = await supabase
        .from('user_groups')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success("Groupe modifié");
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success("Groupe supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase
        .from('user_group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          added_by: user!.id,
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user-group-members', vars.groupId] });
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success("Membre ajouté");
    },
    onError: () => toast.error("Erreur lors de l'ajout du membre"),
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, groupId }: { memberId: string; groupId: string }) => {
      const { error } = await supabase
        .from('user_group_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      return groupId;
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ['user-group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      toast.success("Membre retiré");
    },
    onError: () => toast.error("Erreur lors du retrait"),
  });
}
