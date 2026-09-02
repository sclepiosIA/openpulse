/**
 * Centralized list of generic email domains
 * Used by sync-emails, auto-match-emails, and quick-match-by-domain
 * to avoid false auto-affiliations on personal email providers
 */
export const GENERIC_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.fr', 'yahoo.com',
  'orange.fr', 'free.fr', 'laposte.net', 'wanadoo.fr', 'sfr.fr',
  'bbox.fr', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com',
  'protonmail.com', 'proton.me', 'pm.me', 'hotmail.fr', 'live.fr',
];

export const INTERNAL_MARQUE_DOMAINS = ['marque.ai', 'exploitant.example.org'];

export function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.includes(domain.toLowerCase());
}

export function isMarqueDomain(domain: string): boolean {
  return INTERNAL_MARQUE_DOMAINS.includes(domain.toLowerCase());
}
