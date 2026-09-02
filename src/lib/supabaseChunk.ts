/**
 * Découpage des filtres `.in(...)` PostgREST.
 *
 * PostgREST passe les filtres dans la query string : `?col=in.(uuid,uuid,…)`.
 * Au-delà d'environ 8 Ko d'URL, le reverse-proxy du backend self-hosté répond
 * **HTTP 414 (URI Too Long)**. Cette réponse ne porte pas les en-têtes CORS :
 * côté navigateur l'appel remonte en `TypeError: Failed to fetch`, ce qui rend
 * la panne difficile à diagnostiquer (elle ressemble à un problème réseau ou
 * CORS alors que c'est une limite de taille).
 *
 * Mesure du 2026-08-15 contre le backend Azure :
 *
 * | UUID   | longueur URL | réponse |
 * |--------|--------------|---------|
 * | 50     | 2 005        | 200     |
 * | 150    | 5 705        | 200     |
 * | 250    | 9 405        | **414** |
 *
 * Le défaut se déclenchait en production dès ~200 établissements (la base en
 * compte 252) : les liens établissement → groupe n'étaient jamais chargés.
 *
 * `IN_CHUNK_SIZE = 100` laisse une marge confortable (~3,8 Ko par requête)
 * tout en gardant le nombre d'aller-retours faible.
 */
export const IN_CHUNK_SIZE = 100

/**
 * Exécute `fetcher` par lots d'identifiants et concatène les résultats.
 *
 * @param ids     identifiants à filtrer (dédoublonnés par l'appelant si besoin)
 * @param fetcher requête à exécuter pour un lot — typiquement un
 *                `supabase.from(…).select(…).in(col, chunk)`
 */
export async function fetchInChunks<T>(
  ids: readonly string[],
  fetcher: (chunk: string[]) => PromiseLike<{ data: T[] | null }>,
  chunkSize: number = IN_CHUNK_SIZE
): Promise<T[]> {
  if (!ids.length) return []

  const results: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data } = await fetcher(ids.slice(i, i + chunkSize))
    if (data) results.push(...data)
  }
  return results
}
