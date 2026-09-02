import type { Json } from '@/integrations/supabase/types'
/**
 * Écriture de la configuration d'instance, par lot.
 *
 * POURQUOI CE FICHIER EXISTE PLUTÔT QUE `useUpdateAppConfig`
 * Le hook historique fait un `update ... where key = …`. Or `app_config` est
 * créée VIDE par l'installation : aucune clé n'existe encore au premier
 * lancement. Un `update` sur une ligne absente n'échoue pas — il affecte zéro
 * ligne et rend `error: null`. L'assistant aurait donc affiché « Configuration
 * enregistrée » sans avoir rien écrit, et l'instance serait repartie avec
 * l'identité d'origine.
 *
 * Ce hook fait un `upsert` et VÉRIFIE ce qui a été écrit : il relit les clés
 * qu'il vient de poser et échoue si l'une d'elles manque. Une confirmation qui
 * ment coûte plus cher qu'une erreur franche.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

export interface EntreeConfiguration {
  cle: string
  valeur: Record<string, unknown>
  /** Regroupement d'affichage dans l'écran de configuration. */
  categorie?: string
  /** Phrase courte disant à quoi sert la clé, lue par l'administrateur. */
  description?: string
}

export function useEnregistrerConfiguration() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (entrees: EntreeConfiguration[]) => {
      if (!entrees.length) return

      const lignes = entrees.map((e) => ({
        key: e.cle,
        // La colonne est de type `Json` cote base ; le hook manipule un
        // enregistrement libre. La conversion est explicite plutot que subie.
        value: e.valeur as unknown as Json,
        category: e.categorie ?? 'general',
        description: e.description ?? null,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('app_config').upsert(lignes, { onConflict: 'key' })
      if (error) throw error

      // Relecture : la sécurité au niveau ligne peut refuser l'écriture sans
      // que le client le voie — une policy qui rejette rend zéro ligne, pas
      // une erreur. On confirme donc en lisant ce qui est réellement en base.
      const cles = entrees.map((e) => e.cle)
      const { data, error: erreurRelecture } = await supabase
        .from('app_config')
        .select('key')
        .in('key', cles)
      if (erreurRelecture) throw erreurRelecture

      const posees = new Set((data ?? []).map((l) => l.key))
      const manquantes = cles.filter((c) => !posees.has(c))
      if (manquantes.length) {
        throw new Error(
          `Ces réglages n'ont pas été enregistrés : ${manquantes.join(', ')}. ` +
            'Vérifiez que votre compte porte bien le rôle « administrateur ».'
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] })
      queryClient.invalidateQueries({ queryKey: ['configuration-instance'] })
    },
    onError: (error: Error) => {
      toast({
        title: "L'enregistrement a échoué",
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })
}
