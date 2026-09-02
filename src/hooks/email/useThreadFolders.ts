import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import { toast } from 'sonner'

export interface ThreadFolderLink {
  thread_id: string
  folder_id: string
  user_id: string
  added_at: string
}

/** Dossiers d'un thread donné */
export function useThreadFolders(threadId: string | null | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['thread-folders', threadId, user?.id],
    enabled: !!threadId && !!user?.id,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any)
        .from('email_thread_folders')
        .select('folder_id')
        .eq('thread_id', threadId!)
      if (error) throw error
      return ((data ?? []) as Array<{ folder_id: string }>).map((r) => r.folder_id)
    },
    staleTime: 30 * 1000,
  })
}

/** Threads rangés dans un dossier */
export function useFolderThreads(folderId: string | null | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['folder-threads', folderId, user?.id],
    enabled: !!folderId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('email_thread_folders')
        .select('thread_id, added_at')
        .eq('folder_id', folderId!)
        .order('added_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Array<{ thread_id: string; added_at: string }>
    },
    staleTime: 30 * 1000,
  })
}

export function useThreadFolderMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const invalidate = (threadIds: string[]) => {
    qc.invalidateQueries({ queryKey: ['email-folder-counts', user?.id] })
    qc.invalidateQueries({ queryKey: ['folder-threads'] })
    for (const tid of threadIds) {
      qc.invalidateQueries({ queryKey: ['thread-folders', tid, user?.id] })
    }
  }

  const addThreadsToFolder = useMutation({
    mutationFn: async ({ threadIds, folderId }: { threadIds: string[]; folderId: string }) => {
      if (!user?.id) throw new Error('Non authentifié')
      const rows = threadIds.map((tid) => ({
        thread_id: tid,
        folder_id: folderId,
        user_id: user.id,
      }))
      const { error } = await (supabase as any)
        .from('email_thread_folders')
        .upsert(rows, { onConflict: 'thread_id,folder_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      invalidate(vars.threadIds)
      toast.success(vars.threadIds.length > 1 ? 'Fils rangés dans le dossier' : 'Fil rangé')
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })

  const removeThreadFromFolder = useMutation({
    mutationFn: async ({ threadId, folderId }: { threadId: string; folderId: string }) => {
      const { error } = await (supabase as any)
        .from('email_thread_folders')
        .delete()
        .eq('thread_id', threadId)
        .eq('folder_id', folderId)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      invalidate([vars.threadId])
      toast.success('Retiré du dossier')
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })

  const setThreadFolders = useMutation({
    mutationFn: async ({ threadId, folderIds }: { threadId: string; folderIds: string[] }) => {
      if (!user?.id) throw new Error('Non authentifié')
      // Récupère l'état actuel
      const { data: current, error: e1 } = await (supabase as any)
        .from('email_thread_folders')
        .select('folder_id')
        .eq('thread_id', threadId)
      if (e1) throw e1
      const currentIds = new Set(
        ((current ?? []) as Array<{ folder_id: string }>).map((r) => r.folder_id)
      )
      const nextIds = new Set(folderIds)
      const toAdd = [...nextIds].filter((id) => !currentIds.has(id))
      const toRemove = [...currentIds].filter((id) => !nextIds.has(id))

      if (toAdd.length > 0) {
        const rows = toAdd.map((fid) => ({ thread_id: threadId, folder_id: fid, user_id: user.id }))
        const { error } = await (supabase as any)
          .from('email_thread_folders')
          .upsert(rows, { onConflict: 'thread_id,folder_id', ignoreDuplicates: true })
        if (error) throw error
      }
      if (toRemove.length > 0) {
        const { error } = await (supabase as any)
          .from('email_thread_folders')
          .delete()
          .eq('thread_id', threadId)
          .in('folder_id', toRemove)
        if (error) throw error
      }
    },
    onSuccess: (_d, vars) => {
      invalidate([vars.threadId])
      toast.success('Dossiers mis à jour')
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })

  return { addThreadsToFolder, removeThreadFromFolder, setThreadFolders }
}
