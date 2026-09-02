import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'

/**
 * Détecte les IDs synthétiques (non-uuid) qui ne doivent pas être envoyés à PostgREST :
 * - "portal-..." : tâches du portail client (table client_portal_tasks, pas de documents)
 * - "...:occ:..." / "..._occ_..." : occurrences virtuelles de tâches récurrentes
 */
function isVirtualTaskId(id: string | undefined | null): boolean {
  if (!id) return true
  return id.startsWith('portal-') || id.includes('_occ_') || id.includes(':occ:')
}

export interface TacheDocument {
  id: string
  tache_id: string
  nom_fichier: string
  chemin_fichier: string
  type_mime?: string
  taille_fichier?: number
  uploaded_by?: string
  created_at: string
  updated_at: string
  version_number?: number
  is_latest_version?: boolean
  previous_version_id?: string
  document_type?: string
  source_type?: string
  source_reference?: string
  auto_detected?: boolean
  detection_confidence?: number
  metadata?: Record<string, unknown>;
}

export function useTachesDocuments(tacheId: string) {
  return useQuery({
    queryKey: ['taches-documents', tacheId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taches_documents')
        .select('id, tache_id, nom_fichier, chemin_fichier, type_mime, taille_fichier, document_type, version_number, is_latest_version, previous_version_id, source_type, source_reference, auto_detected, detection_confidence, metadata, uploaded_by, created_at, updated_at')
        .eq('tache_id', tacheId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        // Pas de toast global ici : ce hook est consommé par plusieurs pages
        // (notifications, api-developer, ia-usage, automatisations/*) qui ne devraient
        // pas afficher d'erreur "documents" quand l'utilisateur n'a pas accès aux
        // taches_documents (cas RLS courant). Laisser le composant consommateur
        // gérer l'état d'erreur via React Query si besoin.
        debug.warn('[useTachesDocuments] fetch error (silenced toast):', error)
        throw error
      }

      return data as TacheDocument[]
    },
    enabled: !!tacheId && !isVirtualTaskId(tacheId),
    retry: false,
  })
}

export function useUploadTacheDocument() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ 
      tacheId, 
      file, 
      currentUserId,
      tacheInfo 
    }: { 
      tacheId: string; 
      file: File; 
      currentUserId: string;
      tacheInfo?: { titre: string; etablissement_id: string }
    }) => {
      // Upload file to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${tacheId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('taches-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Save document metadata
      const { data, error } = await supabase
        .from('taches_documents')
        .insert({
          tache_id: tacheId,
          nom_fichier: file.name,
          chemin_fichier: filePath,
          type_mime: file.type,
          taille_fichier: file.size,
          uploaded_by: currentUserId
        })
        .select()
        .single()

      if (error) throw error
      
      // Automatic analysis for medical-economic studies
      // ANY PDF uploaded to a task with "medico" in title is automatically analyzed
      const normalizedTitle = tacheInfo?.titre ? tacheInfo.titre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''
      const isEME = normalizedTitle.includes('etude medico economique')
      const isPDF = file.type === 'application/pdf';
      
      debug.log('🔍 Document upload:', {
        tacheTitre: tacheInfo?.titre,
        isEME,
        isPDF,
        fileType: file.type,
        fileName: file.name,
        etablissementId: tacheInfo?.etablissement_id,
        documentId: data.id
      });
      
      // If it's an EME task, analyze it (analyze all file types)
      if (isEME) {
        if (!tacheInfo?.etablissement_id) {
          debug.error('❌ Cannot analyze: missing etablissement_id');
        } else {
          debug.log('📊 🚀 Launching automatic AI analysis for medical-economic study');
          
          // Call analysis function asynchronously (non-blocking)
          supabase.functions.invoke('analyze-medical-economic-study', {
            body: { 
              document_id: data.id,
              file_path: data.chemin_fichier,
              etablissement_id: tacheInfo.etablissement_id
            }
          }).then((result) => {
            if (result.error) {
              debug.error('❌ AI analysis failed:', result.error);
            } else {
              debug.log('✅ AI analysis completed successfully:', result.data);
            }
          }).catch((err) => {
            debug.error('❌ AI analysis exception:', err);
          });
        }
      }
      
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['taches-documents', variables.tacheId] })
      toast({
        title: "Succès",
        description: "Document uploadé avec succès"
      })
    },
    onError: (error) => {
      debug.error('Error uploading document:', error)
      toast({
        title: "Erreur",
        description: "Impossible d'uploader le document",
        variant: "destructive"
      })
    },
  })
}

export function useDeleteTacheDocument(etablissementId?: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ documentId, filePath }: { documentId: string; filePath: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('taches-documents')
        .remove([filePath])

      if (storageError) throw storageError

      // Delete from database
      const { error } = await supabase
        .from('taches_documents')
        .delete()
        .eq('id', documentId)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate both taches-documents queries and establishment-documents queries
      queryClient.invalidateQueries({ queryKey: ['taches-documents'] })
      if (etablissementId) {
        queryClient.invalidateQueries({ queryKey: ['etablissement-documents', etablissementId] })
      }
      toast({
        title: "Succès",
        description: "Document supprimé avec succès"
      })
    },
    onError: (error) => {
      debug.error('Error deleting document:', error)
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document",
        variant: "destructive"
      })
    },
  })
}

export function useDocumentVersionHistory(tacheId: string, documentType: string) {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['document-version-history', tacheId, documentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taches_documents')
        .select('id, tache_id, nom_fichier, chemin_fichier, type_mime, taille_fichier, document_type, version_number, is_latest_version, previous_version_id, source_type, source_reference, auto_detected, detection_confidence, metadata, uploaded_by, created_at, updated_at')
        .eq('tache_id', tacheId)
        .eq('document_type', documentType)
        .order('version_number', { ascending: false })
        .limit(50)

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger l'historique",
          variant: "destructive"
        })
        throw error
      }

      return data as TacheDocument[]
    },
    enabled: !!tacheId && !!documentType && !isVirtualTaskId(tacheId),
  })
}

export async function getDocumentUrl(filePath: string) {
  // Use signed URL for secure access since bucket is now private
  const { data, error } = await supabase.storage
    .from('taches-documents')
    .createSignedUrl(filePath, 3600) // 1 hour expiry
    
  if (error) {
    debug.error('Error creating signed URL:', error)
    return null
  }
  
  return data.signedUrl
}