// Pont léger vers Gestion web : construction d'URL + ouverture dans le
// navigateur par défaut ou dans une fenêtre PWA Tauri dédiée.

function hasTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Même gabarit que `GABARIT_WEB_BASE_URL` côté Rust
// (`crates/sync-core/src/config.rs`). Les deux avaient divergé : le pont
// JavaScript retombait sur `openpulse.example.org` quand la configuration
// native retombait sur `espace.exploitant.example.org`, de sorte qu'une
// installation sans variable d'environnement visait deux hôtes différents
// selon le chemin de code emprunté. L'épreuve de ce fichier attendait déjà la
// bonne valeur : c'est le code qui avait dérivé.
//
// Pour viser une instance réelle, renseigner `VITE_OPENPULSE_WEB_URL` à la
// construction — voir `scripts/construire-pour-instance.sh`.
const DEFAULT_OPENPULSE_WEB_URL = 'https://espace.exploitant.example.org'

export function gestionWebBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_OPENPULSE_WEB_URL as string | undefined
  return (fromEnv && fromEnv.trim() ? fromEnv : DEFAULT_OPENPULSE_WEB_URL).replace(/\/+$/, '')
}

/** Construit l'URL absolue d'un module Gestion web à partir de son chemin. */
export function gestionWebUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${gestionWebBaseUrl()}${clean}`
}

/** Ouvre un module Gestion web dans le navigateur par défaut de l'OS. */
export async function openInGestionWeb(path: string): Promise<void> {
  const url = gestionWebUrl(path)
  if (hasTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  }
  window.open(url, '_blank', 'noopener')
}
