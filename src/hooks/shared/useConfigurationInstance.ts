/**
 * État de configuration de l'instance.
 *
 * POURQUOI CE FICHIER EXISTE
 * Une instance fraîchement installée porte encore l'identité de l'éditeur
 * d'origine : nom de société, coordonnées, adresses d'expédition, mentions des
 * documents. Rien n'échoue pour autant — les écrans s'affichent, les factures
 * se génèrent — mais elles sortent au nom de quelqu'un d'autre. C'est une
 * dégradation silencieuse, et la plus coûteuse à découvrir tard.
 *
 * L'assistant de premier lancement force donc le passage : tant que la clé
 * `instance_configuree` est absente, l'administrateur ne voit que lui.
 *
 * Le marqueur vit dans `app_config` comme le reste de la configuration : une
 * seule table à sauvegarder, une seule à restaurer.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

/** Clé du marqueur dans `app_config`. */
export const CLE_INSTANCE_CONFIGUREE = 'instance_configuree'

export interface InstanceConfiguree {
  /** Vrai une fois l'assistant mené à son terme. */
  fait: boolean
  /** Horodatage ISO-8601 de la fin de l'assistant. */
  le?: string
  /** Compte qui a mené la configuration, pour la traçabilité. */
  par?: string
  /** Version de l'assistant, pour rejouer une étape ajoutée plus tard. */
  version?: number
}

/** Version courante de l'assistant. À incrémenter si une étape est ajoutée. */
export const VERSION_ASSISTANT = 1

export function useConfigurationInstance() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['configuration-instance'],
    queryFn: async (): Promise<InstanceConfiguree> => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', CLE_INSTANCE_CONFIGUREE)
        .maybeSingle()

      // Une erreur de lecture ne doit pas ouvrir l'assistant à tort : on ne
      // sait pas si l'instance est configurée, et la relancer écraserait une
      // configuration existante. En cas de doute, on la considère faite.
      if (error) throw error

      const valeur = (data?.value ?? null) as InstanceConfiguree | null
      return valeur ?? { fait: false }
    },
    // La réponse conditionne l'affichage de toute l'application : on ne la
    // remet pas en cause à chaque montage.
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  return {
    /** Vrai tant que la réponse n'est pas connue : n'affichez rien entre-temps. */
    chargement: isLoading,
    /** Vrai si l'assistant doit être présenté. */
    aConfigurer: !isLoading && !error && data?.fait !== true,
    /** Vrai si la lecture a échoué : on n'ouvre pas l'assistant dans le doute. */
    indetermine: Boolean(error),
    configuration: data,
  }
}
