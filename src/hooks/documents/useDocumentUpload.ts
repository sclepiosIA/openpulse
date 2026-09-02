import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { DocumentUploadProgress, DocumentUploadOptions } from '@/types/documents'
import { format } from 'date-fns'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'
import { completeDriveUpload, fetchDriveSpaces, requestDriveUploadIntent } from '@/lib/drive/driveClient'
import { driveErrorMessage } from '@/lib/drive/errors'

const DOCUMENTS_QUERY_KEY = 'documents'
const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
const DOCUMENTS_SUPABASE_BUCKET = 'documents'
type UploadBackend = 'nextcloud' | 'supabase' | 'azure'

type StorageUploadResult = {
  storagePath: string
  storageBucket: string
  backend: UploadBackend
}

function getDocumentsUploadBackend(): 'auto' | UploadBackend {
  const raw = (import.meta.env.VITE_DOCUMENTS_UPLOAD_BACKEND || 'auto').toLowerCase()
  return raw === 'nextcloud' || raw === 'supabase' || raw === 'azure' ? raw : 'auto'
}

// Convertir un fichier en base64 pour l'envoi vers Nextcloud
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadToNextcloud(file: File, storagePath: string): Promise<StorageUploadResult> {
  const base64Content = await fileToBase64(file)
  const { data: nextcloudResult, error: nextcloudError } = await supabase.functions.invoke(
    'nextcloud-files',
    {
      body: {
        action: 'upload',
        path: `/${storagePath}`,
        content: base64Content,
        contentType: file.type || 'application/octet-stream',
      },
    }
  )

  if (nextcloudError) {
    debug.error('Erreur Nextcloud:', nextcloudError)
    throw new Error(`Erreur upload Nextcloud: ${nextcloudError.message}`)
  }

  if (nextcloudResult?.error) {
    debug.error('Erreur Nextcloud:', nextcloudResult.error)
    throw new Error(`Erreur upload Nextcloud: ${nextcloudResult.error}`)
  }

  return { storagePath: `/${storagePath}`, storageBucket: 'nextcloud', backend: 'nextcloud' }
}

async function uploadToSupabaseStorage(file: File, storagePath: string): Promise<StorageUploadResult> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_SUPABASE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) {
    debug.error('Erreur Supabase Storage documents:', error)
    throw new Error(`Erreur upload Storage: ${error.message}`)
  }

  return { storagePath, storageBucket: DOCUMENTS_SUPABASE_BUCKET, backend: 'supabase' }
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function selectDefaultDriveSpaceId(): Promise<string> {
  const spaces = await fetchDriveSpaces()
  const syncable = spaces.find((space) => space.sync_policy === 'allowed')
  const fallback = syncable ?? spaces[0]
  if (!fallback) throw new Error('Aucun espace Gestion Drive disponible pour l’upload')
  return fallback.id
}

async function uploadToAzureDrive(file: File, storagePath: string): Promise<StorageUploadResult> {
  try {
    const spaceId = await selectDefaultDriveSpaceId()
    const sha256 = await sha256Hex(file)
    const intent = await requestDriveUploadIntent({
      space_id: spaceId,
      path: storagePath,
      size_bytes: file.size,
      sha256,
      content_type: file.type || 'application/octet-stream',
    })

    if (intent.action === 'noop') {
      return { storagePath, storageBucket: 'azure-drive', backend: 'azure' }
    }
    if (intent.action === 'conflict') {
      throw new Error(
        intent.conflict_reason
          ? `Conflit de version Gestion Drive : ${intent.conflict_reason}`
          : 'Conflit de version Gestion Drive : le fichier a été modifié entre-temps.'
      )
    }
    if (!intent.upload_url || !intent.upload_token) {
      throw new Error("Réponse d'upload incomplète côté API Gestion Drive.")
    }

    let uploadResponse: Response
    try {
      uploadResponse = await fetch(intent.upload_url, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })
    } catch {
      throw new Error('Téléversement vers le stockage Azure impossible (réseau).')
    }
    if (!uploadResponse.ok) {
      throw new Error(`Téléversement Azure refusé (HTTP ${uploadResponse.status}).`)
    }

    await completeDriveUpload({
      upload_token: intent.upload_token,
      file_id: intent.file_id,
      version: intent.version,
      sha256,
      etag: uploadResponse.headers.get('etag') ?? undefined,
      size_bytes: file.size,
    })

    return { storagePath, storageBucket: 'azure-drive', backend: 'azure' }
  } catch (error) {
    // Normalise les erreurs Drive (DriveApiError → message FR actionnable).
    throw new Error(driveErrorMessage(error))
  }
}

async function uploadDocumentBlob(file: File, storagePath: string): Promise<StorageUploadResult> {
  const backend = getDocumentsUploadBackend()

  if (backend === 'azure') {
    // Fallback legacy propre : si Gestion Drive échoue (API down, SAS refusée…),
    // on retombe sur Supabase Storage pour ne jamais bloquer l'utilisateur.
    // L'erreur Azure d'origine est conservée si le fallback échoue aussi.
    try {
      return await uploadToAzureDrive(file, storagePath)
    } catch (azureError) {
      debug.warn?.('[Documents] Azure Drive upload failed, falling back to Supabase Storage', azureError)
      try {
        return await uploadToSupabaseStorage(file, storagePath)
      } catch (storageError) {
        debug.warn?.('[Documents] Supabase Storage fallback failed after Azure failure', storageError)
        throw azureError instanceof Error ? azureError : storageError
      }
    }
  }
  if (backend === 'supabase') return uploadToSupabaseStorage(file, storagePath)
  if (backend === 'nextcloud') return uploadToNextcloud(file, storagePath)

  try {
    return await uploadToNextcloud(file, storagePath)
  } catch (nextcloudError) {
    debug.warn?.('[Documents] Nextcloud upload failed, falling back to Supabase Storage', nextcloudError)
    try {
      return await uploadToSupabaseStorage(file, storagePath)
    } catch (storageError) {
      debug.warn?.('[Documents] Supabase Storage fallback failed after Nextcloud failure', storageError)
      throw nextcloudError instanceof Error ? nextcloudError : storageError
    }
  }
}

export function useDocumentUpload() {
  const { user } = useAuth()
  const [uploads, setUploads] = useState<DocumentUploadProgress[]>([])
  const queryClient = useQueryClient()

  const updateUploadProgress = useCallback(
    (file: File, updates: Partial<DocumentUploadProgress>) => {
      setUploads((prev) => prev.map((u) => (u.file === file ? { ...u, ...updates } : u)))
    },
    []
  )

  const uploadMutation = useMutation({
    mutationFn: async ({ file, options }: { file: File; options?: DocumentUploadOptions }) => {
      if (!user) throw new Error('Non authentifié')

      // Validation taille
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
      }

      // Générer le chemin de stockage
      const dateFolder = format(new Date(), 'yyyy-MM')
      const fileId = crypto.randomUUID()
      const extension = file.name.split('.').pop() || 'bin'
      const storagePath = `${dateFolder}/${fileId}.${extension}`

      updateUploadProgress(file, { status: 'uploading', progress: 10 })

      const storage = await uploadDocumentBlob(file, storagePath)
      updateUploadProgress(file, { progress: 60 })

      // Créer l'entrée dans la table documents
      // Note: folder_id is handled by DB trigger if not provided (auto-assigns to "Autres documents")
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
          storage_path: storage.storagePath,
          storage_bucket: storage.storageBucket,
          description: options?.description || null,
          tags: options?.tags || null,
          source_type: 'direct_upload',
          created_by: user.id,
          folder_id: options?.folderId || null, // Will be auto-assigned by DB trigger if null
        })
        .select()
        .single()

      if (dbError) {
        // Rollback: supprimer le fichier uploadé si possible
        try {
          if (storage.backend === 'nextcloud') {
            await supabase.functions.invoke('nextcloud-files', {
              body: { action: 'delete', path: storage.storagePath },
            })
          } else {
            await supabase.storage.from(storage.storageBucket).remove([storage.storagePath])
          }
        } catch (rollbackError) {
          debug.error(
            storage.backend === 'nextcloud' ? 'Erreur rollback Nextcloud:' : 'Erreur rollback upload document:',
            rollbackError
          )
        }
        throw dbError
      }

      updateUploadProgress(file, { progress: 80 })

      // Créer les relations si spécifiées
      if (options) {
        const relationData: Record<string, unknown> = {
          document_id: document.id,
          relation_type: options.relationType || 'attachment',
          created_by: user.id,
        }

        if (options.relatedEtablissementId) {
          relationData.related_etablissement_id = options.relatedEtablissementId
        }
        if (options.relatedTacheId) {
          relationData.related_tache_id = options.relatedTacheId
        }
        if (options.relatedProfileId) {
          relationData.related_profile_id = options.relatedProfileId
        }
        if (options.relatedGroupeId) {
          relationData.related_groupe_id = options.relatedGroupeId
        }
        if (options.relatedPartenaireId) {
          relationData.related_partenaire_id = options.relatedPartenaireId
        }
        if (options.relatedEmailThreadId) {
          relationData.related_email_thread_id = options.relatedEmailThreadId
        }
        if (options.relatedRdUserStoryId) {
          relationData.related_rd_user_story_id = options.relatedRdUserStoryId
        }
        if (options.relatedSupportTicketId) {
          relationData.related_support_ticket_id = options.relatedSupportTicketId
        }

        // Si au moins une relation est spécifiée
        const hasRelation = Object.keys(relationData).some(
          (k) => k.startsWith('related_') && relationData[k]
        )

        if (hasRelation) {
          await supabase.from('document_relations').insert(relationData as never)
        }
      }

      // Log audit
      await supabase.from('document_audit_log').insert({
        document_id: document.id,
        action: 'created',
        performed_by: user.id,
        new_value: {
          name: file.name,
          size: file.size,
          mime_type: file.type,
        },
      })

      updateUploadProgress(file, { progress: 100, status: 'success', documentId: document.id })

      return document
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
    },
    onError: (error, variables) => {
      debug.error('Erreur upload:', error)
      updateUploadProgress(variables.file, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    },
  })

  const uploadFile = useCallback(
    async (file: File, options?: DocumentUploadOptions) => {
      // Ajouter le fichier à la liste des uploads
      setUploads((prev) => [
        ...prev,
        {
          file,
          progress: 0,
          status: 'pending',
        },
      ])

      const result = await uploadMutation.mutateAsync({ file, options })
      return result
    },
    [uploadMutation]
  )

  const uploadFiles = useCallback(
    async (files: File[], options?: DocumentUploadOptions) => {
      const results = []

      for (const file of files) {
        try {
          const result = await uploadFile(file, options)
          results.push(result)
        } catch (error) {
          debug.error(`Erreur upload ${file.name}:`, error)
        }
      }

      const successCount = results.length
      const errorCount = files.length - successCount

      if (successCount > 0 && errorCount === 0) {
        toast.success(
          `${successCount} document${successCount > 1 ? 's' : ''} uploadé${successCount > 1 ? 's' : ''}`
        )
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(
          `${successCount} uploadé${successCount > 1 ? 's' : ''}, ${errorCount} échec${errorCount > 1 ? 's' : ''}`
        )
      } else if (errorCount > 0) {
        toast.error(`Échec de l'upload de ${errorCount} fichier${errorCount > 1 ? 's' : ''}`)
      }

      return results
    },
    [uploadFile]
  )

  const clearUploads = useCallback(() => {
    setUploads([])
  }, [])

  const removeUpload = useCallback((file: File) => {
    setUploads((prev) => prev.filter((u) => u.file !== file))
  }, [])

  return {
    uploads,
    uploadFile,
    uploadFiles,
    clearUploads,
    removeUpload,
    isUploading: uploadMutation.isPending,
  }
}

export function useDocumentDownload() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (document: {
      id: string
      // Nullable : une PAGE n'a pas de chemin de stockage, son contenu vit en
      // base. Le typage l'exigeait, si bien que le compilateur refusait de
      // passer un document quelconque — et, sans le typage, on aurait demandé
      // au stockage une URL signée pour un chemin nul.
      storage_path: string | null | undefined
      storage_bucket: string
      name: string
    }) => {
      if (!user) throw new Error('Non authentifié')
      if (!document.storage_path) {
        // Refus explicite : une page se lit dans l'éditeur, elle ne se
        // télécharge pas depuis le stockage. Sans ce garde-fou, l'appel partait
        // avec un chemin nul et rendait une erreur du service de stockage, qui
        // ne nomme pas la vraie cause.
        throw new Error(
          "Ce document est une page rédigée : son contenu est en base, pas dans le stockage."
        )
      }

      let signedUrl: string

      // Vérifier si le fichier est sur Nextcloud ou Supabase Storage
      if (document.storage_bucket === 'nextcloud') {
        // Télécharger depuis Nextcloud via Edge Function
        const { data, error } = await supabase.functions.invoke('nextcloud-files', {
          body: { action: 'download', path: document.storage_path },
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        // Décoder le base64 et créer un blob URL
        const binaryString = atob(data.content)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: data.mimeType })
        signedUrl = URL.createObjectURL(blob)
      } else {
        // Utiliser Supabase Storage (rétrocompatibilité)
        const { data, error } = await supabase.storage
          .from(document.storage_bucket)
          .createSignedUrl(document.storage_path, 60) // 60 secondes

        if (error) throw error
        if (!data?.signedUrl) throw new Error("Impossible de générer l'URL de téléchargement")
        signedUrl = data.signedUrl
      }

      // Log audit
      await supabase.from('document_audit_log').insert({
        document_id: document.id,
        action: 'downloaded',
        performed_by: user.id,
      })

      // Déclencher le téléchargement
      const link = window.document.createElement('a')
      link.href = signedUrl
      link.download = document.name
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)

      // Révoquer l'URL blob si c'était un fichier Nextcloud
      if (document.storage_bucket === 'nextcloud') {
        setTimeout(() => URL.revokeObjectURL(signedUrl), 1000)
      }

      return signedUrl
    },
    onError: (error) => {
      debug.error('Erreur téléchargement:', error)
      toast.error('Erreur lors du téléchargement')
    },
  })
}

export function useDocumentPreviewUrl(
  document: { storage_path: string; storage_bucket: string } | null
) {
  const [url, setUrl] = useState<string | null>(null)

  const getUrl = useCallback(async () => {
    if (!document) return null

    try {
      // Vérifier si le fichier est sur Nextcloud ou Supabase Storage
      if (document.storage_bucket === 'nextcloud') {
        // Pour Nextcloud, télécharger le fichier et créer un blob URL
        const { data, error } = await supabase.functions.invoke('nextcloud-files', {
          body: { action: 'download', path: document.storage_path },
        })

        if (error) {
          debug.error('Erreur génération URL preview Nextcloud:', error)
          return null
        }

        if (data?.error) {
          debug.error('Erreur Nextcloud:', data.error)
          return null
        }

        // Décoder le base64 et créer un blob URL
        const binaryString = atob(data.content)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: data.mimeType })
        const blobUrl = URL.createObjectURL(blob)
        setUrl(blobUrl)
        return blobUrl
      } else {
        // Utiliser Supabase Storage (rétrocompatibilité)
        const { data, error } = await supabase.storage
          .from(document.storage_bucket)
          .createSignedUrl(document.storage_path, 3600) // 1 heure

        if (error) {
          debug.error('Erreur génération URL preview:', error)
          return null
        }

        setUrl(data?.signedUrl || null)
        return data?.signedUrl || null
      }
    } catch (error) {
      debug.error('Erreur génération URL preview:', error)
      return null
    }
  }, [document])

  return { url, getUrl }
}
