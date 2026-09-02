import { Database } from "@/integrations/supabase/types";
import { calculateTotalPaymentForMonth, isPaymentMonth } from "./calculateRevenues";
import { addMonths, startOfMonth } from "date-fns";

type Etablissement = Database["public"]["Tables"]["etablissements"]["Row"];

export interface PaymentSchedule {
  date: Date;
  montant: number;
  etablissement_id: string;
  etablissement_nom: string;
  statut: "prevue" | "facturee" | "payee" | "en_retard";
}

/**
 * Détermine la périodicité de paiement
 */
type Periodicite = "mensuel" | "bimensuel" | "trimestriel" | "quadrimestriel" | "semestriel" | "annuel";

function determinePeriodicite(etablissement: Etablissement): Periodicite {
  return (etablissement.periodicite_paiement as Periodicite) || "mensuel";
}

function getPeriodiciteIncrement(periodicite: Periodicite): number {
  switch (periodicite) {
    case "bimensuel": return 2;
    case "trimestriel": return 3;
    case "quadrimestriel": return 4;
    case "semestriel": return 6;
    case "annuel": return 12;
    case "mensuel":
    default: return 1;
  }
}

/**
 * Génère une séquence de dates selon la périodicité
 */
function generateDateSequence(
  dateDebut: Date,
  dateFin: Date,
  periodicite: Periodicite
): Date[] {
  const dates: Date[] = [];
  let current = startOfMonth(dateDebut);
  const end = startOfMonth(dateFin);

  const increment = getPeriodiciteIncrement(periodicite);

  while (current <= end) {
    dates.push(new Date(current));
    current = addMonths(current, increment);
  }

  return dates;
}

export function generatePaymentSchedule(
  etablissement: Etablissement,
  dateDebut: Date,
  dateFin: Date
): PaymentSchedule[] {
  const periodicite = determinePeriodicite(etablissement);
  const dates = generateDateSequence(dateDebut, dateFin, periodicite);

  const schedules: PaymentSchedule[] = [];
  
  for (const date of dates) {
    const montant = calculateTotalPaymentForMonth(etablissement, date);
    
    // Ne retourner que les mois où il y a un paiement
    if (montant > 0) {
      schedules.push({
        date,
        montant,
        etablissement_id: etablissement.id,
        etablissement_nom: etablissement.nom,
        statut: "prevue" as const,
      });
    }
  }
  
  return schedules;
}

/**
 * Génère les paiements pour tous les établissements actifs sur une période
 */
export function generateAllPaymentSchedules(
  etablissements: Etablissement[],
  dateDebut: Date,
  dateFin: Date
): PaymentSchedule[] {
  return etablissements
    .filter(etab => etab.statut === 'Production')
    .flatMap(etab => generatePaymentSchedule(etab, dateDebut, dateFin));
}

/**
 * Calcule la prochaine date de paiement pour un établissement
 */
export function getNextPaymentDate(etablissement: Etablissement): Date | null {
  const dateReference = etablissement.date_premier_paiement 
    ? new Date(etablissement.date_premier_paiement)
    : etablissement.date_signature
    ? new Date(etablissement.date_signature)
    : null;
  
  if (!dateReference) return null;
  
  const periodicite = determinePeriodicite(etablissement);
  const today = startOfMonth(new Date());
  let candidateDate = startOfMonth(dateReference);
  
  const increment = getPeriodiciteIncrement(periodicite);
  
  // Avancer jusqu'à trouver la prochaine date future
  while (candidateDate <= today) {
    candidateDate = addMonths(candidateDate, increment);
  }
  
  return candidateDate;
}
