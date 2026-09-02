import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

/**
 * Chargement du contenu d'un document rédigé.
 *
 * Symétrique de `useNativeDocumentSave` : le contenu vit dans
 * `documents.content` et non plus dans un service Nextcloud absent de la
 * distribution. Voir l'en-tête de ce hook-là pour la mesure.
 *
 * LE PARAMÈTRE A CHANGÉ DE NATURE, ET C'EST VOULU
 * L'ancienne signature recevait un `storagePath`. Une page n'en a pas — la
 * contrainte `documents_fichier_ou_page` l'interdit même. On charge donc par
 * IDENTIFIANT de document, qui est ce que les écrans ont réellement sous la
 * main. Les appelants qui passaient un chemin doivent passer `document.id`.
 */
export function useNativeDocumentLoad() {
  const [isLoading, setIsLoading] = useState(false);

  const loadContent = useCallback(async (documentId: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .maybeSingle();

      if (error) throw error;

      // `content` nul signifie que la ligne est un FICHIER, pas une page : son
      // contenu est dans le stockage, et cet éditeur n'a pas à le rendre. On
      // renvoie null plutôt que la chaîne vide, pour que l'appelant distingue
      // « rien à afficher » d'« une page vide ».
      const contenu = (data as { content?: string | null } | null)?.content;
      return contenu ?? null;
    } catch (err) {
      debug.error('Échec du chargement du document rédigé :', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { loadContent, isLoading };
}
