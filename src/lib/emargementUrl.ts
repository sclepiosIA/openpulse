/**
 * URL publique d'émargement des formations.
 *
 * La page d'émargement est désormais hébergée par le site institutionnel
 * OpenPulse (projet "Site Web OpenPulse", domaine exploitant.example.org).
 * Tous les QR codes et liens d'émargement doivent renvoyer vers cette URL.
 */
export const PUBLIC_EMARGEMENT_URL = "https://exploitant.example.org/emargement";

/**
 * Construit l'URL d'émargement pour une session donnée.
 * Les paramètres session/token sont conservés pour traçabilité côté site institutionnel
 * (ils sont ignorés si non utilisés, mais peuvent servir au pré-remplissage futur).
 */
export function buildEmargementUrl(params?: { sessionId?: string; token?: string | null }): string {
  if (!params?.sessionId && !params?.token) return PUBLIC_EMARGEMENT_URL;
  const qs = new URLSearchParams();
  if (params.sessionId) qs.set("session", params.sessionId);
  if (params.token) qs.set("token", params.token);
  return `${PUBLIC_EMARGEMENT_URL}?${qs.toString()}`;
}
