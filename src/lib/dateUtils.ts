import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval, addDays as addDaysFns, startOfMonth, endOfMonth, parseISO, isBefore, isAfter, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================
// Lightweight date helpers (merged from dateHelpers.ts)
// ============================================

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isPast(date: Date): boolean {
  return date < new Date();
}

export function isFuture(date: Date): boolean {
  return date > new Date();
}

export function addDaysVanilla(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Re-export as addDays for backward compat with dateHelpers consumers
export { addDaysVanilla as addDays };

export function differenceInDaysAbs(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getEndOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() + (7 - day);
  result.setDate(diff);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function getStartOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getEndOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'à l\'instant';
  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return date.toLocaleDateString('fr-FR');
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function parseISODate(isoString: string): Date | null {
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? null : date;
}

export function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

// ============================================
// date-fns based utilities
// ============================================

export function formatDate(date: Date | string, formatStr: string = 'PP'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: fr });
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Lundi
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getMonthDays(date: Date): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return eachDayOfInterval({ start, end });
}

export function isDateInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start && !end) return true;
  if (!start) return isBefore(date, end!) || isSameDay(date, end!);
  if (!end) return isAfter(date, start) || isSameDay(date, start);
  return isWithinInterval(date, { start, end });
}

export function getDaysUntil(targetDate: Date | string): number {
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  return differenceInDays(target, new Date());
}

export function isOverdue(date: Date | string): boolean {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(targetDate, new Date()) && !isSameDay(targetDate, new Date());
}

/**
 * Normalise un mois au format Date SQL (YYYY-MM-01)
 * Accepte : 'YYYY-MM', 'YYYY-MM-DD', Date object
 * Retourne toujours : 'YYYY-MM-01'
 */
export function normalizeMonthToDate(mois: string | Date): string {
  const d = typeof mois === 'string' ? parseISO(mois) : mois;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function groupTasksByDate<T extends { echeance?: string }>(tasks: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  
  tasks.forEach(task => {
    if (task.echeance) {
      const dateKey = format(parseISO(task.echeance), 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(task);
    }
  });
  
  return grouped;
}

export function getDatePresets() {
  const today = new Date();
  
  return {
    today: { start: today, end: today },
    thisWeek: { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) },
    next7Days: { start: today, end: addDaysFns(today, 7) },
    next30Days: { start: today, end: addDaysFns(today, 30) },
    thisMonth: { start: startOfMonth(today), end: endOfMonth(today) },
  };
}