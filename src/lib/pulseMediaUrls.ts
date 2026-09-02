import { supabase } from '@/integrations/supabase/client'
import type { PulseMedia } from '@/types/pulse'

export const PULSE_MEDIA_BUCKET = 'pulse-media'
export const PULSE_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365
export const PULSE_MEDIA_MAX_FILE_SIZE = 50 * 1024 * 1024

export const PULSE_MEDIA_ALLOWED_TYPES: Record<string, PulseMedia['file_type']> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
}

export const PULSE_MEDIA_ACCEPT = [
  'image/*',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
].join(',')

export function getPulseMediaType(mimeType: string): PulseMedia['file_type'] {
  return PULSE_MEDIA_ALLOWED_TYPES[mimeType] || 'other'
}

export function validatePulseMediaFile(file: File): string | null {
  if (file.size > PULSE_MEDIA_MAX_FILE_SIZE) {
    return 'La taille maximale est de 50 Mo'
  }

  if (!PULSE_MEDIA_ALLOWED_TYPES[file.type]) {
    return 'Type de fichier non pris en charge'
  }

  return null
}

export async function getPulseMediaSignedUrl(
  storagePath: string | null | undefined,
  options?: { downloadFileName?: string }
): Promise<string | null> {
  if (!storagePath) return null

  const bucket = supabase.storage.from(PULSE_MEDIA_BUCKET)

  if (typeof bucket.createSignedUrl !== 'function') {
    return bucket.getPublicUrl?.(storagePath).data.publicUrl ?? null
  }

  const { data, error } = await supabase.storage
    .from(PULSE_MEDIA_BUCKET)
    .createSignedUrl(
      storagePath,
      PULSE_MEDIA_SIGNED_URL_TTL_SECONDS,
      options?.downloadFileName ? { download: options.downloadFileName } : undefined
    )

  if (error) return null
  return data?.signedUrl ?? null
}

export async function getPulseMediaSignedUrlOrThrow(storagePath: string): Promise<string> {
  const bucket = supabase.storage.from(PULSE_MEDIA_BUCKET)

  if (typeof bucket.createSignedUrl !== 'function') {
    const publicUrl = bucket.getPublicUrl?.(storagePath).data.publicUrl
    if (!publicUrl) throw new Error('Impossible de générer le lien du fichier')
    return publicUrl
  }

  const { data, error } = await bucket.createSignedUrl(
    storagePath,
    PULSE_MEDIA_SIGNED_URL_TTL_SECONDS
  )
  if (error) throw error
  if (!data?.signedUrl) throw new Error('Impossible de générer le lien du fichier')
  return data.signedUrl
}

export async function refreshPulseMediaUrls<T extends { media?: PulseMedia[] }>(
  messages: T[]
): Promise<T[]> {
  return Promise.all(
    messages.map(async (message) => {
      if (!message.media?.length) return message

      const media = await Promise.all(
        message.media.map(async (item) => {
          const signedUrl = await getPulseMediaSignedUrl(item.storage_path)
          if (!signedUrl) return item

          return {
            ...item,
            file_url: signedUrl,
            thumbnail_url: item.file_type === 'image' ? signedUrl : item.thumbnail_url,
          }
        })
      )

      return { ...message, media }
    })
  )
}
