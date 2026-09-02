import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { SUPABASE_URL } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'

/**
 * Sanitise un nom de fichier pour le stockage Supabase
 * - Remplace les espaces par des underscores
 * - Supprime les caractères spéciaux (sauf ._-)
 * - Convertit en minuscules
 * - Préserve l'extension du fichier
 */
function sanitizeFileName(fileName: string): string {
  // Séparer le nom et l'extension
  const lastDotIndex = fileName.lastIndexOf('.')
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ''

  // Sanitiser le nom
  const sanitizedName = name
    .replace(/\s+/g, '_') // Espaces → underscores
    .replace(/[^a-zA-Z0-9._-]/g, '') // Supprimer caractères spéciaux
    .toLowerCase()

  // Sanitiser l'extension
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()

  return sanitizedName + sanitizedExtension
}

export interface RHDocument {
  id: string
  profile_id: string
  type_document: 'contrat' | 'bulletin_salaire' | 'attestation' | 'autre'
  titre: string
  description?: string
  fichier_url?: string
  storage_path?: string
  taille_octets?: number
  mime_type?: string
  date_document?: string
  created_at: string
  updated_at: string
}

export function useRHDocuments(profileId?: string) {
  const queryClient = useQueryClient()

  const { data: documents, isLoading } = useQuery({
    queryKey: ['rh-documents', profileId],
    queryFn: async () => {
      if (!profileId) return []

      const { data, error } = await supabase
        .from('rh_documents_employes')
        .select(
          'id, profile_id, type_document, titre, description, fichier_url, storage_path, taille_octets, mime_type, date_document, created_at, updated_at'
        )
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as RHDocument[]
    },
    enabled: !!profileId,
  })

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      profileId,
      typeDocument,
      titre,
      description,
      dateDocument,
    }: {
      file: File
      profileId: string
      typeDocument: RHDocument['type_document']
      titre: string
      description?: string
      dateDocument?: string
    }) => {
      // 1. Upload du fichier dans Storage avec nom vraiment unique
      const sanitizedName = sanitizeFileName(file.name)
      const uniqueId = crypto.randomUUID().split('-')[0] // 8 caractères aléatoires
      const fileName = `${Date.now()}_${uniqueId}_${sanitizedName}`
      const storagePath = `${profileId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('rh-documents')
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      // 2. Créer l'entrée dans la table (pas d'URL publique pour bucket privé)
      const { data, error } = await supabase
        .from('rh_documents_employes')
        .insert({
          profile_id: profileId,
          type_document: typeDocument,
          titre,
          description,
          storage_path: storagePath,
          taille_octets: file.size,
          mime_type: file.type,
          date_document: dateDocument,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-documents'] })
      toast.success('Document uploadé avec succès')
    },
    onError: (error) => {
      toast.error("Erreur lors de l'upload du document")
      debug.error('Error uploading RH document:', error)
    },
  })

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      // 1. Récupérer le storage_path
      const { data: doc } = await supabase
        .from('rh_documents_employes')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle()

      // 2. Supprimer du storage
      if (doc?.storage_path) {
        await supabase.storage.from('rh-documents').remove([doc.storage_path])
      }

      // 3. Supprimer de la table
      const { error } = await supabase.from('rh_documents_employes').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-documents'] })
      toast.success('Document supprimé')
    },
    onError: () => {
      toast.error('Erreur lors de la suppression')
    },
  })

  const getDocumentUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('rh-documents')
      .createSignedUrl(storagePath, 3600) // 1 heure d'expiration

    if (error) throw error

    // Construire l'URL complète si Supabase retourne un chemin relatif
    if (data?.signedUrl) {
      // Si c'est déjà une URL complète, la retourner telle quelle
      if (data.signedUrl.startsWith('http')) {
        return data.signedUrl
      }

      // Sinon, construire l'URL complète
      return `${SUPABASE_URL}/storage/v1${data.signedUrl}`
    }

    return null
  }

  return {
    documents,
    isLoading,
    uploadDocument: uploadDocument.mutateAsync,
    deleteDocument: deleteDocument.mutateAsync,
    getDocumentUrl,
  }
}
