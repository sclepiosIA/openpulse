/**
 * Configuration centralisée pour les emails internes OpenPulse
 * Source unique de vérité pour les domaines et adresses internes
 * 
 * NOTE: Les adresses email spécifiques des membres d'équipe ne sont plus
 * hardcodées ici. Elles sont stockées dans app_config (clé 'internal_team_emails')
 * et accessibles via useInternalEmailConfig().
 */

// Domaines officiels OpenPulse (publics, non sensibles)
export const INTERNAL_DOMAINS = ['exploitant.example.org', 'marque.ai'];

// Domaines génériques exclus du fallback Clearbit et de la classification automatique
export const GENERIC_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 
  'laposte.net', 'live.com', 'icloud.com', 'aol.com',
  'protonmail.com', 'proton.me', 'pm.me'
];

/**
 * Normalise une adresse email (extrait l'email si format "Nom <email>")
 */
export function normalizeEmail(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/<([^>]+)>/);
  const email = (match?.[1] || trimmed).trim();
  if (!email.includes('@')) return null;
  return email.toLowerCase();
}

/**
 * Vérifie si un email appartient à un domaine interne OpenPulse.
 * Pour vérifier aussi les adresses spécifiques (Gmail d'équipe),
 * utiliser isMarqueEmailFull() avec la liste d'adresses depuis app_config.
 */
export function isMarqueEmail(email?: string): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1];
  return domain ? INTERNAL_DOMAINS.includes(domain) : false;
}

/**
 * Vérifie si un email est interne, y compris les adresses spécifiques d'équipe.
 * @param email - L'email à vérifier
 * @param teamEmails - Liste des adresses spécifiques d'équipe (depuis app_config)
 */
export function isMarqueEmailFull(email?: string, teamEmails: string[] = []): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1];
  
  return (domain && INTERNAL_DOMAINS.includes(domain)) 
    || teamEmails.map(e => e.toLowerCase()).includes(emailLower);
}

/**
 * Vérifie si un domaine est interne
 */
export function isInternalDomain(domain: string | null): boolean {
  return domain ? INTERNAL_DOMAINS.includes(domain.toLowerCase()) : false;
}

/**
 * Extrait le domaine d'une adresse email
 */
export function extractEmailDomain(email?: string): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  return domain || null;
}

/**
 * Vérifie si un domaine est générique (Gmail, Yahoo, etc.)
 */
export function isGenericEmailDomain(domain?: string | null): boolean {
  if (!domain) return true;
  return GENERIC_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Récupère le domaine d'un email s'il n'est pas générique ni interne
 * Utile pour les fallbacks Clearbit
 */
export function getExternalDomain(email?: string): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || GENERIC_DOMAINS.includes(domain) || INTERNAL_DOMAINS.includes(domain)) {
    return null;
  }
  return domain;
}
