import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { debug } from '@/lib/debug';
import { useAuth } from "@/components/AuthProvider";

/**
 * Enregistrement d'un document rédigé dans l'application.
 *
 * POURQUOI CE HOOK A ÉTÉ REBRANCHÉ
 * Il envoyait le contenu à Nextcloud, par la fonction `nextcloud-files`. Or
 * AUCUN service Nextcloud n'existe dans cette distribution : les compositions
 * ne déclarent que la base, l'API REST, l'authentification, le temps réel, le
 * stockage, les fonctions, la passerelle et l'application.
 *
 * Conséquence : sur une installation OpenPulse, tout enregistrement d'un
 * document, d'un tableur ou d'une présentation échouait. L'écran affichait
 * « Erreur lors de la sauvegarde », sans dire que le service visé n'existe
 * pas. Le téléversement de fichier, lui, fonctionnait — il passe par le
 * stockage Supabase. Trois éditeurs sur trois étaient donc inutilisables sans
 * que rien ne l'annonce.
 *
 * Le contenu est désormais écrit dans `documents.content`, la colonne posée
 * par supabase/schema-08-pages.sql. Cette colonne sert aussi au wiki : une
 * page rédigée et un document natif sont la même chose vue de la base, ce qui
 * évite deux arborescences, deux jeux de droits et deux recherches.
 *
 * CE QUE LA CONTRAINTE IMPOSE
 * `documents_fichier_ou_page` exige qu'une ligne porte `storage_path` OU
 * `content`, jamais les deux. On ne renseigne donc PAS `storage_path` ici.
 * `file_size_bytes` reste renseigné : les écrans l'affichent, et rien
 * n'interdit de connaître la taille d'une page.
 *
 * `content` est de type `text` : PostgreSQL y accepte jusqu'à 1 Go. La limite
 * pratique est celle de l'éditeur, pas celle de la colonne.
 */

interface UseNativeDocumentSaveOptions {
  documentName: string;
  mimeType: string;
  /**
   * Conservée pour la compatibilité des appelants. Elle servait à composer un
   * chemin de fichier Nextcloud ; le contenu vivant maintenant en base, elle
   * n'entre plus dans aucun calcul.
   */
  extension?: string;
  folderId?: string | null;
  existingDocumentId?: string;
}

/**
 * Lire un Blob en texte.
 *
 * `Blob.prototype.text()` serait plus court, mais il n'existe pas partout :
 * l'environnement de test l'ignore, et il a manqué à Safari jusqu'en 2020.
 * Le code d'origine passait déjà par `FileReader` pour cette raison — la
 * conclusion tient toujours, même si l'encodage visé a changé.
 */
function blobEnTexte(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result ?? ''));
    lecteur.onerror = () => reject(lecteur.error ?? new Error('lecture impossible'));
    lecteur.readAsText(blob);
  });
}

interface SaveState {
  documentId: string | null;
  storagePath: string | null;
  isSaving: boolean;
}

export function useNativeDocumentSave({
  documentName,
  mimeType,
  folderId = null,
  existingDocumentId,
}: UseNativeDocumentSaveOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SaveState>({
    documentId: existingDocumentId || null,
    storagePath: null,
    isSaving: false,
  });
  // Les rappels asynchrones doivent voir l'état courant, pas celui capturé au
  // rendu qui les a créés.
  const stateRef = useRef(state);
  stateRef.current = state;

  const save = useCallback(async (content: Blob) => {
    if (stateRef.current.isSaving) return;
    setState(prev => ({ ...prev, isSaving: true }));

    try {
      if (!user) throw new Error('Non authentifié');

      // Les trois éditeurs transmettent du texte — HTML pour le traitement de
      // texte, JSON pour le tableur et la présentation. On le lit tel quel :
      // le passage par base64 n'avait de sens que pour un transport HTTP.
      const texte = await blobEnTexte(content);
      // `Blob.size` compte les octets une fois encodé en UTF-8 : c'est bien la
      // taille que les écrans affichent, pas le nombre de caractères.
      const taille = new Blob([texte]).size;

      if (!stateRef.current.documentId) {
        const { data: doc, error: dbError } = await supabase
          .from('documents')
          .insert({
            name: documentName,
            content: texte,
            file_size_bytes: taille,
            mime_type: mimeType,
            source_type: 'native_editor',
            created_by: user.id,
            folder_id: folderId || null,
          } as never)
          .select('id')
          .single();

        if (dbError) throw dbError;

        // Journal d'audit : utile mais jamais bloquant. Un document enregistré
        // dont la trace manque vaut mieux qu'un enregistrement refusé.
        try {
          await supabase.from('document_audit_log').insert({
            document_id: doc.id,
            action: 'created',
            performed_by: user.id,
            details: { source: 'native_editor', mime_type: mimeType },
          } as never);
        } catch {
          // non bloquant
        }

        setState({ documentId: doc.id, storagePath: null, isSaving: false });
        queryClient.invalidateQueries({ queryKey: ['documents'] });
      } else {
        const { error: dbError } = await supabase
          .from('documents')
          .update({
            content: texte,
            file_size_bytes: taille,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', stateRef.current.documentId);

        if (dbError) throw dbError;

        try {
          await supabase.from('document_audit_log').insert({
            document_id: stateRef.current.documentId,
            action: 'updated',
            performed_by: user.id,
            details: { source: 'native_editor' },
          } as never);
        } catch {
          // non bloquant
        }

        setState(prev => ({ ...prev, isSaving: false }));
        queryClient.invalidateQueries({ queryKey: ['documents'] });
      }
    } catch (err: unknown) {
      debug.error('Échec de l’enregistrement du document :', err);
      // Le message porte la cause quand la base en donne une : « Erreur lors de
      // la sauvegarde » seul laissait l'utilisateur sans recours, et c'est
      // exactement ce qui a masqué l'absence de Nextcloud pendant si longtemps.
      const cause = err instanceof Error ? err.message : String(err);
      toast.error(`Enregistrement impossible : ${cause}`);
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [documentName, mimeType, folderId, queryClient, user]);

  return {
    save,
    documentId: state.documentId,
    storagePath: state.storagePath,
    isSaving: state.isSaving,
  };
}
