/**
 * Détecte l'interruption d'une requête réseau (navigation, démontage, abort).
 *
 * Quand l'utilisateur change de page, les requêtes encore en vol sont annulées
 * par le navigateur. Le SDK Supabase les remonte alors comme des erreurs
 * (`TypeError: Failed to fetch` sous Chromium, « Load failed » /
 * « due to access control checks » sous WebKit). Ce n'est pas une panne : la
 * donnée sera rechargée au prochain montage.
 *
 * Les traiter comme de vraies erreurs a deux effets indésirables : un toast
 * destructif s'affiche alors que l'utilisateur a simplement navigué, et la
 * console se remplit de faux signaux qui masquent les vraies anomalies.
 */
const ABORT_PATTERN =
  /failed to fetch|networkerror|load failed|the operation was aborted|aborterror|due to access control checks|err_aborted/i

export function isNetworkAbort(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError') {
    return true
  }
  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : ''
  return ABORT_PATTERN.test(message)
}
