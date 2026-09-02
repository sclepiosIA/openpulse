import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

// Cache simple pour éviter les appels répétitifs
let cachedSalairesBruts: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1 minute

const formatCivilDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calcule le total des salaires bruts depuis rh_salaires_mensuels
 * Fallback sur les profiles actifs si aucune donnée RH
 */
export async function calculateTotalSalairesBruts(mois?: string): Promise<number> {
  const now = Date.now();
  if (cachedSalairesBruts !== null && now - cacheTimestamp < CACHE_DURATION) {
    return cachedSalairesBruts;
  }

  // Normaliser le format de date : "2025-11" → "2025-11-01"
  const currentMonth = mois 
    ? (mois.length === 7 ? `${mois}-01` : mois)
    : `${formatCivilDate(new Date()).slice(0, 8)}01`;

  // PRIORITÉ 1 : Table rh_salaires_mensuels
  const { data: salaires, error: salairesError } = await supabase
    .from('rh_salaires_mensuels')
    .select('salaire_brut')
    .eq('mois', currentMonth);

  if (salairesError) {
    debug.error('Erreur récupération salaires:', salairesError);
  } else if (salaires && salaires.length > 0) {
    cachedSalairesBruts = salaires.reduce((sum, s) => sum + (s.salaire_brut || 0), 0);
    cacheTimestamp = now;
    return cachedSalairesBruts;
  }

  // PRIORITÉ 2 : Estimer depuis profiles.salaire_brut
  const { data: profilesWithSalaires, error: profilesError } = await (supabase as unknown as {
    from: (t: string) => { select: (c: string) => { eq: (k: string, v: unknown) => { not: (k: string, op: string, v: unknown) => Promise<{ data: Array<{ salaire_brut: number | null }> | null; error: unknown }> } } };
  })
    .from('profiles')
    .select('salaire_brut')
    .eq('actif', true)
    .not('salaire_brut', 'is', null);

  if (!profilesError && profilesWithSalaires && profilesWithSalaires.length > 0) {
    cachedSalairesBruts = profilesWithSalaires.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
    cacheTimestamp = now;
    return cachedSalairesBruts;
  }


  // FALLBACK 3 : Estimation par défaut
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('actif', true);

  cachedSalairesBruts = (count || 0) * 3500; // 3500€ brut moyen
  cacheTimestamp = now;
  return cachedSalairesBruts;
}

// Cache pour éviter les appels répétitifs
let cachedNombreEmployes: number | null = null;

/**
 * Calcule le nombre d'employés actifs pour un mois donné
 */
export async function calculateNombreEmployes(mois?: string): Promise<number> {
  const now = Date.now();
  if (cachedNombreEmployes !== null && now - cacheTimestamp < CACHE_DURATION) {
    return cachedNombreEmployes;
  }

  // Normaliser le format de date
  const currentMonth = mois 
    ? (mois.length === 7 ? `${mois}-01` : mois)
    : `${formatCivilDate(new Date()).slice(0, 8)}01`;

  // PRIORITÉ 1 : Compter depuis rh_salaires_mensuels
  const { count: salairesCount, error: salairesError } = await supabase
    .from('rh_salaires_mensuels')
    .select('id', { count: 'exact', head: true })
    .eq('mois', currentMonth);

  if (salairesError) {
    debug.error('Erreur comptage rh_salaires_mensuels:', salairesError);
  } else if (salairesCount && salairesCount > 0) {
    cachedNombreEmployes = salairesCount;
    cacheTimestamp = now;
    return salairesCount;
  }

  // FALLBACK : Compter depuis profiles actifs
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('actif', true);

  if (error) {
    debug.error('Erreur comptage profiles:', error);
    return 0;
  }

  cachedNombreEmployes = count || 0;
  cacheTimestamp = now;
  return count || 0;
}

/**
 * Calcule les salaires nets mensuels (78% du brut)
 */
export async function calculateSalairesNets(mois?: string): Promise<number> {
  const salairesBruts = await calculateTotalSalairesBruts(mois);
  return salairesBruts * 0.78;
}

/**
 * Calcule les cotisations patronales (45% du brut)
 */
export async function calculateCotisationsPatronales(mois?: string): Promise<number> {
  const salairesBruts = await calculateTotalSalairesBruts(mois);
  return salairesBruts * 0.45;
}

/**
 * Calcule l'URSSAF (45% du brut)
 */
export async function calculateURSSAF(mois?: string): Promise<number> {
  return calculateCotisationsPatronales(mois);
}

/**
 * Calcule la retraite complémentaire (8% du brut)
 */
export async function calculateRetraite(mois?: string): Promise<number> {
  const salairesBruts = await calculateTotalSalairesBruts(mois);
  return salairesBruts * 0.08;
}

/**
 * Calcule la mutuelle (60€ par employé)
 */
export async function calculateMutuelle(mois?: string): Promise<number> {
  const nbEmployes = await calculateNombreEmployes(mois);
  return nbEmployes * 60;
}

/**
 * Calcule la prévoyance (1.5% du brut)
 */
export async function calculatePrevoyance(mois?: string): Promise<number> {
  const salairesBruts = await calculateTotalSalairesBruts(mois);
  return salairesBruts * 0.015;
}

/**
 * Calcule le CA HT du mois depuis tresorerie_revenus
 */
export async function calculateCAHT(mois: Date): Promise<number> {
  const year = mois.getFullYear();
  const month = mois.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  
  const { data: revenus, error } = await supabase
    .from('tresorerie_revenus')
    .select('montant_prevu, statut')
    .gte('mois', formatCivilDate(startOfMonth))
    .lte('mois', formatCivilDate(endOfMonth));

  if (error) {
    debug.error('Erreur récupération CA:', error);
    return 0;
  }

  // Utiliser le montant des revenus payés
  return revenus?.reduce((sum, r) => {
    if (r.statut === 'paye') {
      return sum + (r.montant_prevu || 0);
    }
    return sum;
  }, 0) || 0;
}

/**
 * Calcule la TVA à payer (simplifié : 20% du CA HT - TVA déductible estimée à 5% du CA)
 */
export async function calculateTVA(mois: Date): Promise<number> {
  const caHT = await calculateCAHT(mois);
  const tvaCollectee = caHT * 0.20;
  const tvaDeductible = caHT * 0.05; // Estimation simplifiée
  return tvaCollectee - tvaDeductible;
}

/**
 * Calcule toutes les dépenses automatiques pour un mois
 */
export async function calculateAllAutomaticExpenses(mois: Date): Promise<Record<string, number>> {
  // Format complet YYYY-MM-DD pour les requêtes SQL
  const moisStr = formatCivilDate(mois);
  
  const [
    salairesNets,
    cotisations,
    urssaf,
    retraite,
    mutuelle,
    prevoyance,
    tva
  ] = await Promise.all([
    calculateSalairesNets(moisStr),
    calculateCotisationsPatronales(moisStr),
    calculateURSSAF(moisStr),
    calculateRetraite(moisStr),
    calculateMutuelle(moisStr),
    calculatePrevoyance(moisStr),
    calculateTVA(mois)
  ]);

  return {
    'DEP_SALAIRES_NETS': salairesNets,
    'DEP_COTISATIONS': cotisations,
    'DEP_URSSAF': urssaf,
    'DEP_RETRAITE': retraite,
    'DEP_MUTUELLE': mutuelle,
    'DEP_PREVOYANCE': prevoyance,
    'DEP_TVA': tva,
    // Abonnements fixes
    'DEP_GITHUB': 44,
    'DEP_SUPABASE': 25,
    'DEP_AZURE': 200,
    'DEP_NOTION': 80,
    'DEP_FIGMA': 45,
  };
}
