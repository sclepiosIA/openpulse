import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { DocumentFolder, CreateFolderData, UpdateFolderData, FolderWithSharing, FolderShareInfo } from "@/types/folders";

type RawUser = { prenom?: string | null; nom?: string | null; avatar_url?: string | null };
type RawGroup = { name?: string | null; color?: string | null };
type RawPermission = {
  user_id?: string | null;
  group_id?: string | null;
  access_level: FolderShareInfo['access_level'];
  user?: RawUser | RawUser[] | null;
  group?: RawGroup | RawGroup[] | null;
};

function mapPermissionsToShareInfo(permissions: RawPermission[] | unknown): FolderShareInfo[] {
  if (!Array.isArray(permissions)) return [];
  return (permissions as RawPermission[]).map((p) => {
    if (p.user_id && p.user) {
      const u = Array.isArray(p.user) ? p.user[0] : p.user;
      const name = u ? [u.prenom, u.nom].filter(Boolean).join(' ') || 'Utilisateur' : 'Utilisateur';
      return {
        type: 'user' as const,
        name,
        avatar_url: u?.avatar_url || null,
        access_level: p.access_level,
      };
    }
    if (p.group_id && p.group) {
      const g = Array.isArray(p.group) ? p.group[0] : p.group;
      return {
        type: 'group' as const,
        name: g?.name || 'Groupe',
        color: g?.color || null,
        access_level: p.access_level,
      };
    }
    return null;
  }).filter(Boolean) as FolderShareInfo[];
}

export function useFolders(parentFolderId?: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const foldersQuery = useQuery({
    queryKey: ['document-folders', parentFolderId],
    queryFn: async () => {
      let query = supabase
        .from('document_folders')
        .select(`
          id, name, parent_folder_id, owner_id, folder_type, related_etablissement_id, icon, color, color_tags, position, created_at, updated_at, is_restricted,
          document_folder_permissions(
            id, access_level, user_id, group_id,
            user:profiles!document_folder_permissions_user_id_fkey(id, nom, prenom, avatar_url),
            group:user_groups!document_folder_permissions_group_id_fkey(id, name, color)
          )
        `)
        .order('position')
        .order('name');
      
      if (parentFolderId === null) {
        query = query.is('parent_folder_id', null);
      } else if (parentFolderId) {
        query = query.eq('parent_folder_id', parentFolderId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      type FolderRow = Record<string, unknown> & { document_folder_permissions?: RawPermission[] };
      return ((data || []) as unknown as FolderRow[]).map((f) => {
        const perms = (f.document_folder_permissions as RawPermission[] | undefined) || [];
        return {
          ...f,
          permissions_count: perms.length,
          shared_with: mapPermissionsToShareInfo(perms),
          document_folder_permissions: undefined,
        };
      }) as unknown as FolderWithSharing[];

    }
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folderData: CreateFolderData) => {
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase
        .from('document_folders')
        .insert({
          name: folderData.name,
          parent_folder_id: folderData.parent_folder_id || null,
          owner_id: user.id,
          folder_type: folderData.folder_type || 'personal',
          related_etablissement_id: folderData.related_etablissement_id || null,
          icon: folderData.icon || null,
          color: folderData.color || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as DocumentFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      toast({
        title: "Dossier créé",
        description: "Le dossier a été créé avec succès"
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      });
    }
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateFolderData }) => {
      const { data: result, error } = await supabase
        .from('document_folders')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as DocumentFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      toast({
        title: "Dossier modifié",
        description: "Le dossier a été modifié avec succès"
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      });
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: "Dossier supprimé",
        description: "Le dossier et son contenu ont été supprimés"
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      });
    }
  });

  return {
    folders: foldersQuery.data || [],
    isLoading: foldersQuery.isLoading,
    error: foldersQuery.error,
    createFolder: createFolderMutation.mutate,
    updateFolder: updateFolderMutation.mutate,
    deleteFolder: deleteFolderMutation.mutate,
    isCreating: createFolderMutation.isPending,
    isUpdating: updateFolderMutation.isPending,
    isDeleting: deleteFolderMutation.isPending
  };
}

export function useFolderBreadcrumb(folderId: string | null) {
  return useQuery({
    queryKey: ['folder-breadcrumb', folderId],
    queryFn: async (): Promise<{ id: string | null; name: string }[]> => {
      if (!folderId) return [{ id: null, name: 'Mes documents' }];

      const breadcrumb: { id: string | null; name: string }[] = [];
      let currentId: string | null = folderId;
      const maxIterations = 20; // Prevent infinite loops
      let iterations = 0;

      while (currentId && iterations < maxIterations) {
        iterations++;
        const result = await supabase
          .from('document_folders')
          .select('id, name, parent_folder_id')
          .eq('id', currentId)
          .maybeSingle();
        
        if (result.error || !result.data) break;
        
        const folder = result.data as { id: string; name: string; parent_folder_id: string | null };
        breadcrumb.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_folder_id;
      }

      breadcrumb.unshift({ id: null, name: 'Mes documents' });
      return breadcrumb;
    },
    enabled: true
  });
}

export function useMoveToFolder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, folderId }: { documentId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from('documents')
        .update({ folder_id: folderId })
        .eq('id', documentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: "Document déplacé",
        description: "Le document a été déplacé avec succès"
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      });
    }
  });
}
