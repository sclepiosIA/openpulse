/**
 * Calcule la valeur d'un établissement selon la logique de priorité unifiée
 * DOIT correspondre EXACTEMENT à la fonction SQL get_dashboard_overview
 * 
 * Logique de priorité :
 * 1. Palliers "Au succès" → montant annuel direct depuis tarifs_palliers
 * 2. Modèle statique numérique → valeur directe
 * 3. Estimation → 2€/passage si aucune donnée
 */

/** Type pour les données d'établissement utilisées dans le calcul de valeur */
export interface EtablissementValueData {
  type_offre?: string | null;
  pallier_vise?: string | number | null;
  tarifs_palliers?: Record<string, unknown> | unknown | null;
  modele_statique_succes?: string | number | null;
  nombre_passages_urgences_annuel?: number | null;
}

export function calculateEtablissementValue(etablissement: EtablissementValueData): number {
  const safeNumber = (value: unknown): number => {
    const num = Number(value)
    return isNaN(num) ? 0 : num
  }
  
  // Priorité 1: Palliers "Au succès" - montant annuel direct
  if (
    etablissement.type_offre === 'Au succès' &&
    etablissement.pallier_vise && 
    etablissement.tarifs_palliers
  ) {
    // Normaliser le libellé de pallier et trouver la clé correspondante dans le JSON
    const palNum = String(etablissement.pallier_vise).toLowerCase().match(/\d+/)?.[0]
    if (palNum) {
      const candidates = [
        `palier${palNum}`,
        `pallier${palNum}`,
        `palier_${palNum}`,
        `pallier_${palNum}`,
      ]
      const tarifsObj = etablissement.tarifs_palliers as Record<string, unknown> | null | undefined;
      const keys = Object.keys(tarifsObj || {})
      const foundKey = keys.find(k => candidates.includes(String(k).toLowerCase()))
      if (foundKey !== undefined && tarifsObj) {
        const tarif = tarifsObj[foundKey]
        if (tarif !== undefined && tarif !== null) return safeNumber(tarif)
      }
    }
  }
  
  // Priorité 2: Modèle statique numérique uniquement
  if (
    etablissement.modele_statique_succes && 
    /^[0-9]+\.?[0-9]*$/.test(String(etablissement.modele_statique_succes))
  ) {
    return safeNumber(etablissement.modele_statique_succes)
  }
  
  // Priorité 3: Estimation à 2€/passage quand aucune donnée précise
  if (etablissement.nombre_passages_urgences_annuel) {
    return safeNumber(etablissement.nombre_passages_urgences_annuel) * 2
  }
  
  return 0
}
