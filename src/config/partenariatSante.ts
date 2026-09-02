/**
 * Paramètres de calcul de la santé d'un partenariat apporteur.
 * Ces constantes sont volontairement centralisées pour être ajustées sans
 * toucher aux composants UI.
 */
export const PARTENARIAT_SANTE_CONFIG = {
  /** Objectif de volume de prospects ciblés par partenaire depuis le début. */
  objectifProspects: 50,
  /** Taux de conversion (%) attendu au tout début du partenariat. */
  tauxPlancher: 5,
  /** Taux de conversion (%) attendu à maturité. */
  tauxCible: 50,
  /** Durée (mois) pour atteindre le taux cible. */
  dureeMaturationMois: 18,
  /** Seuil (ratio 0-1) au-delà duquel la dépendance à un partenaire pénalise. */
  seuilDependance: 0.1,
  /** Pondérations du score global (doivent sommer à 1). */
  poids: {
    commercial: 0.25,
    organisation: 0.25,
    relation: 0.25,
    dependance: 0.25,
  },
} as const

/** Mois écoulés entre une date ISO et aujourd'hui (>= 0). */
export function monthsSince(dateISO: string, now: Date = new Date()): number {
  const start = new Date(dateISO)
  if (Number.isNaN(start.getTime())) return 0
  const years = now.getFullYear() - start.getFullYear()
  const months = now.getMonth() - start.getMonth()
  const days = now.getDate() - start.getDate()
  const total = years * 12 + months + (days >= 0 ? 0 : -1)
  return Math.max(0, total)
}

export function calcScoreCommercial(params: {
  prospectsCibles: number
  clientsSignes: number
  moisAnciennete: number
}): number {
  const { objectifProspects, tauxPlancher, tauxCible, dureeMaturationMois } =
    PARTENARIAT_SANTE_CONFIG
  const { prospectsCibles, clientsSignes, moisAnciennete } = params

  const pctObjectif = Math.min(1, prospectsCibles / objectifProspects) * 100

  const tauxReel = prospectsCibles === 0 ? 0 : (clientsSignes / prospectsCibles) * 100

  const tauxAttendu =
    tauxPlancher + (tauxCible - tauxPlancher) * Math.min(1, moisAnciennete / dureeMaturationMois)

  const scoreTauxAjuste = tauxAttendu === 0 ? 100 : Math.min(100, 100 * (tauxReel / tauxAttendu))

  return 0.5 * pctObjectif + 0.5 * scoreTauxAjuste
}

export function calcScoreDependance(params: {
  prospectsCiblesPartenaire: number
  prospectsCiblesTousPartenaires: number
}): number {
  const { seuilDependance } = PARTENARIAT_SANTE_CONFIG
  const { prospectsCiblesPartenaire, prospectsCiblesTousPartenaires } = params
  if (prospectsCiblesTousPartenaires <= 0) return 100
  const ratio = prospectsCiblesPartenaire / prospectsCiblesTousPartenaires
  if (ratio <= seuilDependance) return 100
  return Math.max(0, 100 - ((ratio - seuilDependance) / (1 - seuilDependance)) * 100)
}

export function calcScoreGlobal(scores: {
  commercial: number
  organisation: number
  relation: number
  dependance: number
}): number {
  const p = PARTENARIAT_SANTE_CONFIG.poids
  return (
    p.commercial * scores.commercial +
    p.organisation * scores.organisation +
    p.relation * scores.relation +
    p.dependance * scores.dependance
  )
}

/** Renvoie une couleur HSL (variable Tailwind) selon la valeur du score. */
export function scoreColor(score: number): string {
  if (score >= 70) return 'hsl(142 71% 45%)' // vert
  if (score >= 40) return 'hsl(32 95% 55%)' // orange
  return 'hsl(0 84% 60%)' // rouge
}
