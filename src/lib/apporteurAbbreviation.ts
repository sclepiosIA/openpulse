/**
 * Retourne une abréviation courte pour un apporteur d'affaires.
 * Mapping explicite pour les cas connus (ex: Softway Médical → SWM),
 * fallback : initiales des mots (max 3 caractères).
 */
const KNOWN_ABBR: Record<string, string> = {
  'Softway Médical': 'SWM',
  'Softway Medical': 'SWM',
  'MedTech Advisors': 'MTA',
  'Groupe Hippocrate': 'GH',
}

export function getApporteurAbbreviation(nom: string): string {
  if (!nom) return '?'
  const trimmed = nom.trim()
  if (KNOWN_ABBR[trimmed]) return KNOWN_ABBR[trimmed]

  const words = trimmed.split(/\s+/).filter(Boolean)
  const initials = words.map((w) => w[0]?.toUpperCase() ?? '').join('')
  if (initials.length >= 2) return initials.slice(0, 3)
  return trimmed.slice(0, 3).toUpperCase()
}
