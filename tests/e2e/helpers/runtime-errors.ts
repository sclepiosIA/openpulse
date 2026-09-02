/**
 * Distingue une vraie erreur d'exécution d'un simple aléa réseau.
 *
 * Les specs qui vérifient « la page ne crashe pas » écoutent `pageerror` et
 * exigent zéro entrée. Or une navigation interrompt les requêtes encore en
 * vol, et les moteurs les remontent comme des erreurs :
 *
 * - WebKit signale une requête annulée pendant son contrôle CORS par
 *   « Fetch API cannot load … due to access control checks » — message
 *   trompeur, identique à un vrai refus CORS. Constaté le 2026-08-15 sur les
 *   routes `/m/*` : au même instant, des assets servis par le front lui-même
 *   apparaissaient en `cancelled`, et les mêmes appels testés isolément
 *   répondaient 200 / 204.
 * - Chromium et Firefox utilisent « Failed to fetch » / « NetworkError ».
 *
 * Ces messages ne disent rien de la qualité du code : ils dépendent du moment
 * où le test navigue. On les écarte, en gardant toute autre exception —
 * notamment les erreurs de rendu, qui sont l'objet réel de ces tests.
 */
const TRANSIENT_NETWORK_ERROR =
  /due to access control checks|failed to fetch|networkerror|load failed|the operation was aborted|err_aborted|cancelled/i

export function isTransientNetworkError(message: string): boolean {
  return TRANSIENT_NETWORK_ERROR.test(message)
}

/** Ne conserve que les erreurs imputables à l'application. */
export function keepRealRuntimeErrors(messages: string[]): string[] {
  return messages.filter((m) => !isTransientNetworkError(m))
}
