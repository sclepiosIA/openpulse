import { isSameDay } from "date-fns";

/**
 * Calcule le jour de Pâques pour une année donnée (algorithme de Meeus/Jones/Butcher)
 * @param year - L'année pour laquelle calculer Pâques
 * @returns La date du dimanche de Pâques
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Retourne la liste des jours fériés français pour une année donnée
 * @param year - L'année pour laquelle récupérer les jours fériés
 * @returns Un tableau de dates représentant les 11 jours fériés français
 * 
 * @example
 * const holidays2026 = getFrenchHolidays(2026);
 * // Retourne [1er janvier, Lundi de Pâques, 1er mai, 8 mai, Ascension, Pentecôte, 14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre]
 */
export function getFrenchHolidays(year: number): Date[] {
  const easter = getEasterDate(year);
  const DAY_MS = 24 * 60 * 60 * 1000;

  return [
    new Date(year, 0, 1),   // Jour de l'An
    new Date(easter.getTime() + 1 * DAY_MS),  // Lundi de Pâques
    new Date(year, 4, 1),   // Fête du Travail
    new Date(year, 4, 8),   // Victoire 1945
    new Date(easter.getTime() + 39 * DAY_MS), // Ascension
    new Date(easter.getTime() + 50 * DAY_MS), // Lundi de Pentecôte
    new Date(year, 6, 14),  // Fête Nationale
    new Date(year, 7, 15),  // Assomption
    new Date(year, 10, 1),  // Toussaint
    new Date(year, 10, 11), // Armistice 1918
    new Date(year, 11, 25), // Noël
  ];
}

/**
 * Vérifie si une date est un jour férié français
 * @param date - La date à vérifier
 * @returns true si la date est un jour férié français, false sinon
 * 
 * @example
 * isFrenchHoliday(new Date(2026, 0, 1)); // true (Jour de l'An)
 * isFrenchHoliday(new Date(2026, 0, 2)); // false
 */
export function isFrenchHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getFrenchHolidays(year);
  return holidays.some(h => isSameDay(h, date));
}
