import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import { toast } from 'sonner'
import type {
  DocumentShare,
  FolderPermission,
  PermissionLevel,
} from '@/types/documents/permissions'

// ==================== Document Shares ====================

export function useDocumentShares(documentId: string | null) {
  return useQuery({
    queryKey: ['document-shares', documentId],
    enabled: !!documentId,
    queryFn: async (): Promise<DocumentShare[]> => {
      const { data, error } = await supabase
        .from('document_shares')
        .select(
          `
          id,
          document_id,
          shared_with_user_id,
          shared_with_group_id,
          permission_level,
          shared_by,
          shared_at,
          expires_at,
          shared_with_group:user_groups!document_shares_shared_with_group_id_fkey(id, name, description, color)
        `
        )
        .eq('document_id', documentId!)

      if (error) throw error

      // Fetch user profiles for shares that have shared_with_user_id
      // shared_with_user_id references auth.users, but profiles.user_id = auth.users.id
      const userShares = (data || []).filter((d) => d.shared_with_user_id)
      const userIds = userShares.map((d) => d.shared_with_user_id!)

      const profilesMap: Record<
        string,
        {
          id: string
          nom: string | null
          prenom: string | null
          email: string
          avatar_url: string | null
        }
      > = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_id, nom, prenom, email, avatar_url')
          .in('user_id', userIds)
        if (profiles) {
          for (const p of profiles) {
            profilesMap[p.user_id] = p
          }
        }
      }

      // Fetch shared_by user profiles
      const sharedByIds = [...new Set((data || []).map((d) => d.shared_by))]
      const sharedByMap: Record<string, { id: string; nom: string | null; prenom: string | null }> =
        {}
      if (sharedByIds.length > 0) {
        const { data: byProfiles } = await supabase
          .from('profiles')
          .select('id, user_id, nom, prenom')
          .in('user_id', sharedByIds)
        if (byProfiles) {
          for (const p of byProfiles) {
            sharedByMap[p.user_id] = p
          }
        }
      }

      if (error) throw error

      return (data || []).map((d) => ({
        ...d,
        permission_level: d.permission_level as PermissionLevel,
        shared_with_user: d.shared_with_user_id
          ? profilesMap[d.shared_with_user_id] || undefined
          : undefined,
        shared_by_user: sharedByMap[d.shared_by] || null,
        shared_with_group: Array.isArray(d.shared_with_group)
          ? d.shared_with_group[0]
          : d.shared_with_group,
      }))
    },
  })
}

export function useShareDocument() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: {
      documentId: string
      documentName?: string
      userId?: string
      groupId?: string
      permissionLevel: PermissionLevel
    }) => {
      const { error } = await supabase.from('document_shares').insert({
        document_id: data.documentId,
        shared_with_user_id: data.userId || null,
        shared_with_group_id: data.groupId || null,
        permission_level: data.permissionLevel,
        shared_by: user!.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['document-shares', vars.documentId] })
      toast.success('Document partagé')

      // Fire email notification (non-blocking)
      supabase.functions
        .invoke('notify-document-shared', {
          body: {
            type: 'document',
            resourceName: data.documentName || 'Document',
            resourceId: data.documentId,
            recipientUserIds: data.userId ? [data.userId] : undefined,
            recipientGroupId: data.groupId || undefined,
            permissionLevel: data.permissionLevel,
            sharedByUserId: user!.id,
          },
        })
        .catch((err) => console.warn('[share-notify] Email notification failed:', err))
    },
    onError: () => toast.error('Erreur lors du partage'),
  })
}

export function useUpdateDocumentShare() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      shareId,
      permissionLevel,
      documentId,
    }: {
      shareId: string
      permissionLevel: PermissionLevel
      documentId: string
    }) => {
      const { error } = await supabase
        .from('document_shares')
        .update({ permission_level: permissionLevel })
        .eq('id', shareId)
      if (error) throw error
      return documentId
    },
    onSuccess: (documentId) => {
      queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })
      toast.success('Permission modifiée')
    },
    onError: () => toast.error('Erreur lors de la modification'),
  })
}

export function useUnshareDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ shareId, documentId }: { shareId: string; documentId: string }) => {
      const { error } = await supabase.from('document_shares').delete().eq('id', shareId)
      if (error) throw error
      return documentId
    },
    onSuccess: (documentId) => {
      queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })
      toast.success('Partage retiré')
    },
    onError: () => toast.error('Erreur lors du retrait'),
  })
}

// ==================== Folder Permissions ====================

export function useFolderPermissions(folderId: string | null) {
  return useQuery({
    queryKey: ['folder-permissions', folderId],
    enabled: !!folderId,
    queryFn: async (): Promise<FolderPermission[]> => {
      const { data, error } = await supabase
        .from('document_folder_permissions')
        .select(
          `
          id,
          folder_id,
          user_id,
          group_id,
          access_level,
          granted_by,
          created_at,
          user:profiles!document_folder_permissions_user_id_fkey(id, nom, prenom, email, avatar_url),
          group:user_groups!document_folder_permissions_group_id_fkey(id, name, description, color)
        `
        )
        .eq('folder_id', folderId!)

      if (error) throw error

      return (data || []).map((d) => ({
        ...d,
        access_level: d.access_level as PermissionLevel,
        user: Array.isArray(d.user) ? d.user[0] : d.user,
        group: Array.isArray(d.group) ? d.group[0] : d.group,
      }))
    },
  })
}

export function useSetFolderPermission() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: {
      folderId: string
      folderName?: string
      userId?: string
      groupId?: string
      accessLevel: PermissionLevel
    }) => {
      const { error } = await supabase.from('document_folder_permissions').insert({
        folder_id: data.folderId,
        user_id: data.userId || null,
        group_id: data.groupId || null,
        access_level: data.accessLevel,
        granted_by: user!.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['folder-permissions', vars.folderId] })
      toast.success('Permission ajoutée')

      // Fire email notification (non-blocking)
      supabase.functions
        .invoke('notify-document-shared', {
          body: {
            type: 'folder',
            resourceName: data.folderName || 'Dossier',
            resourceId: data.folderId,
            recipientUserIds: data.userId ? [data.userId] : undefined,
            recipientGroupId: data.groupId || undefined,
            permissionLevel: data.accessLevel,
            sharedByUserId: user!.id,
          },
        })
        .catch((err) => console.warn('[share-notify] Email notification failed:', err))
    },
    onError: () => toast.error("Erreur lors de l'ajout de permission"),
  })
}

export function useRemoveFolderPermission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ permissionId, folderId }: { permissionId: string; folderId: string }) => {
      const { error } = await supabase
        .from('document_folder_permissions')
        .delete()
        .eq('id', permissionId)
      if (error) throw error
      return folderId
    },
    onSuccess: (folderId) => {
      queryClient.invalidateQueries({ queryKey: ['folder-permissions', folderId] })
      toast.success('Permission retirée')
    },
    onError: () => toast.error('Erreur lors du retrait'),
  })
}
