import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from "@/lib/debug";
import { useAuth } from "@/components/AuthProvider";

export interface RHOnboardingDocument {
  id: string;
  onboarding_id: string | null;
  profile_id: string;
  document_type: string;
  document_label: string | null;
  nom_fichier: string;
  chemin_fichier: string;
  taille_octets: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Type pour les données d'insertion (sans les champs auto-générés)
interface RHOnboardingDocumentInsert {
  onboarding_id: string | null;
  profile_id: string;
  document_type: string;
  document_label: string | null;
  nom_fichier: string;
  chemin_fichier: string;
  taille_octets: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
}

// Hook pour récupérer les documents d'un profil
export function useRHOnboardingDocuments(profileId?: string) {
  return useQuery({
    queryKey: ['rh-onboarding-documents', profileId],
    queryFn: async (): Promise<RHOnboardingDocument[]> => {
      if (!profileId) return [];
      
      // Utilisation de rpc ou requête brute pour les tables non typées
      const { data, error } = await supabase
        .from('rh_onboarding_documents' as 'profiles') // Cast vers une table connue pour éviter l'erreur de type
        .select('id, onboarding_id, profile_id, document_type, document_label, nom_fichier, chemin_fichier, taille_octets, mime_type, uploaded_by, created_at, updated_at')
        .eq('profile_id' as never, profileId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as RHOnboardingDocument[];
    },
    enabled: !!profileId
  });
}

// Hook pour uploader un document
export function useUploadRHOnboardingDocument() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      file, 
      profileId, 
      onboardingId,
      documentType,
      documentLabel
    }: {
      file: File;
      profileId: string;
      onboardingId?: string | null;
      documentType: string;
      documentLabel?: string;
    }): Promise<RHOnboardingDocument> => {
      // 1. Upload du fichier dans Storage
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${profileId}/${documentType}/${timestamp}_${sanitizedName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('rh-onboarding-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique (signée)
      supabase.storage
        .from('rh-onboarding-documents')
        .getPublicUrl(fileName);

      // 3. Créer l'entrée dans la table
      if (!user?.id) {
        throw new Error('Utilisateur non authentifié');
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const insertData: RHOnboardingDocumentInsert = {
        onboarding_id: onboardingId ?? null,
        profile_id: profileId,
        document_type: documentType,
        document_label: documentLabel ?? null,
        nom_fichier: file.name,
        chemin_fichier: fileName,
        taille_octets: file.size,
        mime_type: file.type,
        uploaded_by: profile?.id ?? null
      };

      // Cast pour les tables non présentes dans les types générés
      const { data, error } = await supabase
        .from('rh_onboarding_documents' as 'profiles')
        .insert(insertData as never)
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from insert');
      return data as unknown as RHOnboardingDocument;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['rh-onboarding-documents', variables.profileId] 
      });
      toast.success("Document uploadé avec succès");
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de l'upload du document");
      debug.error(error);
    }
  });
}

// Hook pour télécharger un document
export async function downloadRHOnboardingDocument(cheminFichier: string, nomFichier: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from('rh-onboarding-documents')
      .download(cheminFichier);

    if (error) throw error;

    // Créer un lien de téléchargement
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomFichier;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success("Document téléchargé");
  } catch (error) {
    toast.error("Erreur lors du téléchargement");
    debug.error(error);
  }
}

// Hook pour supprimer un document
export function useDeleteRHOnboardingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cheminFichier, profileId }: { 
      id: string; 
      cheminFichier: string;
      profileId: string;
    }): Promise<string> => {
      // 1. Supprimer du storage
      await supabase.storage
        .from('rh-onboarding-documents')
        .remove([cheminFichier]);

      // 2. Supprimer de la table
      const { error } = await supabase
        .from('rh_onboarding_documents' as 'profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      return profileId;
    },
    onSuccess: (profileId) => {
      queryClient.invalidateQueries({ 
        queryKey: ['rh-onboarding-documents', profileId] 
      });
      toast.success("Document supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    }
  });
}
