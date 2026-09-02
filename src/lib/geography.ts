/**
 * Utilitaires pour la gestion géographique française
 */

// Mapping complet des départements vers leurs régions
const DEPARTMENT_TO_REGION: Record<string, string> = {
  // Auvergne-Rhône-Alpes
  'ain': 'Auvergne-Rhône-Alpes',
  'allier': 'Auvergne-Rhône-Alpes',
  'ardèche': 'Auvergne-Rhône-Alpes',
  'cantal': 'Auvergne-Rhône-Alpes',
  'drôme': 'Auvergne-Rhône-Alpes',
  'isère': 'Auvergne-Rhône-Alpes',
  'loire': 'Auvergne-Rhône-Alpes',
  'haute-loire': 'Auvergne-Rhône-Alpes',
  'puy-de-dôme': 'Auvergne-Rhône-Alpes',
  'rhône': 'Auvergne-Rhône-Alpes',
  'savoie': 'Auvergne-Rhône-Alpes',
  'haute-savoie': 'Auvergne-Rhône-Alpes',
  
  // Bourgogne-Franche-Comté
  'côte-d\'or': 'Bourgogne-Franche-Comté',
  'doubs': 'Bourgogne-Franche-Comté',
  'jura': 'Bourgogne-Franche-Comté',
  'nièvre': 'Bourgogne-Franche-Comté',
  'haute-saône': 'Bourgogne-Franche-Comté',
  'saône-et-loire': 'Bourgogne-Franche-Comté',
  'territoire de belfort': 'Bourgogne-Franche-Comté',
  'yonne': 'Bourgogne-Franche-Comté',
  
  // Bretagne
  'côtes-d\'armor': 'Bretagne',
  'finistère': 'Bretagne',
  'ille-et-vilaine': 'Bretagne',
  'morbihan': 'Bretagne',
  
  // Centre-Val de Loire
  'cher': 'Centre-Val de Loire',
  'eure-et-loir': 'Centre-Val de Loire',
  'indre': 'Centre-Val de Loire',
  'indre-et-loire': 'Centre-Val de Loire',
  'loir-et-cher': 'Centre-Val de Loire',
  'loiret': 'Centre-Val de Loire',
  
  // Corse
  'corse-du-sud': 'Corse',
  'haute-corse': 'Corse',
  
  // Grand Est
  'ardennes': 'Grand Est',
  'aube': 'Grand Est',
  'marne': 'Grand Est',
  'haute-marne': 'Grand Est',
  'meurthe-et-moselle': 'Grand Est',
  'meuse': 'Grand Est',
  'moselle': 'Grand Est',
  'bas-rhin': 'Grand Est',
  'haut-rhin': 'Grand Est',
  'vosges': 'Grand Est',
  
  // Hauts-de-France
  'aisne': 'Hauts-de-France',
  'nord': 'Hauts-de-France',
  'oise': 'Hauts-de-France',
  'pas-de-calais': 'Hauts-de-France',
  'somme': 'Hauts-de-France',
  
  // Île-de-France
  'paris': 'Île-de-France',
  'seine-et-marne': 'Île-de-France',
  'yvelines': 'Île-de-France',
  'essonne': 'Île-de-France',
  'hauts-de-seine': 'Île-de-France',
  'seine-saint-denis': 'Île-de-France',
  'val-de-marne': 'Île-de-France',
  'val-d\'oise': 'Île-de-France',
  
  // Normandie
  'calvados': 'Normandie',
  'eure': 'Normandie',
  'manche': 'Normandie',
  'orne': 'Normandie',
  'seine-maritime': 'Normandie',
  
  // Nouvelle-Aquitaine
  'charente': 'Nouvelle-Aquitaine',
  'charente-maritime': 'Nouvelle-Aquitaine',
  'corrèze': 'Nouvelle-Aquitaine',
  'creuse': 'Nouvelle-Aquitaine',
  'dordogne': 'Nouvelle-Aquitaine',
  'gironde': 'Nouvelle-Aquitaine',
  'landes': 'Nouvelle-Aquitaine',
  'lot-et-garonne': 'Nouvelle-Aquitaine',
  'pyrénées-atlantiques': 'Nouvelle-Aquitaine',
  'deux-sèvres': 'Nouvelle-Aquitaine',
  'vienne': 'Nouvelle-Aquitaine',
  'haute-vienne': 'Nouvelle-Aquitaine',
  
  // Occitanie
  'ariège': 'Occitanie',
  'aude': 'Occitanie',
  'aveyron': 'Occitanie',
  'gard': 'Occitanie',
  'haute-garonne': 'Occitanie',
  'gers': 'Occitanie',
  'hérault': 'Occitanie',
  'lot': 'Occitanie',
  'lozère': 'Occitanie',
  'hautes-pyrénées': 'Occitanie',
  'pyrénées-orientales': 'Occitanie',
  'tarn': 'Occitanie',
  'tarn-et-garonne': 'Occitanie',
  
  // Pays de la Loire
  'loire-atlantique': 'Pays de la Loire',
  'maine-et-loire': 'Pays de la Loire',
  'mayenne': 'Pays de la Loire',
  'sarthe': 'Pays de la Loire',
  'vendée': 'Pays de la Loire',
  
  // Provence-Alpes-Côte d'Azur
  'alpes-de-haute-provence': 'Provence-Alpes-Côte d\'Azur',
  'hautes-alpes': 'Provence-Alpes-Côte d\'Azur',
  'alpes-maritimes': 'Provence-Alpes-Côte d\'Azur',
  'bouches-du-rhône': 'Provence-Alpes-Côte d\'Azur',
  'var': 'Provence-Alpes-Côte d\'Azur',
  'vaucluse': 'Provence-Alpes-Côte d\'Azur',
  
  // Outre-mer
  'guadeloupe': 'Guadeloupe',
  'martinique': 'Martinique',
  'guyane': 'Guyane',
  'réunion': 'La Réunion',
  'mayotte': 'Mayotte',
};

/**
 * Obtient la région d'un département donné
 * @param department Le nom du département (avec ou sans accents)
 * @returns Le nom de la région ou null si non trouvé
 */
export function getRegionFromDepartment(department: string): string | null {
  if (!department) return null;
  
  const normalizedDepartment = department
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
    .trim();
  
  return DEPARTMENT_TO_REGION[normalizedDepartment] || null;
}

/**
 * Valide et normalise un nom de région
 * @param region Le nom de la région à valider
 * @returns Le nom de région normalisé ou null si invalide
 */
export function validateRegion(region: string): string | null {
  if (!region) return null;
  
  const validRegions = [
    'Auvergne-Rhône-Alpes',
    'Bourgogne-Franche-Comté',
    'Bretagne',
    'Centre-Val de Loire',
    'Corse',
    'Grand Est',
    'Hauts-de-France',
    'Île-de-France',
    'Normandie',
    'Nouvelle-Aquitaine',
    'Occitanie',
    'Pays de la Loire',
    'Provence-Alpes-Côte d\'Azur',
    'Guadeloupe',
    'Martinique',
    'Guyane',
    'La Réunion',
    'Mayotte'
  ];
  
  // Recherche exacte
  const exactMatch = validRegions.find(
    r => r.toLowerCase() === region.toLowerCase()
  );
  
  if (exactMatch) return exactMatch;
  
  // Recherche avec normalisation
  const normalizedInput = region
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  const match = validRegions.find(r => {
    const normalizedRegion = r
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return normalizedRegion === normalizedInput;
  });
  
  return match || null;
}

/**
 * Détermine automatiquement la région à partir d'une ville et/ou département
 * @param city La ville
 * @param departmentOrRegion Le département ou la région
 * @returns La région déterminée ou la valeur d'origine si déjà une région valide
 */
export function determineRegion(city: string, departmentOrRegion: string): string {
  // D'abord, vérifier si c'est déjà une région valide
  const validatedRegion = validateRegion(departmentOrRegion);
  if (validatedRegion) {
    return validatedRegion;
  }
  
  // Ensuite, essayer de mapper le département vers une région
  const regionFromDept = getRegionFromDepartment(departmentOrRegion);
  if (regionFromDept) {
    return regionFromDept;
  }
  
  // Si rien ne fonctionne, retourner la valeur d'origine
  return departmentOrRegion;
}

/**
 * Liste toutes les régions françaises valides
 * @returns Un tableau des noms de régions
 */
export function getAllRegions(): string[] {
  return [
    'Auvergne-Rhône-Alpes',
    'Bourgogne-Franche-Comté',
    'Bretagne',
    'Centre-Val de Loire',
    'Corse',
    'Grand Est',
    'Hauts-de-France',
    'Île-de-France',
    'Normandie',
    'Nouvelle-Aquitaine',
    'Occitanie',
    'Pays de la Loire',
    'Provence-Alpes-Côte d\'Azur',
    'Guadeloupe',
    'Martinique',
    'Guyane',
    'La Réunion',
    'Mayotte'
  ];
}