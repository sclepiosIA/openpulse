import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import { toast } from 'sonner'

export interface EmailFolder {
  id: string
  user_id: string
  name: string
  color: string
  icon: string | null
  parent_id: string | null
  position: number
  created_at: string
  updated_at: string
}

const FOLDERS_KEY = ['email-folders'] as const
const COUNTS_KEY = ['email-folder-counts'] as const

export function useEmailFolders() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const foldersQuery = useQuery({
    queryKey: [...FOLDERS_KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<EmailFolder[]> => {
      const { data, error } = await (supabase as any)
        .from('email_folders')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as EmailFolder[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const countsQuery = useQuery({
    queryKey: [...COUNTS_KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await (supabase as any).rpc('get_email_folder_counts')
      if (error) throw error
      const map: Record<string, number> = {}
      for (const row of (data ?? []) as Array<{ folder_id: string; thread_count: number }>) {
        map[row.folder_id] = Number(row.thread_count) || 0
      }
      return map
    },
    staleTime: 60 * 1000,
  })

  // Realtime updates
  useEffect(() => {
    if (!user?.id) return
    const suffix = crypto.randomUUID()
    const foldersChannel = supabase
      .channel(`email-folders-${user.id}-${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_folders', filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: [...FOLDERS_KEY, user.id] })
        }
      )
      .subscribe()
    const threadFoldersChannel = supabase
      .channel(`email-thread-folders-${user.id}-${suffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_thread_folders',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: [...COUNTS_KEY, user.id] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(foldersChannel)
      supabase.removeChannel(threadFoldersChannel)
    }
  }, [user?.id, qc])

  const createFolder = useMutation({
    mutationFn: async (input: {
      name: string
      color: string
      icon?: string | null
      parent_id?: string | null
    }) => {
      if (!user?.id) throw new Error('Non authentifié')
      const { data, error } = await (supabase as any)
        .from('email_folders')
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          color: input.color,
          icon: input.icon ?? null,
          parent_id: input.parent_id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as EmailFolder
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...FOLDERS_KEY, user?.id] })
      toast.success('Dossier créé')
    },
    onError: (e: any) => {
      const msg = e?.message?.includes('email_folders_name_unique')
        ? 'Un dossier avec ce nom existe déjà'
        : e?.message || 'Erreur de création'
      toast.error(msg)
    },
  })

  const updateFolder = useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      color?: string
      icon?: string | null
      parent_id?: string | null
      position?: number
    }) => {
      const { id, ...patch } = input
      const { data, error } = await (supabase as any)
        .from('email_folders')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as EmailFolder
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...FOLDERS_KEY, user?.id] })
      toast.success('Dossier mis à jour')
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('email_folders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...FOLDERS_KEY, user?.id] })
      qc.invalidateQueries({ queryKey: [...COUNTS_KEY, user?.id] })
      toast.success('Dossier supprimé')
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })

  return {
    folders: foldersQuery.data ?? [],
    counts: countsQuery.data ?? {},
    isLoading: foldersQuery.isLoading,
    isError: foldersQuery.isError,
    createFolder,
    updateFolder,
    deleteFolder,
  }
}
