import { useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { supabase } from '@/integrations/supabase/client'
import { fromExtended } from '@/lib/supabaseTyped'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import {
  getPulseMediaSignedUrlOrThrow,
  getPulseMediaType,
  PULSE_MEDIA_ALLOWED_TYPES,
  PULSE_MEDIA_BUCKET,
  PULSE_MEDIA_MAX_FILE_SIZE,
  validatePulseMediaFile,
} from '@/lib/pulseMediaUrls'

interface UploadResult {
  id: string
  file_url: string
  thumbnail_url: string | null
  file_name: string
  file_type: 'image' | 'video' | 'audio' | 'document' | 'other'
  size_bytes: number
  mime_type: string
}

export function usePulseMedia(conversationId: string) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const uploadFile = useCallback(
    async (file: File, messageId: string): Promise<UploadResult | null> => {
      const validationError =
        file.size > PULSE_MEDIA_MAX_FILE_SIZE ? 'La taille maximale est de 50 Mo' : null
      if (validationError) {
        toast({
          title: validationError.includes('taille')
            ? 'Fichier trop volumineux'
            : 'Fichier non pris en charge',
          description: validationError,
          variant: 'destructive',
        })
        return null
      }

      setIsUploading(true)
      setUploadProgress(0)

      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
        const fileName = `${conversationId}/${messageId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(PULSE_MEDIA_BUCKET)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) throw uploadError

        setUploadProgress(70)

        // Bucket privé → URL signée courte, régénérée à la lecture pour chaque membre.
        const publicUrl = await getPulseMediaSignedUrlOrThrow(fileName)

        // Thumbnail = même URL pour les images (pour l'instant)
        let thumbnailUrl: string | null = null
        if (file.type.startsWith('image/')) {
          thumbnailUrl = publicUrl
        }

        setUploadProgress(90)

        // Create media record
        const mediaData = {
          message_id: messageId,
          file_url: publicUrl,
          thumbnail_url: thumbnailUrl,
          file_type: getPulseMediaType(file.type),
          file_name: file.name,
          size_bytes: file.size,
          mime_type: file.type,
          storage_path: fileName,
        }

        const { data: media, error: dbError } = await fromExtended('pulse_media')
          .insert(mediaData)
          .select()
          .single()

        if (dbError) throw dbError

        const mediaRecord = media as { id: string }
        setUploadProgress(100)

        toast({
          title: 'Fichier uploadé',
          description: file.name,
        })

        return {
          id: mediaRecord.id,
          file_url: publicUrl,
          thumbnail_url: thumbnailUrl,
          file_name: file.name,
          file_type: getPulseMediaType(file.type),
          size_bytes: file.size,
          mime_type: file.type,
        }
      } catch (error) {
        debug.error('Upload error:', error)
        const message = error instanceof Error ? error.message : "Impossible d'uploader le fichier"
        toast({
          title: "Erreur d'upload",
          description: sanitizeSupabaseError(error),
          variant: 'destructive',
        })
        return null
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    },
    [conversationId, toast]
  )

  const deleteFile = useCallback(
    async (mediaId: string, storagePath: string): Promise<boolean> => {
      try {
        // Delete from storage
        await supabase.storage.from(PULSE_MEDIA_BUCKET).remove([storagePath])

        // Delete record
        const { error } = await supabase.from('pulse_media').delete().eq('id', mediaId)

        if (error) throw error

        toast({
          title: 'Fichier supprimé',
        })

        return true
      } catch (error: unknown) {
        debug.error('Delete error:', error)
        toast({
          title: 'Erreur de suppression',
          description: sanitizeSupabaseError(error),
          variant: 'destructive',
        })
        return false
      }
    },
    [toast]
  )

  return {
    isUploading,
    uploadProgress,
    uploadFile,
    deleteFile,
    maxFileSize: PULSE_MEDIA_MAX_FILE_SIZE,
    allowedTypes: Object.keys(PULSE_MEDIA_ALLOWED_TYPES),
  }
}
