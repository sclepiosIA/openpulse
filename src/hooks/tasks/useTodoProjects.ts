import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

export interface TodoProject {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_shared: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  members?: TodoProjectMember[];
}

export interface TodoProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  added_at: string;
  added_by: string | null;
  user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_shared?: boolean;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  is_shared?: boolean;
  position?: number;
}

export const todoProjectKeys = {
  all: ['todo-projects'] as const,
  list: () => [...todoProjectKeys.all, 'list'] as const,
  detail: (id: string) => [...todoProjectKeys.all, 'detail', id] as const,
};

export function useTodoProjects() {
  const { data: profile } = useCurrentProfile();

  return useQuery({
    queryKey: todoProjectKeys.list(),
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('todo_projects')
        .select('id, owner_id, name, description, color, icon, is_shared, position, created_at, updated_at')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        debug.error('Error fetching todo projects:', error);
        throw error;
      }

      return (data || []).map(p => ({
        ...p,
        color: p.color || '#6366f1',
        icon: p.icon || 'folder',
        is_shared: p.is_shared || false,
        position: p.position || 0,
      })) as TodoProject[];
    },
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
  });
}

export function useTodoProject(id: string | undefined) {
  const { data: profile } = useCurrentProfile();

  return useQuery({
    queryKey: todoProjectKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('todo_projects')
        .select('id, owner_id, name, description, color, icon, is_shared, position, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        debug.error('Error fetching todo project:', error);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        color: data.color || '#6366f1',
        icon: data.icon || 'folder',
        is_shared: data.is_shared || false,
        position: data.position || 0,
      } as TodoProject;
    },
    enabled: !!id && !!profile?.id,
  });
}

export function useCreateTodoProject() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data: maxPos } = await supabase
        .from('todo_projects')
        .select('position')
        .eq('owner_id', profile.id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newPosition = (maxPos?.position ?? -1) + 1;

      const { data, error } = await supabase
        .from('todo_projects')
        .insert({
          owner_id: profile.id,
          name: input.name,
          description: input.description || null,
          color: input.color || '#6366f1',
          icon: input.icon || 'folder',
          is_shared: input.is_shared || false,
          position: newPosition,
        })
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.all });
      toast.success('Projet créé');
    },
    onError: (error) => {
      debug.error('Error creating project:', error);
      toast.error('Erreur lors de la création');
    },
  });
}

export function useUpdateTodoProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProjectInput) => {
      const updateData: Record<string, unknown> = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.is_shared !== undefined) updateData.is_shared = input.is_shared;
      if (input.position !== undefined) updateData.position = input.position;

      const { data, error } = await supabase
        .from('todo_projects')
        .update(updateData as never)
        .eq('id', input.id)
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.all });
    },
    onError: (error) => {
      debug.error('Error updating project:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });
}

export function useDeleteTodoProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('todo_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.all });
      toast.success('Projet supprimé');
    },
    onError: (error) => {
      debug.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression');
    },
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({ projectId, email, role = 'member' }: { projectId: string; email: string; role?: 'admin' | 'member' }) => {
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (userError || !targetUser) {
        throw new Error('Utilisateur non trouvé');
      }

      const { data, error } = await supabase
        .from('todo_project_members')
        .insert({
          project_id: projectId,
          user_id: targetUser.id,
          role,
          added_by: profile?.id,
        })
        .select()
        // safe: guaranteed-row
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Cet utilisateur est déjà membre');
        }
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.list() });
      toast.success('Membre ajouté');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, memberId }: { projectId: string; memberId: string }) => {
      const { error } = await supabase
        .from('todo_project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: todoProjectKeys.list() });
      toast.success('Membre retiré');
    },
    onError: (error) => {
      debug.error('Error removing member:', error);
      toast.error('Erreur lors de la suppression');
    },
  });
}
