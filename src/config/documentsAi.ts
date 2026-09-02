/**
 * Feature flag — panneau Assistant IA des documents (résumé, reformulation,
 * classification DPO/RSSI, extraction d'actions).
 *
 * Activé par défaut : le panneau gère lui-même un mode dégradé « unconfigured »
 * si l'edge function `document-ai-assist` est absente ou si Azure OpenAI n'est
 * pas configuré côté serveur. Mettre `VITE_DOCUMENTS_AI_PANEL=off` pour
 * masquer entièrement le point d'entrée UI.
 *
 * ⚠️ Aucun secret ici : uniquement un interrupteur d'affichage côté client.
 */
export function isDocumentsAiPanelEnabled(): boolean {
  const raw = String(import.meta.env.VITE_DOCUMENTS_AI_PANEL ?? 'on').toLowerCase();
  return raw !== 'off' && raw !== 'false' && raw !== '0';
}
