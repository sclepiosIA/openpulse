import { Database } from "@/integrations/supabase/types";

type Etablissement = Database["public"]["Tables"]["etablissements"]["Row"];

export interface MonthlyRevenue {
  etablissement_id: string;
  mois: Date;
  montant_prevu: number;
  modele: string | null;
  palier: string | null;
}

/**
 * Détermine si un mois donné correspond à une échéance de paiement selon la périodicité
 */
export function isPaymentMonth(
  etab: Etablissement,
  mois: Date
): boolean {
  if (!etab.date_premier_paiement && !etab.date_signature) return false;
  
  const dateReference = etab.date_premier_paiement 
    ? new Date(etab.date_premier_paiement)
    : new Date(etab.date_signature!);
  
  const periodicite = etab.periodicite_paiement || 'mensuel';
  const moisNumber = mois.getMonth();
  const moisRefNumber = dateReference.getMonth();
  
  if (periodicite === 'mensuel') {
    return true;
  } else if (periodicite === 'bimensuel') {
    return ((moisNumber - moisRefNumber) % 2 + 2) % 2 === 0;
  } else if (periodicite === 'trimestriel') {
    return ((moisNumber - moisRefNumber) % 3 + 3) % 3 === 0;
  } else if (periodicite === 'quadrimestriel') {
    return ((moisNumber - moisRefNumber) % 4 + 4) % 4 === 0;
  } else if (periodicite === 'semestriel') {
    return ((moisNumber - moisRefNumber) % 6 + 6) % 6 === 0;
  } else if (periodicite === 'annuel') {
    return moisNumber === moisRefNumber;
  }
  
  return false;
}

/**
 * Calcule le montant d'un paiement pour un mois donné en fonction du modèle
 */
export function calculatePaymentForMonth(
  etab: Etablissement,
  mois: Date
): number {
  // 1. Vérifier si c'est un mois de paiement selon la périodicité
  if (!isPaymentMonth(etab, mois)) {
    return 0;
  }

  // 2. Modèle "Au succès" avec palliers
  if (etab.type_offre === 'Au succès' && etab.pallier_vise && etab.tarifs_palliers) {
    const palNum = String(etab.pallier_vise).toLowerCase().match(/\d+/)?.[0];
    if (palNum) {
      const candidates = [
        `palier${palNum}`,
        `pallier${palNum}`,
        `palier_${palNum}`,
        `pallier_${palNum}`,
      ];
      const keys = Object.keys(etab.tarifs_palliers || {});
      const foundKey = keys.find(k => candidates.includes(String(k).toLowerCase()));
      if (foundKey) {
        const tarif = (etab.tarifs_palliers as Record<string, unknown>)[foundKey];
        if (tarif) {
          // Pour les modèles Succès+X, diviser par la périodicité
          const montantAnnuel = Number(tarif);
          return calculatePeriodicPayment(montantAnnuel, etab.periodicite_paiement || 'mensuel');
        }
      }
    }
  }

  // 3. Modèle statique numérique - montant annuel divisé selon périodicité
  if (etab.modele_statique_succes && /^[0-9]+\.?[0-9]*$/.test(String(etab.modele_statique_succes))) {
    const montantAnnuel = Number(etab.modele_statique_succes);
    return calculatePeriodicPayment(montantAnnuel, etab.periodicite_paiement || 'mensuel');
  }

  // 4. Estimation 2€/passage annuel divisé selon périodicité
  if (etab.nombre_passages_urgences_annuel) {
    const montantAnnuel = etab.nombre_passages_urgences_annuel * 2;
    return calculatePeriodicPayment(montantAnnuel, etab.periodicite_paiement || 'mensuel');
  }

  return 0;
}

/**
 * Calcule le montant d'un paiement périodique pour un établissement,
 * SANS vérifier si le mois donné est un mois de paiement.
 * Utile pour la génération de périodes où les dates sont déjà espacées
 * selon la périodicité.
 */
export function calculatePeriodicPaymentAmount(etab: Etablissement): number {
  // Modèle "Au succès" avec palliers
  if (etab.type_offre === 'Au succès' && etab.pallier_vise && etab.tarifs_palliers) {
    const palNum = String(etab.pallier_vise).toLowerCase().match(/\d+/)?.[0];
    if (palNum) {
      const candidates = [
        `palier${palNum}`, `pallier${palNum}`,
        `palier_${palNum}`, `pallier_${palNum}`,
      ];
      const keys = Object.keys(etab.tarifs_palliers || {});
      const foundKey = keys.find(k => candidates.includes(String(k).toLowerCase()));
      if (foundKey) {
        const tarif = (etab.tarifs_palliers as Record<string, unknown>)[foundKey];
        if (tarif) {
          return calculatePeriodicPayment(Number(tarif), etab.periodicite_paiement || 'mensuel');
        }
      }
    }
  }

  // Modèle statique numérique
  if (etab.modele_statique_succes && /^[0-9]+\.?[0-9]*$/.test(String(etab.modele_statique_succes))) {
    return calculatePeriodicPayment(Number(etab.modele_statique_succes), etab.periodicite_paiement || 'mensuel');
  }

  // Estimation 2€/passage
  if (etab.nombre_passages_urgences_annuel) {
    return calculatePeriodicPayment(etab.nombre_passages_urgences_annuel * 2, etab.periodicite_paiement || 'mensuel');
  }

  return 0;
}

/**
 * Calcule le montant périodique à partir d'un montant annuel
 */
function calculatePeriodicPayment(
  montantAnnuel: number,
  periodicite: string
): number {
  switch (periodicite) {
    case 'mensuel':
      return montantAnnuel / 12;
    case 'bimensuel':
      return montantAnnuel / 6;
    case 'trimestriel':
      return montantAnnuel / 4;
    case 'quadrimestriel':
      return montantAnnuel / 3;
    case 'semestriel':
      return montantAnnuel / 2;
    case 'annuel':
      return montantAnnuel;
    default:
      return montantAnnuel / 12;
  }
}

/**
 * Vérifie si un mois donné correspond au paiement initial
 */
export function isInitialPaymentMonth(
  etab: Etablissement,
  mois: Date
): boolean {
  if (!etab.paiement_initial || etab.paiement_initial === 0) return false;
  if (!etab.date_signature) return false;
  
  const dateSignature = new Date(etab.date_signature);
  const moisSignature = new Date(dateSignature.getFullYear(), dateSignature.getMonth(), 1);
  const moisCible = new Date(mois.getFullYear(), mois.getMonth(), 1);
  
  return moisSignature.getTime() === moisCible.getTime();
}

/**
 * Calcule le montant du paiement initial si applicable
 */
export function getInitialPayment(
  etab: Etablissement,
  mois: Date
): number {
  if (isInitialPaymentMonth(etab, mois)) {
    return etab.paiement_initial || 0;
  }
  return 0;
}

/**
 * Calcule le montant total pour un mois (initial + récurrent)
 */
export function calculateTotalPaymentForMonth(
  etab: Etablissement,
  mois: Date
): number {
  const initialPayment = getInitialPayment(etab, mois);
  const recurringPayment = calculatePaymentForMonth(etab, mois);
  return initialPayment + recurringPayment;
}

/**
 * Calcule les revenus mensuels prévisionnels pour une liste d'établissements
 */
export function calculateMonthlyRevenues(
  etablissements: Etablissement[],
  mois: Date
): MonthlyRevenue[] {
  return etablissements
    .filter(etab => etab.statut === 'Production') // Seulement les établissements en production
    .map(etab => ({
      etablissement_id: etab.id,
      mois,
      montant_prevu: calculateTotalPaymentForMonth(etab, mois),
      modele: etab.modele_detaille || etab.type_offre,
      palier: etab.pallier_vise,
    }));
}

/**
 * Détermine le modèle détaillé à partir du type d'offre
 */
export function getModeleDetaille(etab: Etablissement): string {
  if (etab.modele_detaille) return etab.modele_detaille;
  
  if (etab.type_offre === 'Au succès') {
    // Essayer de déterminer depuis le palier visé
    const palNum = String(etab.pallier_vise || '').match(/\d+/)?.[0];
    if (palNum) {
      return `Succès+${palNum}`;
    }
    return 'Au succès';
  }
  
  if (etab.modele_statique_succes) {
    return 'Statique';
  }
  
  return 'Indéterminé';
}
