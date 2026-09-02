/**
 * Rend l'identité de marque modifiable sans reconstruire l'application.
 *
 * POURQUOI CE FICHIER EXISTE
 * `src/config/branding.ts` décrit déjà toute l'identité — nom, logo, palette,
 * mentions légales, contacts — et le fait bien. Mais il lit des variables
 * `VITE_MARQUE_*`, que Vite fige DANS le paquet au moment de la construction :
 * un administrateur ne peut donc rien y changer depuis l'application. Pour
 * renommer son instance, il devait reconstruire — ce qu'un exploitant qui a
 * installé une image Docker ne peut pas faire.
 *
 * Ce fournisseur lit la clé `marque` d'`app_config` et la superpose aux valeurs
 * de construction. L'ordre de préséance, du plus fort au plus faible :
 *
 *   1. ce que l'administrateur a saisi dans l'application (`app_config`)
 *   2. ce que l'exploitant a passé à la construction (`VITE_MARQUE_*`)
 *   3. les valeurs neutres du module, qui ne désignent personne
 *
 * La palette est appliquée à chaud sur `document.documentElement` : le module
 * prévoyait déjà `appliquerPaletteMarque` pour cela, plus rien ne manquait que
 * quelqu'un pour l'appeler.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { MARQUE, appliquerPaletteMarque, type Marque, type PaletteMarque } from '@/config/branding'

/** Clé d'`app_config` où l'assistant de premier lancement écrit la marque. */
export const CLE_MARQUE = 'marque'

/** Forme partielle : l'administrateur ne renseigne que ce qu'il veut changer. */
export type MarquePartielle = {
  [K in keyof Marque]?: Marque[K] extends object ? Partial<Marque[K]> : Marque[K]
}

const ContexteMarque = createContext<Marque>(MARQUE)

/** L'identité en vigueur : saisie de l'administrateur si elle existe, sinon
 *  celle de la construction, sinon la valeur neutre. */
export function useMarque(): Marque {
  return useContext(ContexteMarque)
}

/** Superposition d'un seul niveau : les sous-objets fusionnent champ par champ,
 *  une chaîne vide ne masque jamais une valeur renseignée en dessous. */
function superposer(base: Marque, dessus: MarquePartielle | null | undefined): Marque {
  if (!dessus) return base
  const resultat: Record<string, unknown> = { ...base }

  for (const [cle, valeur] of Object.entries(dessus)) {
    if (valeur === null || valeur === undefined) continue
    if (typeof valeur === 'string') {
      if (valeur.trim() !== '') resultat[cle] = valeur
      continue
    }
    if (typeof valeur === 'object') {
      // Passer par `unknown` : tsc refuse la conversion directe de `Marque`
      // vers un enregistrement libre, et il a raison de la signaler — c'est
      // bien une perte d'information volontaire, le temps de la fusion.
      const socle = (base as unknown as Record<string, unknown>)[cle]
      const fusion: Record<string, unknown> = { ...(socle as Record<string, unknown>) }
      for (const [sousCle, sousValeur] of Object.entries(valeur as Record<string, unknown>)) {
        if (typeof sousValeur === 'string' && sousValeur.trim() === '') continue
        if (sousValeur === null || sousValeur === undefined) continue
        fusion[sousCle] = sousValeur
      }
      resultat[cle] = fusion
    }
  }
  // Idem au retour : la forme est reconstruite champ par champ, le
  // compilateur ne peut pas le savoir.
  return resultat as unknown as Marque
}

export function FournisseurMarque({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['marque'],
    queryFn: async (): Promise<MarquePartielle | null> => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', CLE_MARQUE)
        .maybeSingle()
      // Une lecture qui échoue ne doit pas priver l'application de son identité
      // de construction : on retombe dessus silencieusement.
      if (error) return null
      return (data?.value ?? null) as MarquePartielle | null
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const marque = useMemo(() => superposer(MARQUE, data), [data])

  useEffect(() => {
    if (typeof document === 'undefined') return
    appliquerPaletteMarque(document.documentElement, marque.palette as PaletteMarque)
  }, [marque])

  return <ContexteMarque.Provider value={marque}>{children}</ContexteMarque.Provider>
}

export default FournisseurMarque
