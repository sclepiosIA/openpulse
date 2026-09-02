/**
 * OpenPulse — en-tetes CORS partages des fonctions de bord.
 *
 * Principe du socle : une instance n'accepte que les origines que son
 * exploitant a declarees. Aucun domaine n'est code en dur ici, et le
 * caractere generique n'est jamais emis.
 *
 * Declaration cote exploitant (liste separee par des virgules) :
 *
 *   OPENPULSE_ORIGINES_AUTORISEES="https://gestion.example.org,https://preprod.example.org"
 *
 * L'ancien nom CORS_ALLOWED_ORIGINS reste lu en second recours, pour ne pas
 * casser un deploiement qui l'utilise deja.
 *
 * Deux exports, conserves a l'identique pour les appelants existants :
 *
 *   - getCorsHeaders(origine) — forme recommandee. Renvoie l'origine de la
 *     requete si et seulement si elle figure dans la liste autorisee.
 *   - corsHeaders — constante historique. Elle ne vaut PLUS '*'. Elle est
 *     figee au chargement du module sur la premiere origine autorisee. C'est
 *     ce qui ferme d'un coup les fonctions qui l'utilisent encore depuis une
 *     fonction d'aide declaree au niveau module, la ou 'req' n'existe pas et
 *     ou aucune reecriture mecanique n'est possible.
 *
 * Un '*' place dans la liste est ignore : on ne peut pas rouvrir le CORS a
 * tout le monde par une simple variable d'environnement.
 */

const CLE_ENV_ORIGINES = 'OPENPULSE_ORIGINES_AUTORISEES';
const CLE_ENV_ORIGINES_HERITEE = 'CORS_ALLOWED_ORIGINS';

/** Origines servies quand aucune variable n'est definie : developpement local seul. */
const ORIGINES_DEVELOPPEMENT: readonly string[] = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
];

const EN_TETES_ACCEPTES =
  'authorization, x-client-info, apikey, content-type, x-internal-secret';
const METHODES_ACCEPTEES = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const DUREE_CACHE_PREVOL = '86400';

/**
 * Valeur emise quand la liste autorisee est vide explicitement. Aucun
 * navigateur ne presente 'null' comme origine pour une page servie en
 * http(s) : le partage est donc refuse, sans jamais retomber sur '*'.
 */
const ORIGINE_REFUSEE = 'null';

function lireEnv(cle: string): string | undefined {
  try {
    return Deno.env.get(cle);
  } catch {
    // Fonction executee sans --allow-env : on retombe sur les valeurs par defaut.
    return undefined;
  }
}

/**
 * Liste des origines autorisees, relue a chaque appel pour que la
 * configuration de l'instance soit la seule source de verite.
 */
export function listerOriginesAutorisees(): string[] {
  const brut = lireEnv(CLE_ENV_ORIGINES) ?? lireEnv(CLE_ENV_ORIGINES_HERITEE);

  if (brut === undefined) {
    return [...ORIGINES_DEVELOPPEMENT];
  }

  return brut
    .split(',')
    .map((origine) => origine.trim())
    .filter((origine) => origine.length > 0 && origine !== '*');
}

/**
 * En-tetes CORS pour une requete donnee.
 *
 * @param requestOrigin valeur brute de l'en-tete Origin de la requete.
 * @returns en-tetes prets a etre etales dans une Response.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const autorisees = listerOriginesAutorisees();
  const repli = autorisees.length > 0 ? autorisees[0] : ORIGINE_REFUSEE;
  const demandee = (requestOrigin ?? '').trim();
  const origine = demandee.length > 0 && autorisees.includes(demandee) ? demandee : repli;

  return {
    'Access-Control-Allow-Origin': origine,
    'Access-Control-Allow-Headers': EN_TETES_ACCEPTES,
    'Access-Control-Allow-Methods': METHODES_ACCEPTEES,
    'Access-Control-Max-Age': DUREE_CACHE_PREVOL,
    'Vary': 'Origin',
  };
}

/**
 * Constante historique, conservee pour les appelants qui ne peuvent pas
 * atteindre l'objet Request. Valeur figee au chargement du module ;
 * elle ne contient jamais '*'.
 */
/**
 * Origine a placer dans l'en-tete Access-Control-Allow-Origin.
 *
 * Existe pour les fonctions qui construisent leur propre objet d'en-tetes avec
 * des en-tetes acceptes qui leur sont propres : elles ne peuvent pas reprendre
 * `corsHeaders` tel quel sans perdre ces en-tetes, mais elles ne doivent pas
 * pour autant ouvrir l'API a toutes les origines.
 */
export function origineAutorisee(requestOrigin?: string | null): string {
  return getCorsHeaders(requestOrigin)['Access-Control-Allow-Origin'];
}

export const corsHeaders: Record<string, string> = getCorsHeaders(null);
