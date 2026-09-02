import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'

export interface RDAttachment {
  id: string
  entity_type: 'user_story' | 'task' | 'epic' | 'projet'
  entity_id: string
  nom: string
  taille: number | null
  type_mime: string | null
  storage_path: string
  uploaded_by: string | null
  created_at: string
}

const BUCKET_NAME = 'rd-attachments'

export function useRDAttachments(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['rd-attachments', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return []

      const { data, error } = await supabase
        .from('rd_attachments')
        .select(
          'id, entity_type, entity_id, nom, taille, type_mime, storage_path, uploaded_by, created_at'
        )
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as RDAttachment[]
    },
    enabled: !!entityId,
  })
}

export function useUploadRDAttachment() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      file,
    }: {
      entityType: string
      entityId: string
      file: File
    }) => {
      // Get current user
      if (!user) throw new Error('Non authentifié')

      // Generate unique path
      const fileExt = file.name.split('.').pop()
      const fileName = `${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file)

      if (uploadError) throw uploadError

      // Create record in database
      const { data, error } = await supabase
        .from('rd_attachments')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          nom: file.name,
          taille: file.size,
          type_mime: file.type,
          storage_path: fileName,
          uploaded_by: user.id,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['rd-attachments', variables.entityType, variables.entityId],
      })
      toast.success('Fichier ajouté')
    },
    onError: (error) => {
      debug.error('Upload error:', error)
      toast.error("Erreur lors de l'upload")
    },
  })
}

export function useDeleteRDAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (attachment: RDAttachment) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([attachment.storage_path])

      if (storageError) {
        debug.error('Storage deletion error:', storageError)
        // Continue anyway to clean up database record
      }

      // Delete from database
      const { error } = await supabase.from('rd_attachments').delete().eq('id', attachment.id)

      if (error) throw error
    },
    onSuccess: (_, attachment) => {
      queryClient.invalidateQueries({
        queryKey: ['rd-attachments', attachment.entity_type, attachment.entity_id],
      })
      toast.success('Fichier supprimé')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    },
  })
}

export function useGetAttachmentUrl() {
  return async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    if (error) {
      debug.error('Error getting signed URL:', error)
      return null
    }

    return data.signedUrl
  }
}
