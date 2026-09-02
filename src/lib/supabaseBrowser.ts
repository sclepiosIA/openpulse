import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { debug } from '@/lib/debug'
import type { Database } from '@/integrations/supabase/types'
import { isThirdPartyIframe, isApercuTiers } from './iframeDetection'
import { authPersistenceStorage } from './authPersistenceStorage'

export { configureAuthSessionPersistence } from './authPersistenceStorage'

/**
 * Client de donnees cote navigateur (OpenPulse).
 *
 * CONTRAT DE LA DISTRIBUTION AUTO-HEBERGEABLE : ce module ne doit JAMAIS lever
 * d'exception pendant son evaluation. Il est atteint depuis src/main.tsx via
 * src/App.tsx puis src/integrations/supabase/client.ts, donc pendant
 * l'evaluation du graphe de modules : une exception ici se produit AVANT le
 * try/catch de src/main.tsx (qui affiche "Erreur de chargement de
 * l'application") et laisse une page blanche muette. Une instance mal
 * configuree doit demarrer en mode degrade et rester diagnosticable.
 *
 * CONTRAT DE TESTS a preserver (src/lib/supabaseBrowser.deep.test.ts,
 * .deep2, .deep3, src/lib/__tests__/supabaseBrowser.test.ts) :
 *  - createClient est appele EXACTEMENT une fois a l'import du module ;
 *  - il est appele avec (SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage,
 *    persistSession, autoRefreshToken, detectSessionInUrl, flowType } }) ;
 *  - le storage route les nouvelles sessions vers localStorage (30 jours) ou
 *    sessionStorage selon le choix explicite de connexion ;
 *  - `supabase` est la valeur RETOURNEE par createClient (pas un mandataire
 *    paresseux) et getSupabaseClient() renvoie la meme instance ;
 *  - isApercuTiers() est appele une fois, isThirdPartyIframe()
 *    seulement si l'on n'est pas dans un apercu tiers ;
 *  - le seul appel a debug.warn est '[Supabase] localStorage unavailable:'.
 * Le diagnostic de configuration passe donc par console.warn, pas par
 * debug.warn, pour ne pas fausser ces comptages.
 *
 * Les variables VITE_* sont de la configuration publique de build. Aucun
 * secret de service ne doit apparaitre ici.
 */

// Replis volontairement non routables (domaines reserves RFC 2606 / RFC 6761).
// Ils servent uniquement a garder createClient constructible : aucune requete
// ne peut aboutir tant que l'organisation n'a pas renseigne ses variables.
const URL_DONNEES_NON_CONFIGUREE = 'https://donnees-non-configurees.invalid'
const CLE_ANONYME_NON_CONFIGUREE = 'cle-anonyme-non-configuree'

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || URL_DONNEES_NON_CONFIGUREE

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || CLE_ANONYME_NON_CONFIGUREE

/**
 * Vrai quand les deux variables publiques de build sont renseignees.
 * Les ecrans peuvent s'en servir pour afficher un etat "non configure"
 * plutot que d'enchainer des erreurs reseau.
 */
export const configurationDonneesPresente: boolean =
  SUPABASE_URL !== URL_DONNEES_NON_CONFIGUREE && SUPABASE_ANON_KEY !== CLE_ANONYME_NON_CONFIGUREE

if (!configurationDonneesPresente) {
  console.warn(
    '[OpenPulse] Configuration des donnees incomplete : VITE_SUPABASE_URL et/ou ' +
      "VITE_SUPABASE_PUBLISHABLE_KEY sont absentes du build. L'application demarre " +
      "en mode degrade, aucune requete de donnees n'aboutira. Renseignez ces deux " +
      'variables puis reconstruisez le paquet.'
  )
}

// Verifier si localStorage est disponible (peut etre bloque dans une iframe tierce)
const isStorageAvailable = (): boolean => {
  // Environnement d'apercu de confiance : toujours essayer d'utiliser le storage
  const dansApercuTiers = isApercuTiers()

  // Pour les autres iframes tierces, supposer que le storage n'est pas disponible
  if (!dansApercuTiers && isThirdPartyIframe()) return false

  try {
    if (typeof localStorage === 'undefined') return false
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    if (import.meta.env.DEV) {
      debug.warn('[Supabase] localStorage unavailable:', e)
    }
    return false
  }
}

const storageAvailable = isStorageAvailable()

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: storageAvailable ? authPersistenceStorage : undefined,
      persistSession: storageAvailable,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)

export function getSupabaseClient(): SupabaseClient<Database> {
  return supabase
}
